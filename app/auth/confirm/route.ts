import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function GET(request:NextRequest){
 const url=new URL(request.url),code=url.searchParams.get("code"),token_hash=url.searchParams.get("token_hash"),type=url.searchParams.get("type");
 const s=await createClient();
 let ok=false;
 if(code){const {error}=await s.auth.exchangeCodeForSession(code);ok=!error;}
 else if(token_hash&&["invite","signup","email","recovery"].includes(type??"")){const {error}=await s.auth.verifyOtp({token_hash,type:type as "invite"|"signup"|"email"|"recovery"});ok=!error;}
 if(!ok){const target=new URL("/auth/finish",url.origin);if(url.searchParams.get("flow")==="recovery")target.searchParams.set("flow","recovery");if(code||token_hash)target.searchParams.set("error_description","This verification link could not be exchanged. Request a fresh email.");else if(url.searchParams.get("error_description"))target.searchParams.set("error_description",url.searchParams.get("error_description")!);return NextResponse.redirect(target);}
 return NextResponse.redirect(new URL(type==="recovery"||url.searchParams.get("flow")==="recovery"?"/reset-password":"/complete-registration",url.origin));
}