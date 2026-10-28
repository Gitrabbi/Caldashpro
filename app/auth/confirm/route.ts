import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function GET(request:NextRequest){
 const url=new URL(request.url),code=url.searchParams.get("code"),token_hash=url.searchParams.get("token_hash"),type=url.searchParams.get("type");
 const s=await createClient();
 let ok=false;
 if(code){const {error}=await s.auth.exchangeCodeForSession(code);ok=!error;}
 else if(token_hash&&["invite","signup","email","recovery"].includes(type??"")){const {error}=await s.auth.verifyOtp({token_hash,type:type as "invite"|"signup"|"email"|"recovery"});ok=!error;}
 if(!ok)return NextResponse.redirect(new URL("/login?verification=failed",url.origin));
 return NextResponse.redirect(new URL("/complete-registration",url.origin));
}