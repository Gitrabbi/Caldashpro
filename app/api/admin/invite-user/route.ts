import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createClient as createAdminClient} from "@supabase/supabase-js";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 const session=await createClient();
 const {data:{user}}=await session.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 const {data:profile}=await session.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
 if(profile?.role!=="admin"||!profile.active)return NextResponse.json({error:"Administrator access required"},{status:403});
 const input=await request.json().catch(()=>null);
 const email=typeof input?.email==="string"?input.email.trim().toLowerCase():"";
 const fullName=typeof input?.full_name==="string"?input.full_name.trim():"";
 const role=input?.role;
 if(!email.includes("@")||email.length>254||!fullName||fullName.length>120||!["technician","manager","viewer","admin"].includes(role))return NextResponse.json({error:"Enter a valid email, name and role"},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:"User invitation service is not configured"},{status:503});
 const admin=createAdminClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data,error}=await admin.auth.admin.inviteUserByEmail(email,{data:{full_name:fullName},redirectTo:"https://caldashpro.vercel.app/auth/confirm?next=/complete-registration"});
 if(error)return NextResponse.json({error:error.message},{status:400});
 if(!data.user?.id)return NextResponse.json({error:"Invitation did not return a user ID"},{status:502});
 const {error:metadataError}=await admin.auth.admin.updateUserById(data.user.id,{app_metadata:{...data.user.app_metadata,caldashpro_invited:true,caldashpro_role:role}});
 if(metadataError)return NextResponse.json({error:"Invitation sent, but role assignment failed: "+metadataError.message},{status:500});
 return NextResponse.json({message:"Invitation sent. The account will be activated after the recipient accepts and sets a password."});
}