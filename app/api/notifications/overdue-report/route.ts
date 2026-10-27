import {NextResponse} from "next/server";
import {createClient as serviceClient} from "@supabase/supabase-js";
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
async function overdue(db:ReturnType<typeof serviceClient>){
 const today=new Date().toISOString().slice(0,10);
 const all:{tag_no:string;name:string;next_due_date:string}[]=[];
 for(let from=0;from<10000;from+=500){
  const {data,error}=await db.from("instrument_calibration_status").select("tag_no,name,next_due_date,state").eq("state","active").lt("next_due_date",today).order("next_due_date",{ascending:true}).range(from,from+499);
  if(error)throw Error("Could not load overdue instruments");
  all.push(...(data??[]).filter(x=>x.next_due_date).map(x=>({tag_no:x.tag_no??"",name:x.name??"",next_due_date:x.next_due_date})));
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
  const lines=rows.map((r,i)=>{const days=Math.round((Date.parse(today+"T00:00:00Z")-Date.parse(r.next_due_date+"T00:00:00Z"))/86400000);return (i+1)+". "+r.tag_no+" | "+r.name+" | Due: "+r.next_due_date+" | "+days+" days overdue";});
  const body="CalDashPro — Overdue Instrument Calibration Report\nGenerated: "+today+"\nTotal overdue active instruments: "+rows.length+"\n\n"+lines.join("\n")+"\n\nView instruments: https://caldashpro.vercel.app/workspace/instruments\n\nThis is a manually requested report.";
  await smtpSend({user:smtpUser,password:smtpPassword,to:ctx.user.email!,subject:"CalDashPro: "+rows.length+" overdue instruments ("+today+")",body});
  return NextResponse.json({success:true,count:rows.length,message:"Gmail accepted one consolidated overdue-instrument report."},{headers});
 }catch(e){console.error("Overdue report send failed",e instanceof Error?e.message:"Unknown");return NextResponse.json({error:"Report delivery failed. Check Vercel logs."},{status:502,headers});}
}
