import ExcelJS from "exceljs";
import {NextRequest,NextResponse} from "next/server";
import {createClient as serviceClient, type SupabaseClient} from "@supabase/supabase-js";
import {createClient as sessionClient} from "@/lib/supabase/server";
import {smtpSend} from "@/app/api/cron/send-email-reminders/route";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
async function context(){
 const s=await sessionClient();
 const {data:{user},error}=await s.auth.getUser();
 if(error||!user?.email)return null;
 const {data:p}=await s.from("profiles").select("active,role").eq("id",user.id).single();
 if(!p?.active||!["admin","manager"].includes(p.role))return null;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return null;
 return {user,db:serviceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})};
}
type Filter={area:string;group:string;location:string};
type Row={tag_no:string;name:string;next_due_date:string;area:string;group:string;location:string;area_id:string|null;instrument_group_id:string|null;location_id:string|null};
const emptyFilter:Filter={area:"",group:"",location:""};
function parseFilter(value:unknown):Filter{
 const v=(value&&typeof value==="object"?value:{}) as Record<string,unknown>;
 const read=(key:string)=>typeof v[key]==="string"&&/^[0-9a-f-]{36}$/i.test(v[key] as string)?v[key] as string:"";
 return {area:read("area"),group:read("group"),location:read("location")};
}
async function references(db:SupabaseClient<any,"public","public",any,any>){
 const [a,g,l]=await Promise.all([
  db.from("areas").select("id,name").order("name"),
  db.from("instrument_groups").select("id,name").order("name"),
  db.from("locations").select("id,name,area_id").order("name")
 ]);
 if(a.error||g.error||l.error)throw Error("Unable to load area, group or location names");
 return {areas:a.data??[],groups:g.data??[],locations:l.data??[]};
}
async function overdue(db:SupabaseClient<any,"public","public",any,any>,filter:Filter,refs:Awaited<ReturnType<typeof references>>){
 const today=new Date().toISOString().slice(0,10);
 const all:Row[]=[];
 const areaNames=new Map(refs.areas.map(x=>[x.id,x.name]));
 const groupNames=new Map(refs.groups.map(x=>[x.id,x.name]));
 const locationNames=new Map(refs.locations.map(x=>[x.id,x.name]));
 for(let from=0;from<10000;from+=500){
  let query=db.from("instrument_calibration_status").select("tag_no,name,next_due_date,area_id,instrument_group_id,location_id").eq("state","active").lt("next_due_date",today).order("next_due_date",{ascending:true}).range(from,from+499);
  if(filter.area)query=query.eq("area_id",filter.area);
  if(filter.group)query=query.eq("instrument_group_id",filter.group);
  if(filter.location)query=query.eq("location_id",filter.location);
  const {data,error}=await query;
  if(error)throw Error("Could not load overdue instruments");
  const records=(data??[]) as {tag_no:string|null;name:string|null;next_due_date:string|null;area_id:string|null;instrument_group_id:string|null;location_id:string|null}[];
  for(const x of records)if(x.next_due_date)all.push({tag_no:x.tag_no??"",name:x.name??"",next_due_date:x.next_due_date,area_id:x.area_id,instrument_group_id:x.instrument_group_id,location_id:x.location_id,area:areaNames.get(x.area_id??"")??"Unassigned",group:groupNames.get(x.instrument_group_id??"")??"Unassigned",location:locationNames.get(x.location_id??"")??"Unassigned"});
  if(records.length<500)break;
 }
 if(all.length>=10000)throw Error("Report exceeds 10,000 records; narrow filters");
 return all;
}
export async function GET(req:NextRequest){
 const ctx=await context();
 if(!ctx)return NextResponse.json({error:"Administrator or manager access required"},{status:403,headers});
 try{const refs=await references(ctx.db);const filter=parseFilter(Object.fromEntries(req.nextUrl.searchParams));const rows=await overdue(ctx.db,filter,refs);return NextResponse.json({count:rows.length,recipient:ctx.user.email,items:rows,options:refs},{headers});}
 catch{return NextResponse.json({error:"Unable to load overdue instruments"},{status:500,headers});}
}
export async function POST(req:NextRequest){
 const ctx=await context();
 if(!ctx)return NextResponse.json({error:"Administrator or manager access required"},{status:403,headers});
 const smtpUser=process.env.SMTP_USER,smtpPassword=process.env.SMTP_PASSWORD;
 if(!smtpUser||!smtpPassword)return NextResponse.json({error:"Gmail SMTP is not configured"},{status:503,headers});
 try{
  const payload=await req.json().catch(()=>({}));
  const filter=parseFilter(payload);
  const refs=await references(ctx.db);
  const rows=await overdue(ctx.db,filter,refs);
  if(!rows.length)return NextResponse.json({error:"No overdue active instruments found"},{status:409,headers});
  const today=new Date().toISOString().slice(0,10);
  const workbook=new ExcelJS.Workbook();
  workbook.creator="CalDashPro";
  workbook.created=new Date();
  const sheet=workbook.addWorksheet("Overdue Instruments",{views:[{state:"frozen",ySplit:4}]});
  sheet.mergeCells("A1:H1");
  sheet.getCell("A1").value="CALDASHPRO | OVERDUE CALIBRATION REPORT";
  sheet.getCell("A1").font={bold:true,size:15,color:{argb:"FFFFFFFF"}};
  sheet.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF183153"}};
  sheet.mergeCells("A2:H2");
  sheet.getCell("A2").value="Generated: "+today+"  |  Total overdue: "+rows.length;
  sheet.getCell("A2").font={bold:true,color:{argb:"FF183153"}};
  sheet.getRow(4).values=["Instrument Tag","Instrument Name","Area","Instrument Group","Location","Calibration Due Date","Days Overdue","Status"];
  sheet.getRow(4).font={bold:true,color:{argb:"FFFFFFFF"}};
  sheet.getRow(4).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF236B91"}};
  for(const r of rows){
   const days=Math.round((Date.parse(today+"T00:00:00Z")-Date.parse(r.next_due_date+"T00:00:00Z"))/86400000);
   sheet.addRow([r.tag_no,r.name,r.area,r.group,r.location,r.next_due_date,days,"Overdue"]);
  }
  sheet.columns=[{width:22},{width:42},{width:25},{width:26},{width:27},{width:25},{width:18},{width:16}];
  sheet.autoFilter={from:{row:4,column:1},to:{row:4+rows.length,column:8}};
  sheet.eachRow((row,index)=>{if(index>4&&index%2===0)row.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF0F5FA"}};});
  const bytes=await workbook.xlsx.writeBuffer();
  const attachment=Buffer.from(bytes);
  const body=["CalDashPro — Overdue Instrument Calibration Report","Generated: "+today,"Total matching overdue instruments: "+rows.length,"Area: "+(refs.areas.find(x=>x.id===filter.area)?.name??"All"),"Group: "+(refs.groups.find(x=>x.id===filter.group)?.name??"All"),"Location: "+(refs.locations.find(x=>x.id===filter.location)?.name??"All"),"","Please find the filtered Excel report attached.","","This is a manually requested report."].join("\\n");
  await smtpSend({user:smtpUser,password:smtpPassword,to:ctx.user.email!,subject:"CalDashPro: "+rows.length+" overdue instruments ("+today+")",body,attachment:{filename:"CalDashPro_Overdue_Instruments_"+today+".xlsx",content:attachment,contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}});
  return NextResponse.json({success:true,count:rows.length,message:"Gmail accepted the overdue-instrument report with Excel attachment."},{headers});
 }catch(e){console.error("Overdue report send failed",e instanceof Error?e.message:"Unknown");return NextResponse.json({error:"Report delivery failed. Check Vercel logs."},{status:502,headers});}
}
