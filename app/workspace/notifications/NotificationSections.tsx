"use client";
import {useState} from "react";
import NotificationInbox from "./NotificationInbox";
import NotificationList,{type Alert} from "./NotificationList";
import OverdueReport from "./OverdueReport";
import DeliveryMonitor from "./DeliveryMonitor";
import TestEmailButton from "./TestEmailButton";
type Tab="inbox"|"deadlines"|"reports"|"delivery";
const tabs:{key:Tab;label:string}[]=[{key:"inbox",label:"Inbox"},{key:"deadlines",label:"Deadlines & preferences"},{key:"reports",label:"Email reports"},{key:"delivery",label:"Delivery monitor"}];
export default function NotificationSections({alerts}:{alerts:Alert[]}){
 const [tab,setTab]=useState<Tab>("inbox");
 return <div>
  <nav aria-label="Notification sections" role="tablist" style={{display:"flex",gap:8,overflowX:"auto",padding:"4px 0 12px",marginBottom:12}}>
   {tabs.map(t=><button key={t.key} type="button" role="tab" aria-selected={tab===t.key} onClick={()=>setTab(t.key)} style={{flex:"0 0 auto",padding:"10px 16px",borderRadius:10,fontWeight:tab===t.key?700:400,background:tab===t.key?"#183153":undefined,color:tab===t.key?"white":undefined}}>{t.label}</button>)}
  </nav>
  <div role="tabpanel" aria-label={tabs.find(t=>t.key===tab)?.label}>
   {tab==="inbox"&&<NotificationInbox/>}
   {tab==="deadlines"&&<NotificationList alerts={alerts}/>}
   {tab==="reports"&&<OverdueReport/>}
   {tab==="delivery"&&<><section className="panel"><h2>Email delivery settings</h2><p>Send a test email to verify Gmail connectivity.</p><TestEmailButton/></section><DeliveryMonitor/></>}
  </div>
 </div>;
}
