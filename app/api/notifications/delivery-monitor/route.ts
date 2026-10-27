import {NextRequest,NextResponse} from "next/server";
import {createClient as createServiceClient} from "@supabase/supabase-js";
import {createClient as createSessionClient} from "@/lib/supabase/server";
import {smtpSend} from "@/app/api/cron/send-email-reminders/route";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};
async function authorized(){
 const session=await createSessionClient();
 const {data:{user},error}=await session.auth.getUser();
 if(error||!user)return null;
 const {data:profile}=await session.from("profiles").select("role,active").eq("id",user.id).single();
 if(!profile?.active||!["admin","manager"].includes(profile.role))return null;
 return user;
}
function database(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 return url&&key?createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;
}
export async function GET(){
 if(!await authorized())return NextResponse.json({error:"Administrator or manager access required"},{status:403,headers:noStore});
 const db=database();
 if(!db)return NextResponse.json({error:"Service configuration missing"},{status:503,headers:noStore});
 const {data,error}=await db.from("notification_email_deliveries").select("notification_id,recipient_id,status,attempted_at,sent_at,last_error").order("attempted_at",{ascending:false}).limit(100);
 if(error)return NextResponse.json({error:"Unable to load delivery records"},{status:500,headers:noStore});
 const rows=data??[];
 const counts=await Promise.all(["sent","failed","pending"].map(status=>db.from("notification_email_deliveries").select("notification_id",{count:"exact",head:true}).eq("status",status)));
 const last=await db.from("notification_email_deliveries").select("sent_at").eq("status","sent").order("sent_at",{ascending:false}).limit(1).maybeSingle();
 return NextResponse.json({counts:{sent:counts[0].count??0,failed:counts[1].count??0,pending:counts[2].count??0},lastSentAt:last.data?.sent_at??null,records:rows.map(r=>({notificationId:r.notification_id,status:r.status,attemptedAt:r.attempted_at,sentAt:r.sent_at,lastError:r.last_error}))},{headers:noStore});
}
export async function POST(req:NextRequest){
 if(!await authorized())return NextResponse.json({error:"Administrator or manager access required"},{status:403,headers:noStore});
 const db=database(),user=process.env.SMTP_USER,password=process.env.SMTP_PASSWORD;
 if(!db||!user||!password)return NextResponse.json({error:"Email service configuration missing"},{status:503,headers:noStore});
 let id:string;
 try{const body=await req.json();id=body.notificationId;if(typeof id!=="string"||!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(id))throw Error("Invalid ID");}
 catch{return NextResponse.json({error:"Invalid notification ID"},{status:400,headers:noStore});}
 // Atomic status transition ensures two concurrent retries cannot both send.
 const {data:claimed,error:claimError}=await db.from("notification_email_deliveries").update({status:"pending",attempted_at:new Date().toISOString(),last_error:null}).eq("notification_id",id).eq("status","failed").select("notification_id,recipient_id").maybeSingle();
 if(claimError||!claimed)return NextResponse.json({error:"Delivery is not failed or is already being retried"},{status:409,headers:noStore});
 const {data:notice}=await db.from("notifications").select("title,message").eq("id",id).maybeSingle();
 const {data:recipient}=await db.auth.admin.getUserById(claimed.recipient_id);
 const {data:pref}=await db.from("notification_preferences").select("email_enabled").eq("user_id",claimed.recipient_id).maybeSingle();
 if(!notice||!recipient.user?.email||pref?.email_enabled!==true){
  await db.from("notification_email_deliveries").update({status:"failed",last_error:"Recipient or email preference unavailable"}).eq("notification_id",id);
  return NextResponse.json({error:"Recipient unavailable or email reminders disabled"},{status:409,headers:noStore});
 }
 try{
  await smtpSend({user,password,to:recipient.user.email,subject:"CalDashPro: "+notice.title,body:notice.title+"\n\n"+notice.message+"\n\nOpen CalDashPro: https://caldashpro.vercel.app/workspace/notifications"});
  await db.from("notification_email_deliveries").update({status:"sent",sent_at:new Date().toISOString(),last_error:null}).eq("notification_id",id);
  return NextResponse.json({success:true,message:"Retry accepted by Gmail"},{headers:noStore});
 }catch(e){
  console.error("CalDashPro email retry failed",e instanceof Error?e.message:"Unknown error");
  await db.from("notification_email_deliveries").update({status:"failed",last_error:"SMTP delivery failed"}).eq("notification_id",id);
  return NextResponse.json({error:"Retry failed; check Vercel logs"},{status:502,headers:noStore});
 }
}
