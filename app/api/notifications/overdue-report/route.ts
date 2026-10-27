import ExcelJS from "exceljs";
import {NextResponse} from "next/server";
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
async function overdue(db:SupabaseClient<any, "public", "public", any, any>){
 const today=new Date().toISOString().slice(0,10);
 const all:{tag_no:string;name:string;next_due_date:string}[]=[];
 for(let from=0;from<10000;from+=500){
  const {data,error}=await db.from("instrument_calibration_status").select("tag_no,name,next_due_date,state").eq("state","active").lt("next_due_date",today).order("next_due_date",{ascending:true}).range(from,from+499);
  if(error)throw Error("Could not load overdue instruments");
  const records = (data ?? []) as {tag_no:string|null;name:string|null;next_due_date:string|null}[];
  for (const record of records) {
   if (record.next_due_date) all.push({tag_no:record.tag_no??"",name:record.name??"",next_due_date:record.next_due_date});
  }
  if((data??[]).length<500)break;
 }
 return all;
}
export async function GET(){
 const ctx=await context();
 if(!ctx)return NextResponse.json({error:"Administrator or manager access required"},{status:403,headers});
 try{const rows=await overdue(ctx.db);return NextResponse.json({count:rows.length,recipient:ctx.user.email,items:rows},{headers});}
 catch{return NextResponse.json({error:"Unable to load overdue instruments"},{status:500,headers});}
}
export async function POST(){
 const ctx=await context();
 if(!ctx)return NextResponse.json({error:"Administrator or manager access required"},{status:403,headers});
 const smtpUser=process.env.SMTP_USER,smtpPassword=process.env.SMTP_PASSWORD;
 if(!smtpUser||!smtpPassword)return NextResponse.json({error:"Gmail SMTP is not configured"},{status:503,headers});
 try{
  const rows=await overdue(ctx.db);
  if(!rows.length)return NextResponse.json({error:"No overdue active instruments found"},{status:409,headers});
  const today=new Date().toISOString().slice(0,10);
  const workbook=new ExcelJS.Workbook();
  workbook.creator="CalDashPro";
  workbook.created=new Date();
  const sheet=workbook.addWorksheet("Overdue Instruments",{views:[{state:"frozen",ySplit:4}]});
  sheet.mergeCells("A1:E1");
  sheet.getCell("A1").value="CALDASHPRO | OVERDUE CALIBRATION REPORT";
  sheet.getCell("A1").font={bold:true,size:15,color:{argb:"FFFFFFFF"}};
  sheet.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF183153"}};
  sheet.mergeCells("A2:E2");
  sheet.getCell("A2").value="Generated: "+today+"  |  Total overdue: "+rows.length;
  sheet.getCell("A2").font={bold:true,color:{argb:"FF183153"}};
  sheet.getRow(4).values=["Instrument Tag","Instrument Name","Calibration Due Date","Days Overdue","Status"];
  sheet.getRow(4).font={bold:true,color:{argb:"FFFFFFFF"}};
  sheet.getRow(4).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF236B91"}};
  for(const r of rows){
   const days=Math.round((Date.parse(today+"T00:00:00Z")-Date.parse(r.next_due_date+"T00:00:00Z"))/86400000);
   sheet.addRow([r.tag_no,r.name,r.next_due_date,days,"Overdue"]);
  }
  sheet.columns=[{width:22},{width:42},{width:25},{width:18},{width:16}];
  sheet.autoFilter={from:{row:4,column:1},to:{row:4+rows.length,column:5}};
  sheet.eachRow((row,index)=>{if(index>4&&index%2===0)row.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF0F5FA"}};});
  const bytes=await workbook.xlsx.writeBuffer();
  const attachment=Buffer.from(bytes);
  const body="CalDashPro — Overdue Instrument Calibration Report\\nGenerated: "+today+"\\nTotal overdue active instruments: "+rows.length+"\\n\\nPlease find the detailed Excel report attached.\\n\\nThis is a manually requested report.";
  await smtpSend({user:smtpUser,password:smtpPassword,to:ctx.user.email!,subject:"CalDashPro: "+rows.length+" overdue instruments ("+today+")",body,attachment:{filename:"CalDashPro_Overdue_Instruments_"+today+".xlsx",content:attachment,contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}});
  return NextResponse.json({success:true,count:rows.length,message:"Gmail accepted the overdue-instrument report with Excel attachment."},{headers});
 }catch(e){console.error("Overdue report send failed",e instanceof Error?e.message:"Unknown");return NextResponse.json({error:"Report delivery failed. Check Vercel logs."},{status:502,headers});}
}
