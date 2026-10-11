import {createClient} from "@/lib/supabase/server";
import ReportsClient from "./ReportsClient";
export const dynamic="force-dynamic";
export default async function Reports(){
 const s=await createClient();
 const [i,e,c,r,p]=await Promise.all([
 s.from("instrument_calibration_status").select("id,tag_no,name,next_due_date,calibration_status,state").eq("state","active"),
 s.from("calibration_events").select("id,calibration_date,review_status,result,technician_id,instrument_id"),
 s.from("certificates").select("id,certificate_no,expiry_date,instrument_id"),
 s.from("calibration_requests").select("id,assigned_to,status,due_date"),
 s.from("profiles").select("id,full_name").eq("active",true)
 ]);
 const errors=[i.error,e.error,c.error,r.error,p.error].filter(Boolean);
 return <main className="content"><header><div><p className="eyebrow">MANAGEMENT & AUDIT REPORTING</p><h1>Calibration Reports</h1><p>Analyze calibration activity, instrument compliance, certificate expiry and team performance.</p></div></header>{errors.length>0&&<div role="alert" className="notice">Some reports could not load: {errors.map(x=>x?.message).join("; ")}</div>}<ReportsClient instruments={i.data??[]} events={e.data??[]} certificates={c.data??[]} requests={r.data??[]} profiles={p.data??[]}/></main>;
}