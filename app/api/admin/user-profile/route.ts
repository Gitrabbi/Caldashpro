import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createClient as adminClient} from "@supabase/supabase-js";
export async function PATCH(req:NextRequest){
 const session=await createClient();
 const {data:{user}}=await session.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 const {data:profile}=await session.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
 if(!profile?.active||profile.role!=="admin")return NextResponse.json({error:"Administrator access required"},{status:403});
 const input=await req.json().catch(()=>null);
 const id=typeof input?.id==="string"?input.id:"";
 const full_name=typeof input?.full_name==="string"?input.full_name.trim():"";
 const role=input?.role,active=input?.active;
 if(!/^[a-f0-9-]{36}$/i.test(id)||!full_name||!["admin","manager","technician","viewer"].includes(role)||typeof active!=="boolean")return NextResponse.json({error:"Invalid profile"},{status:400});
 if(id===user.id&&(!active||role!=="admin"))return NextResponse.json({error:"You cannot remove your own administrator access"},{status:409});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:"Service unavailable"},{status:503});
 const db=adminClient(url,key);
 const {data,error}=await db.from("profiles").update({full_name,role,active}).eq("id",id).select("id").maybeSingle();
 if(error)return NextResponse.json({error:error.message},{status:500});
 if(!data)return NextResponse.json({error:"User profile not found"},{status:404});
 return NextResponse.json({success:true});
}
export async function DELETE(req:NextRequest){
 const session=await createClient();
 const {data:{user}}=await session.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 const {data:profile}=await session.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
 if(!profile?.active||profile.role!=="admin")return NextResponse.json({error:"Administrator access required"},{status:403});
 const input=await req.json().catch(()=>null);
 const id=typeof input?.id==="string"?input.id:"";
 if(!/^[a-f0-9-]{36}$/i.test(id))return NextResponse.json({error:"Invalid user ID"},{status:400});
 if(id===user.id)return NextResponse.json({error:"You cannot delete your own administrator account"},{status:409});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:"Service unavailable"},{status:503});
 const db=adminClient(url,key);
 // Preserve calibration and audit references by disabling the account rather than deleting history.
 const {data:target,error:lookupError}=await db.from("profiles").select("id,active").eq("id",id).maybeSingle();
 if(lookupError)return NextResponse.json({error:lookupError.message},{status:500});
 if(!target)return NextResponse.json({error:"User profile not found"},{status:404});
 const {error}=await db.from("profiles").update({active:false}).eq("id",id);
 if(error)return NextResponse.json({error:error.message},{status:500});
 const {error:authError}=await db.auth.admin.updateUserById(id,{ban_duration:"876000h"});
 if(authError)return NextResponse.json({error:"Account deactivated, but sign-in blocking failed: "+authError.message},{status:500});
 return NextResponse.json({success:true,message:"User removed from active access. Calibration and audit history retained."});
}
