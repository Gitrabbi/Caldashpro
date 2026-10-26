import tls from "node:tls";
import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
export const dynamic="force-dynamic";

function smtpSend({user,password,to,subject,body}:{user:string;password:string;to:string;subject:string;body:string}):Promise<void>{
 return new Promise((resolve,reject)=>{
  const socket=tls.connect({host:"smtp.gmail.com",port:465,servername:"smtp.gmail.com",rejectUnauthorized:true});
  socket.setTimeout(20000);
  let buffer="",pending:{resolve:(value:string)=>void;reject:(reason:Error)=>void}|null=null;
  let responseLines:string[]=[];
  const fail=(e:Error)=>{if(pending){pending.reject(e);pending=null}socket.destroy();reject(e)};
  socket.on("error",fail);socket.on("timeout",()=>fail(new Error("SMTP timeout")));
  socket.on("data",chunk=>{
   buffer+=chunk.toString("utf8");let index;
   while((index=buffer.indexOf("\r\n"))>=0){
    const line=buffer.slice(0,index);buffer=buffer.slice(index+2);
    if(!/^\d{3}[ -]/.test(line))continue;
    responseLines.push(line);
    if(line[3]==="-" )continue;
    const response=responseLines.join("\n");responseLines=[];
    if(pending){const p=pending;pending=null;p.resolve(response)}
   }
  });
  const command=(value:string|null,expected:number[])=>new Promise<string>((ok,no)=>{
   pending={resolve:(response)=>{const code=Number(response.slice(0,3));if(expected.includes(code))ok(response);else no(new Error("SMTP error "+code))},reject:no};
   if(value!==null)socket.write(value+"\r\n");
  });
  const clean=(v:string)=>v.replace(/[\r\n]/g," ");
  (async()=>{
   await command(null,[220]);
   await command("EHLO caldashpro.vercel.app",[250]);
   await command("AUTH LOGIN",[334]);
   await command(Buffer.from(user).toString("base64"),[334]);
   await command(Buffer.from(password).toString("base64"),[235]);
   await command("MAIL FROM:<"+clean(user)+">",[250]);
   await command("RCPT TO:<"+clean(to)+">",[250,251]);
   await command("DATA",[354]);
   const encodedSubject="=?UTF-8?B?"+Buffer.from(subject).toString("base64")+"?=";
   const message=["From: "+clean(user),"To: "+clean(to),"Subject: "+encodedSubject,"MIME-Version: 1.0","Content-Type: text/plain; charset=UTF-8","Content-Transfer-Encoding: base64","",""+Buffer.from(body).toString("base64").match(/.{1,76}/g)?.join("\r\n")].join("\r\n");
   await command(message+"\r\n.",[250]);
   await command("QUIT",[221]);socket.end();resolve();
  })().catch(fail);
 });
}

type Notice={id:string;recipient_id:string;title:string;message:string;created_at:string};
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Unauthorized"},{status:401});
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY,mailUser=process.env.SMTP_USER,mailPassword=process.env.SMTP_PASSWORD;
 if(!key||!mailUser||!mailPassword||!process.env.NEXT_PUBLIC_SUPABASE_URL)return NextResponse.json({error:"Email delivery environment is not configured"},{status:503});
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:notifications,error}=await db.from("notifications").select("id,recipient_id,title,message,created_at").order("created_at",{ascending:false}).limit(1000);
 if(error)return NextResponse.json({error:"Notification query failed"},{status:500});
 const candidates=((notifications??[]) as Notice[]).reverse();
 let sent=0,failed=0,skipped=0;
 for(const n of candidates){
  const {data:pref,error:prefError}=await db.from("notification_preferences").select("email_enabled").eq("user_id",n.recipient_id).maybeSingle();
  if(prefError||pref?.email_enabled!==true){skipped++;continue}
  const {data:previous}=await db.from("notification_email_deliveries").select("status").eq("notification_id",n.id).maybeSingle();
  if(previous){skipped++;continue}
  const {data:claim,error:claimError}=await db.from("notification_email_deliveries").insert({notification_id:n.id,recipient_id:n.recipient_id,status:"pending"}).select("notification_id").maybeSingle();
  if(claimError||!claim){skipped++;continue}
  const {data:user,error:userError}=await db.auth.admin.getUserById(n.recipient_id);
  const email=user?.user?.email;
  if(userError||!email){await db.from("notification_email_deliveries").update({status:"failed",last_error:"Recipient email unavailable"}).eq("notification_id",n.id);failed++;continue}
  try{
   await smtpSend({user:mailUser,password:mailPassword,to:email,subject:`CalDashPro: ${n.title}`,body:`${n.title}\n\n${n.message}\n\nOpen CalDashPro: https://caldashpro.vercel.app/workspace/notifications\n\nYou can disable email notifications in your account preferences.`});
   await db.from("notification_email_deliveries").update({status:"sent",provider_id:null,sent_at:new Date().toISOString(),last_error:null}).eq("notification_id",n.id);sent++;
  }catch{await db.from("notification_email_deliveries").update({status:"failed",last_error:"Email provider request failed"}).eq("notification_id",n.id);failed++}
 }
 return NextResponse.json({checked:candidates.length,sent,failed,skipped});
}
