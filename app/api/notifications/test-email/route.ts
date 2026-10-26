import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {smtpSend} from "@/app/api/cron/send-email-reminders/route";
export const runtime="nodejs";
export const dynamic="force-dynamic";

// Best-effort cooldown per server instance; restricted to authenticated privileged users.
const lastSent = new Map<string,number>();
export async function POST(){
 const supabase=await createClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user?.email)return NextResponse.json({error:"Sign in to send a test email."},{status:401});
 const {data:profile,error:profileError}=await supabase.from("profiles").select("role,active").eq("id",user.id).single();
 if(profileError||!profile?.active||!["admin","manager"].includes(profile.role))return NextResponse.json({error:"Only active administrators or managers can send test emails."},{status:403});
 const now=Date.now();
 if(now-(lastSent.get(user.id)??0)<60000)return NextResponse.json({error:"Please wait one minute before testing again."},{status:429});
 const mailUser=process.env.SMTP_USER,mailPassword=process.env.SMTP_PASSWORD;
 if(!mailUser||!mailPassword)return NextResponse.json({error:"Gmail SMTP environment variables are missing."},{status:503});
 lastSent.set(user.id,now);
 try{
  await smtpSend({user:mailUser,password:mailPassword,to:user.email,subject:"CalDashPro — Gmail delivery test",body:"This is a test email from CalDashPro.\n\nYour Gmail SMTP configuration accepted this message.\n\nThis test does not send calibration reminders to other users."});
  return NextResponse.json({success:true,message:"Gmail accepted the test email. Check your inbox or Spam folder."});
 }catch(e){
  lastSent.delete(user.id);
  console.error("CalDashPro SMTP test failed",e instanceof Error?e.message:"Unknown SMTP error");
  return NextResponse.json({error:"Gmail delivery failed. Check your SMTP_USER, Google App Password and Vercel function logs."},{status:502});
 }
}
