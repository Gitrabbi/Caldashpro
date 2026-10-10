import NotificationInbox from "./NotificationInbox";
import NotificationList, {type Alert} from "./NotificationList";
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
 ...instruments.filter(x=>x.next_due_date&&days(x.next_due_date,today)<=90).map(x=>({key:"i-"+x.id,type:"Calibration" as const,title:x.tag_no+" — "+x.name,date:x.next_due_date!,link:"/workspace/instruments/"+x.id,delta:days(x.next_due_date!,today)})),
 ...certs.filter(x=>x.expiry_date&&days(x.expiry_date,today)<=90).map(x=>({key:"c-"+x.id,type:"Certificate" as const,title:x.certificate_no??"Certificate without number",date:x.expiry_date!,link:"/workspace/certificates",delta:days(x.expiry_date!,today)}))
 ].sort((a,b)=>a.delta-b.delta);
 
 return <main className="content"><header><div><p className="eyebrow">ACTION CENTER</p><h1>Notifications</h1><p>Live calibration and certificate deadline alerts.</p></div><Link href="/workspace/schedule">Calibration schedule →</Link></header>
 {(i.error||c.error)&&<div className="notice" role="alert">{i.error?.message??c.error?.message}</div>}
 <NotificationInbox/>
 <NotificationList alerts={alerts as Alert[]}/>
 <section className="panel" style={{marginTop:20}}><h2>Notification delivery</h2><p>Email, Telegram and scheduled reminders are not enabled yet. This page does not send alerts automatically.</p></section>
 </main>;
}