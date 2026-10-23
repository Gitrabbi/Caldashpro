import Link from "next/link";
import DriftChart from "./DriftChart";
import CalibrationTemplate from "./CalibrationTemplate";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

const show=(value:unknown)=>value===null||value===undefined||value===""?"—":String(value);
const date=(value:string|null|undefined)=>value?new Date(value+"T12:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—";
export default async function InstrumentDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const s=await createClient();
 const [instrument,history,certificates,areas,locations,groups,audit,profiles,points]=await Promise.all([
  s.from("instrument_calibration_status").select("*").eq("id",id).single(),
  s.from("calibration_events").select("id,calibration_date,result,next_due_date,approved_at,procedure_reference").eq("instrument_id",id).order("calibration_date",{ascending:false}).limit(20),
  s.from("certificates").select("id,certificate_no,issue_date,expiry_date,kind,external_url").eq("instrument_id",id).order("issue_date",{ascending:false}).limit(20),
  s.from("areas").select("id,name"),s.from("locations").select("id,name"),s.from("instrument_groups").select("id,name"),
  s.from("calibration_audit_log").select("id,table_name,record_id,operation,actor_id,occurred_at,before_data,after_data").order("occurred_at",{ascending:false}).limit(500),
  s.from("profiles").select("id,full_name"),
  s.from("calibration_measurement_points").select("id,point_key,nominal_value,as_found_value,as_left_value,tolerance_minus,tolerance_plus,engineering_unit,calibration_events!inner(instrument_id,calibration_date,approved_at)").eq("calibration_events.instrument_id",id).not("calibration_events.approved_at","is",null).limit(5000)
 ]);
 const i=instrument.data;
 const names=new Map((profiles.data??[]).map(p=>[p.id,p.full_name]));
 const linked=new Set([id,...(history.data??[]).map(x=>x.id),...(certificates.data??[]).map(x=>x.id)]);
 const changes=(audit.data??[]).filter(e=>linked.has(e.record_id));
 if(!i)notFound();
 const ref=(list:{id:string;name:string}[]|null,id:string|null)=>list?.find(x=>x.id===id)?.name??"—";
 const specs:[string,unknown][]=[["Tag number",i.tag_no],["Instrument name",i.name],["Serial number",i.serial_no],["Manufacturer",i.manufacturer],["Model",i.model],["Instrument group",ref(groups.data,i.instrument_group_id)],["Area",ref(areas.data,i.area_id)],["Location",ref(locations.data,i.location_id)],["Measurement range",i.range_min!=null||i.range_max!=null?`${show(i.range_min)} – ${show(i.range_max)} ${i.engineering_unit??""}`:"—"],["Engineering unit",i.engineering_unit],["Accuracy",i.accuracy],["Criticality",i.criticality],["Operational state",i.state]];
 const schedule:[string,unknown][]=[["Calibration interval",i.calibration_interval_months?`${i.calibration_interval_months} months`:"—"],["Last calibration",date(i.last_calibration_date)],["Next due",date(i.next_due_date)],["Compliance status",i.calibration_status]];
 return <main className="content">
  <header><div><Link href="/workspace/instruments">← Back to instruments</Link><p className="eyebrow">INSTRUMENT RECORD</p><h1>{i.tag_no}</h1><p>{i.name}</p></div><span className={"status "+String(i.calibration_status??"").toLowerCase().replaceAll(" ","-")}>{show(i.calibration_status)}</span></header>
  <section className="detailGrid">
   <article className="panel"><h2>Instrument specifications</h2><dl>{specs.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{show(value)}</dd></div>)}</dl></article>
   <article className="panel"><h2>Calibration requirements</h2><dl>{schedule.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{show(value)}</dd></div>)}</dl><p><Link href="/workspace/requests">View calibration requests →</Link></p>{i.notes&&<><h3>Notes</h3><p style={{whiteSpace:"pre-wrap"}}>{i.notes}</p></>}</article>
  </section>
  <CalibrationTemplate instrumentId={id}/>
  <section className="panel"><h2>Long-term calibration drift</h2>{points.error?<p className="notice">Measurement-point history unavailable. Apply the measurement points SQL migration.</p>:<DriftChart points={(points.data??[]) as any}/>}</section>
  <section className="panel"><h2>Calibration history</h2>{history.error?<p role="alert">Unable to load calibration history: {history.error.message}</p>:history.data?.length?history.data.map(e=><div className="record" key={e.id}><div><b>{date(e.calibration_date)}</b><span>{show(e.result)} · {e.procedure_reference??"No procedure reference"} · Next due {date(e.next_due_date)}</span></div><span>{e.approved_at?"Approved":<Link href={"/workspace/calibrations/"+e.id}>Review calibration →</Link>}</span></div>):<div className="empty">No calibration history yet.<small>Recorded calibrations will appear here.</small></div>}</section>
  <section className="panel"><h2>Certificates</h2>{certificates.error?<p role="alert">Unable to load certificates: {certificates.error.message}</p>:certificates.data?.length?certificates.data.map(c=><div className="record" key={c.id}><div><b>{c.certificate_no??"Certificate"}</b><span>{show(c.kind)} · Issued {date(c.issue_date)} · Expires {date(c.expiry_date)}</span></div>{c.external_url?.startsWith("https://")?<a href={c.external_url} target="_blank" rel="noopener noreferrer">Open certificate ↗</a>:null}</div>):<div className="empty">No certificates yet.<small>Linked certificates will appear here.</small></div>}</section>
  <section className="panel"><h2>Instrument change history</h2><p><small>Changes since audit logging was enabled. Matches this instrument and its 20 most recently loaded calibration and certificate records against the 500 newest accessible audit entries.</small></p>{audit.error?<p role="alert">{audit.error.message}</p>:changes.length?changes.map(e=>{const before=(e.before_data??{}) as Record<string,unknown>,after=(e.after_data??{}) as Record<string,unknown>;const fields=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));return <details key={e.id} className="record"><summary style={{cursor:"pointer"}}><b>{e.operation} · {e.table_name.replaceAll("_"," ")}</b> · {new Date(e.occurred_at).toLocaleString("en-GB")} · {e.actor_id?names.get(e.actor_id)??e.actor_id.slice(0,8):"System / unidentified"}</summary><div style={{padding:12}}>{fields.map(k=><div key={k} style={{marginBottom:10}}><b>{k.replaceAll("_"," ")}</b><div><small>Before: {before[k]===undefined?"—":JSON.stringify(before[k])}</small></div><div><small>After: {after[k]===undefined?"—":JSON.stringify(after[k])}</small></div></div>)}</div></details>}):<div className="empty">No recorded changes found.</div>}<p><Link href="/workspace/audit">Open central audit trail →</Link></p></section>
 </main>;
}