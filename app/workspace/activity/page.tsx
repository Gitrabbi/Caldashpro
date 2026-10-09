import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
export const dynamic="force-dynamic";
type Event={id:string;instrument_id:string;calibration_date:string;created_at:string;updated_at:string;result:string;review_status:string;review_notes:string|null;reviewed_at:string|null;approved_at:string|null;technician_id:string|null;reviewed_by:string|null;instruments:{tag_no:string;name:string}|{tag_no:string;name:string}[]|null};
const date=(x:string|null)=>x?new Date(x).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"}):"—";
export default async function AuditTrail(){
 const s=await createClient();
 const {data:{user}}=await s.auth.getUser();
 const [events,profiles]=await Promise.all([s.from("calibration_events").select("id,instrument_id,calibration_date,created_at,updated_at,result,review_status,review_notes,reviewed_at,approved_at,technician_id,reviewed_by,instruments(tag_no,name)").order("updated_at",{ascending:false}).limit(200),s.from("profiles").select("id,full_name").eq("active",true)]);
 const names=new Map((profiles.data??[]).map(p=>[p.id,p.full_name]));
 const records=(events.data??[]) as Event[];
 return <main className="content"><header><div><p className="eyebrow">QUALITY ASSURANCE</p><h1>Calibration Activity</h1><p>Recent calibration submissions and review decisions, newest updates first.</p></div><Link href="/workspace/reviews">Review queue →</Link></header>
 {events.error&&<div className="notice" role="alert">{events.error.message}</div>}
 <section className="cards">{["submitted","rejected","approved"].map(status=><article key={status}><div><span>{status[0].toUpperCase()+status.slice(1)}</span><strong>{records.filter(x=>x.review_status===status).length}</strong></div></article>)}</section>
 <p><small>Displays the 200 most recently updated calibration records. This is a current-state activity view, not an immutable audit log of every change. Historical edits require a database audit trigger.</small></p>
 <section className="panel tablePanel">{records.length?<div className="tableWrap"><table><thead><tr><th>Instrument</th><th>Calibration</th><th>Technician</th><th>Result</th><th>Review status</th><th>Reviewed by</th><th>Reviewed at</th><th>Last changed</th><th>Notes</th></tr></thead><tbody>{records.map(e=>{const inst=Array.isArray(e.instruments)?e.instruments[0]:e.instruments;return <tr key={e.id}><td><Link href={"/workspace/instruments/"+e.instrument_id}>{inst?.tag_no??"Instrument"}</Link><small className="cellSub">{inst?.name??""}</small></td><td>{e.calibration_date}</td><td>{e.technician_id?names.get(e.technician_id)??"User "+e.technician_id.slice(0,8):"—"}</td><td>{e.result}</td><td><span className={"status "+e.review_status}>{e.review_status}</span></td><td>{e.reviewed_by?names.get(e.reviewed_by)??"User "+e.reviewed_by.slice(0,8):"—"}</td><td>{date(e.reviewed_at)}</td><td>{date(e.updated_at)}</td><td>{e.review_notes??"—"}</td></tr>})}</tbody></table></div>:<div className="empty">No calibration activity recorded yet.</div>}</section></main>;
}