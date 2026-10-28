import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
export const dynamic="force-dynamic";
type Instrument={id:string;tag_no:string;name:string;next_due_date:string|null;calibration_status:string|null;days_to_due:number|null};
type Event={id:string;calibration_date:string;review_status:string;technician_id:string|null;result:string};
type Request={id:string;status:string;assigned_to:string|null;due_date:string|null};
type Cert={id:string;expiry_date:string|null};
const months=Array.from({length:6},(_,i)=>{const d=new Date();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-(5-i));return {key:d.toISOString().slice(0,7),label:d.toLocaleString("en-GB",{month:"short",year:"2-digit",timeZone:"UTC"})}});
export default async function Dashboard(){
 const s=await createClient();
 const [ir,er,rr,cr,pr]=await Promise.all([
 s.from("instrument_calibration_status").select("id,tag_no,name,next_due_date,calibration_status,days_to_due").eq("state","active").order("next_due_date",{ascending:true,nullsFirst:false}),
 s.from("calibration_events").select("id,calibration_date,review_status,technician_id,result"),
 s.from("calibration_requests").select("id,status,assigned_to,due_date"),
 s.from("certificates").select("id,expiry_date"),
 s.from("profiles").select("id,full_name").eq("active",true)
 ]);
 const instruments=(ir.data??[]) as Instrument[],events=(er.data??[]) as Event[],requests=(rr.data??[]) as Request[],certificates=(cr.data??[]) as Cert[];
 const total=instruments.length,overdue=instruments.filter(x=>x.calibration_status==="Overdue").length,unscheduled=instruments.filter(x=>!x.next_due_date).length;
 const compliant=instruments.filter(x=>x.next_due_date&&x.days_to_due!==null&&x.days_to_due>=0).length;
 const compliance=total?Math.round(compliant/total*100):0;
 const due30=instruments.filter(x=>x.days_to_due!==null&&x.days_to_due>=0&&x.days_to_due<=30).length;
 const due90=instruments.filter(x=>x.days_to_due!==null&&x.days_to_due>=0&&x.days_to_due<=90).length;
 const today=new Date().toISOString().slice(0,10),thirty=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
 const expired=certificates.filter(x=>x.expiry_date&&x.expiry_date<today).length,expiring=certificates.filter(x=>x.expiry_date&&x.expiry_date>=today&&x.expiry_date<=thirty).length;
 const approved=events.filter(x=>x.review_status==="approved").length,pending=events.filter(x=>x.review_status==="submitted").length;
 const names=new Map((pr.data??[]).map(p=>[p.id,p.full_name]));
 const assigned=new Map<string,{total:number;completed:number}>();
 for(const r of requests){if(!r.assigned_to)continue;const x=assigned.get(r.assigned_to)??{total:0,completed:0};x.total++;if(r.status==="completed")x.completed++;assigned.set(r.assigned_to,x)}
 const trends=months.map(m=>({label:m.label,approved:events.filter(x=>x.calibration_date?.startsWith(m.key)&&x.review_status==="approved").length,submitted:events.filter(x=>x.calibration_date?.startsWith(m.key)&&x.review_status!=="approved").length}));
 const max=Math.max(1,...trends.map(x=>x.approved+x.submitted));
 const upcoming=instruments.filter(x=>x.next_due_date&&x.days_to_due!==null&&x.days_to_due>=0).slice(0,8);
 const failedEvents=events.filter(x=>x.result==="fail").length;
 const openWork=requests.filter(r=>r.status!=="completed"&&r.status!=="cancelled");
 const lateWork=openWork.filter(r=>r.due_date&&r.due_date<today);
 const unassignedWork=openWork.filter(r=>!r.assigned_to);
 const errors=[ir.error,er.error,rr.error,cr.error,pr.error].filter(Boolean);
 return <main className="content"><header><div><p className="eyebrow">CALIBRATION CONTROL CENTER</p><h1>Calibration Compliance Dashboard</h1><p>Live compliance, upcoming work, certificates and technician workload.</p></div><Link className="primary" href="/workspace/instruments">Instrument register</Link></header>
 {errors.length>0&&<p role="alert" className="notice">Some dashboard data could not be loaded: {errors.map(e=>e?.message).join("; ")}</p>}
 <section className="cards" style={{marginBottom:18}}>{[["Open work orders",openWork.length],["Overdue work orders",lateWork.length],["Unassigned work orders",unassignedWork.length]].map(([label,value])=><article key={label}><div><span>{label}</span><strong>{value}</strong></div></article>)}</section><p><Link href="/workspace/requests">Manage work orders →</Link></p>
 <section className="panel intelligenceTeaser"><div><p className="eyebrow">INSTRUMENT INTELLIGENCE</p><h2>AI-assisted calibration analytics</h2><p>Explore overdue exposure, failure history and area-level risk. Generate model-backed insights from live records.</p></div><Link className="primary" href="/workspace/analytics">Open AI Analytics →</Link></section>
 <section className="cards">{[
 ["Calibration compliance",compliance+"%"],["Compliant instruments",compliant+" / "+total],["Overdue",overdue],["Due within 30 days",due30],["Due within 90 days",due90],["No due date",unscheduled],["Awaiting review",pending],["Approved calibrations",approved],["Recorded calibration failures",failedEvents]
 ].map(([label,value])=><article key={label}><div><span>{label}</span><strong>{value}</strong></div></article>)}</section>
 <p><small>Compliance = active instruments with a recorded next due date that has not passed ÷ all active instruments. Instruments without due dates count as noncompliant. Due-in-90-days includes due-in-30-days. Calibration totals reflect currently stored records, not a certified audit metric.</small></p>
 <section className="grid"><article className="panel"><h2>Calibration status</h2><div className="statusList">{["Valid","Expiring Soon","Critical","Overdue"].map(n=><div key={n}><span>{n}</span><b>{instruments.filter(i=>i.calibration_status===n).length}</b></div>)}<div><span>Unscheduled</span><b>{unscheduled}</b></div></div><p><Link href="/workspace/schedule">View calibration schedule →</Link></p></article>
 <article className="panel"><h2>Certificate compliance</h2><div className="statusList"><div><span>Certificates recorded</span><b>{certificates.length}</b></div><div><span>Expired</span><b>{expired}</b></div><div><span>Expiring within 30 days</span><b>{expiring}</b></div><div><span>No expiry date</span><b>{certificates.filter(x=>!x.expiry_date).length}</b></div></div><p><Link href="/workspace/certificate-expiry">View certificate expiry →</Link></p></article></section>
 <section className="panel" style={{marginTop:20}}><h2>Calibration activity — last six months</h2><p>Calibration records grouped by calibration date and current review status.</p><div style={{display:"flex",gap:12,alignItems:"end",height:190,overflowX:"auto",padding:"12px 0"}}>{trends.map(m=><div key={m.label} style={{flex:"1 0 55px",textAlign:"center"}}><div style={{height:145,display:"flex",alignItems:"end",justifyContent:"center",gap:3}}><div title={m.approved+" approved"} style={{background:"#16a34a",width:"40%",minHeight:m.approved?3:0,height:Math.round(m.approved/max*140)}}/><div title={m.submitted+" not approved"} style={{background:"#f59e0b",width:"40%",minHeight:m.submitted?3:0,height:Math.round(m.submitted/max*140)}}/></div><small>{m.label}</small><div><small>{m.approved} approved / {m.submitted} other</small></div></div>)}</div></section>
 <section className="grid" style={{marginTop:20}}><article className="panel"><h2>Next upcoming calibrations</h2>{upcoming.length?upcoming.map(i=><div className="due" key={i.id}><div><Link href={"/workspace/instruments/"+i.id}><b>{i.tag_no}</b></Link><span>{i.name}</span></div><div><b>{i.next_due_date}</b><span>{i.days_to_due} days left</span></div></div>):<p>No upcoming dated calibrations.</p>}</article>
 <article className="panel"><h2>Technician workload</h2>{assigned.size?<div className="statusList">{[...assigned.entries()].sort((a,b)=>b[1].total-a[1].total).map(([id,x])=><div key={id}><span>{names.get(id)??"Technician "+id.slice(0,8)}</span><b>{x.completed} / {x.total} completed</b></div>)}</div>:<p>No assigned calibration requests yet.</p>}<p><small>Completion is based on calibration request status, not approval status.</small></p><Link href="/workspace/requests">Manage assignments →</Link></article></section>
 </main>;
}