import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createClient as serviceClient} from "@supabase/supabase-js";
export async function POST(req:NextRequest){
 const session=await createClient();
 const {data:{user}}=await session.auth.getUser();
 if(!user||!user.email_confirmed_at)return NextResponse.json({error:"Verify your email address before activating your account."},{status:403});
 const input=await req.json().catch(()=>null);
 const name=typeof input?.full_name==="string"?input.full_name.trim():"";
 const password=typeof input?.password==="string"?input.password:"";
 if(password.length<8)return NextResponse.json({error:"Choose a password of at least 8 characters."},{status:400});
 if(!name||name.length>120)return NextResponse.json({error:"Enter your full name."},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:"Registration service unavailable"},{status:503});
 const admin=serviceClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:existing,error:readError}=await admin.from("profiles").select("id,role,active").eq("id",user.id).maybeSingle();
 if(readError)return NextResponse.json({error:readError.message},{status:500});
 if(existing?.active)return NextResponse.json({success:true});
 // Existing inactive profiles must be reviewed by an administrator; no self-reactivation.
 if(existing)return NextResponse.json({error:"Your account is inactive. Contact an administrator."},{status:403});
 const role=user.app_metadata?.caldashpro_invited===true&&["admin","manager","technician","viewer"].includes(user.app_metadata?.caldashpro_role)?user.app_metadata.caldashpro_role:"viewer";
 const {error:passwordError}=await session.auth.updateUser({password});
 if(passwordError)return NextResponse.json({error:passwordError.message},{status:400});
 const {error}=await admin.from("profiles").insert({id:user.id,full_name:name,role,active:true});
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({success:true});
}