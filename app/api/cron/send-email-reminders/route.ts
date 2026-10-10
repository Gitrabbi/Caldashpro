import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Notice={id:string;recipient_id:string;title:string;message:string;created_at:string};
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Unauthorized"},{status:401});
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY,api=process.env.RESEND_API_KEY,from=process.env.EMAIL_FROM;
 if(!key||!api||!from||!process.env.NEXT_PUBLIC_SUPABASE_URL)return NextResponse.json({error:"Email delivery environment is not configured"},{status:503});
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:notifications,error}=await db.from("notifications").select("id,recipient_id,title,message,created_at").order("created_at",{ascending:true}).limit(100);
 if(error)return NextResponse.json({error:"Notification query failed"},{status:500});
 const candidates=(notifications??[]) as Notice[];
 let sent=0,failed=0,skipped=0;
 for(const n of candidates){
  const {data:pref,error:prefError}=await db.from("notification_preferences").select("email_enabled").eq("user_id",n.recipient_id).maybeSingle();
  if(prefError||pref?.email_enabled===false){skipped++;continue}
  const {data:previous}=await db.from("notification_email_deliveries").select("status").eq("notification_id",n.id).maybeSingle();
  if(previous){skipped++;continue}
  const {data:claim,error:claimError}=await db.from("notification_email_deliveries").insert({notification_id:n.id,recipient_id:n.recipient_id,status:"pending"}).select("notification_id").maybeSingle();
  if(claimError||!claim){skipped++;continue}
  const {data:user,error:userError}=await db.auth.admin.getUserById(n.recipient_id);
  const email=user?.user?.email;
  if(userError||!email){await db.from("notification_email_deliveries").update({status:"failed",last_error:"Recipient email unavailable"}).eq("notification_id",n.id);failed++;continue}
  try{
   const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":`Bearer ${api}`,"Content-Type":"application/json","Idempotency-Key":n.id},body:JSON.stringify({from,to:[email],subject:`CalDashPro: ${n.title}`,text:`${n.title}\n\n${n.message}\n\nOpen CalDashPro: https://caldashpro.vercel.app/workspace/notifications\n\nYou can disable email notifications in your account preferences.`})});
   const body=await response.json().catch(()=>({}));
   if(!response.ok){await db.from("notification_email_deliveries").update({status:"failed",last_error:`Provider HTTP ${response.status}`}).eq("notification_id",n.id);failed++;continue}
   await db.from("notification_email_deliveries").update({status:"sent",provider_id:typeof body.id==="string"?body.id:null,sent_at:new Date().toISOString(),last_error:null}).eq("notification_id",n.id);sent++;
  }catch{await db.from("notification_email_deliveries").update({status:"failed",last_error:"Email provider request failed"}).eq("notification_id",n.id);failed++}
 }
 return NextResponse.json({checked:candidates.length,sent,failed,skipped});
}
