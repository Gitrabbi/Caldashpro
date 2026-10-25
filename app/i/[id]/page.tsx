import {redirect,notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
export default async function ScanInstrument({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const target="/workspace/instruments/"+id;
 const s=await createClient();
 const {data:{user}}=await s.auth.getUser();
 if(!user)redirect("/login?next="+encodeURIComponent(target));
 redirect(target);
}
