import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
export const dynamic="force-dynamic";
type Instrument={id:string;tag_no:string;name:string;next_due_date:string|null;last_calibration_date:string|null;calibration_interval_months:number|null;calibration_status:string;state:string;days_to_due:number|null};
const display=(d:string|null)=>d?new Date(d+"T12:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"Not scheduled";
export default async function Scheduling(){
 const s=await createClient();
 const {data,error}=await s.from("instrument_calibration_status").select("id,tag_no,name,next_due_date,last_calibration_date,calibration_interval_months,calibration_status,state,days_to_due").eq("state","active").order("next_due_date",{ascending:true,nullsFirst:false});
 const rows=(data??[]) as Instrument[];
 const today=new Date().toISOString().slice(0,10);
 const dayMs=86400000;
 const days=(d:string)=>Math.round((Date.parse(d+"T00:00:00Z")-Date.parse(today+"T00:00:00Z"))/dayMs);
 const overdue=rows.filter(r=>r.next_due_date&&days(r.next_due_date)<0);
 const soon=rows.filter(r=>r.next_due_date&&days(r.next_due_date)>=0&&days(r.next_due_date)<=30);
 const later=rows.filter(r=>r.next_due_date&&days(r.next_due_date)>30&&days(r.next_due_date)<=90);
 const unscheduled=rows.filter(r=>!r.next_due_date);
 const groups=[{title:"Overdue",items:overdue,description:"Past their scheduled due dates"},{title:"Due within 30 days",items:soon,description:"Including instruments due today"},{title:"Due in 31–90 days",items:later,description:"Plan ahead for upcoming work"},{title:"No due date",items:unscheduled,description:"Review and complete calibration scheduling"}];
 return <main className="content"><header><div><p className="eyebrow">CALIBRATION PLANNING</p><h1>Calibration Schedule</h1><p>Prioritize calibration work using instrument due dates. Updated from your live register.</p></div><Link className="primary" href="/workspace/instruments">Instrument register</Link></header>
 {error&&<p className="notice" role="alert">Unable to load calibration schedule: {error.message}</p>}
 <section className="cards">{groups.map(g=><article key={g.title}><div><span>{g.title}</span><strong>{g.items.length}</strong></div></article>)}</section>
 <p style={{margin:"20px 0"}}><small>Planning information only. A scheduled date does not confirm that calibration was performed or approved. Demo instruments are fictitious.</small></p>
 {groups.map(g=><section className="panel tablePanel" key={g.title} style={{marginBottom:20}}><h2 style={{padding:"18px 20px 0"}}>{g.title} ({g.items.length})</h2><p style={{padding:"0 20px"}}>{g.description}</p>{g.items.length?<div className="tableWrap"><table><thead><tr><th>Tag</th><th>Instrument</th><th>Last calibrated</th><th>Interval</th><th>Next due</th><th>Timing</th><th></th></tr></thead><tbody>{g.items.map(i=><tr key={i.id}><td><b>{i.tag_no}</b></td><td>{i.name}</td><td>{display(i.last_calibration_date)}</td><td>{i.calibration_interval_months?i.calibration_interval_months+" months":"—"}</td><td>{display(i.next_due_date)}</td><td>{i.next_due_date?(days(i.next_due_date)<0?Math.abs(days(i.next_due_date))+" days overdue":days(i.next_due_date)===0?"Due today":days(i.next_due_date)+" days remaining"):"Needs scheduling"}</td><td><Link href={"/workspace/instruments/"+i.id}>View</Link></td></tr>)}</tbody></table></div>:<div className="empty">No instruments in this category.</div>}</section>)}
 <section className="panel"><h2>Calibration requests</h2><p>Use the Calibration Requests page to manage assigned work and record calibration results. This schedule does not create work orders automatically.</p><Link href="/workspace/requests">Open calibration requests →</Link></section>
 </main>;
}