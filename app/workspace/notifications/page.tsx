import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
export const dynamic="force-dynamic";
type Instrument={id:string;tag_no:string;name:string;next_due_date:string|null;state:string};
type Cert={id:string;certificate_no:string|null;expiry_date:string|null;instrument_id:string|null};
const days=(date:string,today:string)=>Math.round((Date.parse(date+"T00:00:00Z")-Date.parse(today+"T00:00:00Z"))/86400000);
export default async function Notifications(){
 const s=await createClient(),today=new Date().toISOString().slice(0,10);
 const [i,c]=await Promise.all([s.from("instrument_calibration_status").select("id,tag_no,name,next_due_date,state").eq("state","active"),s.from("certificates").select("id,certificate_no,expiry_date,instrument_id")]);
 const instruments=(i.data??[]) as Instrument[],certs=(c.data??[]) as Cert[];
 const alerts=[
 ...instruments.filter(x=>x.next_due_date&&days(x.next_due_date,today)<=30).map(x=>({key:"i-"+x.id,type:"Calibration",title:x.tag_no+" — "+x.name,date:x.next_due_date!,link:"/workspace/instruments/"+x.id,delta:days(x.next_due_date!,today)})),
 ...certs.filter(x=>x.expiry_date&&days(x.expiry_date,today)<=30).map(x=>({key:"c-"+x.id,type:"Certificate",title:x.certificate_no??"Certificate without number",date:x.expiry_date!,link:"/workspace/certificates",delta:days(x.expiry_date!,today)}))
 ].sort((a,b)=>a.delta-b.delta);
 const overdue=alerts.filter(x=>x.delta<0).length,soon=alerts.filter(x=>x.delta>=0).length;
 return <main className="content"><header><div><p className="eyebrow">ACTION CENTER</p><h1>Notifications</h1><p>Live calibration and certificate deadline alerts.</p></div><Link href="/workspace/schedule">Calibration schedule →</Link></header>
 {(i.error||c.error)&&<div className="notice" role="alert">{i.error?.message??c.error?.message}</div>}
 <section className="cards"><article><div><span>Past due</span><strong>{overdue}</strong></div></article><article><div><span>Due within 30 days</span><strong>{soon}</strong></div></article><article><div><span>Total alerts</span><strong>{alerts.length}</strong></div></article></section>
 <p><small>These alerts are calculated live whenever this page is opened. They are not push notifications or messages sent in the background. Dates use UTC for consistent day calculations.</small></p>
 <section className="panel tablePanel">{alerts.length?<div className="tableWrap"><table><thead><tr><th>Priority</th><th>Type</th><th>Item</th><th>Deadline</th><th>Action</th></tr></thead><tbody>{alerts.map(a=><tr key={a.key}><td><span className={"status "+(a.delta<0?"overdue":"due_soon")}>{a.delta<0?Math.abs(a.delta)+" days overdue":a.delta===0?"Due today":a.delta+" days remaining"}</span></td><td>{a.type}</td><td><b>{a.title}</b></td><td>{a.date}</td><td><Link href={a.link}>Review →</Link></td></tr>)}</tbody></table></div>:<div className="empty">No upcoming or overdue deadlines in the current records.</div>}</section>
 <section className="panel" style={{marginTop:20}}><h2>Notification delivery</h2><p>Email, Telegram and scheduled reminders are not enabled yet. This page does not send alerts automatically.</p></section>
 </main>;
}