import {createClient} from "@/lib/supabase/server";
import AuditLogClient from "./AuditLogClient";
export const dynamic="force-dynamic";
export default async function AuditPage(){
 const s=await createClient();
 const [audit,profiles]=await Promise.all([s.from("calibration_audit_log").select("id,table_name,record_id,operation,actor_id,occurred_at,before_data,after_data").order("occurred_at",{ascending:false}).limit(500),s.from("profiles").select("id,full_name")]);
 return <main className="content"><header><div><p className="eyebrow">QUALITY ASSURANCE</p><h1>Calibration Audit Trail</h1><p>Review recorded changes to instruments, calibrations, requests and certificates.</p></div></header>{audit.error&&<p className="notice" role="alert">Could not load audit history: {audit.error.message}</p>}{profiles.error&&<p className="notice" role="alert">User names unavailable: {profiles.error.message}</p>}<AuditLogClient entries={audit.data??[]} profiles={profiles.data??[]}/></main>;
}