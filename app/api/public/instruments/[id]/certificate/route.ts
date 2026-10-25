import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!uuid.test(id))return new NextResponse("Not found",{status:404});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return new NextResponse("Public certificate service is not configured",{status:503});
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:instrument,error:instrumentError}=await admin.from("instruments").select("id,state").eq("id",id).eq("state","active").maybeSingle();
 if(instrumentError||!instrument)return new NextResponse("Not found",{status:404});
 const {data:certs,error}=await admin.from("certificates").select("id,file_path,certificate_no,calibration_event_id").eq("instrument_id",id).eq("public_qr_enabled",true).not("file_path","is",null).order("issue_date",{ascending:false,nullsFirst:false}).limit(20);
 if(error)return new NextResponse("Certificate unavailable",{status:503});
 let cert:typeof certs[number]|undefined;
 for(const candidate of certs??[]){
  if(!candidate.file_path)continue;
  if(candidate.calibration_event_id){
   const event=await admin.from("calibration_events").select("approved_at").eq("id",candidate.calibration_event_id).maybeSingle();
   if(event.error||!event.data?.approved_at)continue;
  }
  cert=candidate;break;
 }
 if(!cert?.file_path)return new NextResponse("No publicly released certificate",{status:404});
 const file=await admin.storage.from("calibration-certificates").download(cert.file_path);
 if(file.error||!file.data)return new NextResponse("Certificate file unavailable",{status:404});
 const bytes=await file.data.arrayBuffer();
 if(bytes.byteLength>10*1024*1024)return new NextResponse("File exceeds permitted size",{status:413});
 if(new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-")return new NextResponse("Invalid certificate format",{status:415});
 const name="calibration-certificate-"+id.slice(0,8)+".pdf";
 return new NextResponse(bytes,{headers:{"Content-Type":"application/pdf","Content-Disposition":'inline; filename="'+name+'"',"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox","Referrer-Policy":"no-referrer"}});
}
