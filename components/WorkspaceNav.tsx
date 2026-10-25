"use client";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {useEffect,useState} from "react";

const liveItems=[
 ["Dashboard","/workspace"],
 ["Instruments","/workspace/instruments"],
 ["QR Labels","/workspace/qr-labels"],
 ["AI Analytics","/workspace/analytics"],
 ["Calibration Schedule","/workspace/schedule"],
 ["Calibration Requests","/workspace/requests"],
 ["Calibration Review","/workspace/reviews"],
 ["Calibration Activity","/workspace/activity"],
 ["Audit Trail","/workspace/audit"],
 ["Certificates","/workspace/certificates"],
 ["Reference Standards","/workspace/standards"],
 ["Certificate Expiry","/workspace/certificate-expiry"],
 ["Notifications","/workspace/notifications"],
 ["Reports","/workspace/reports"],
 ["Settings","/workspace/settings"],
] as const;
export default function WorkspaceNav({name,role}:{name:string;role:string}){
 const [open,setOpen]=useState(false);
 const path=usePathname(),router=useRouter();
 const demo=path.startsWith("/workspace/demo");
 useEffect(()=>{setOpen(false)},[path]);
 return <>
 <button className="mobileMenu" type="button" aria-label="Open navigation" aria-expanded={open} onClick={()=>setOpen(true)}>☰</button>
 {open&&<button className="navBackdrop" type="button" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
 <aside className={"workspaceSidebar"+(open?" isOpen":"")} aria-label="Workspace navigation">
  <div className="navTop">
   <Link href={demo?"/workspace/demo":"/workspace"} className="logo"><b>C</b><span>CalDashPro</span></Link>
   <button className="navClose" type="button" aria-label="Close navigation" onClick={()=>setOpen(false)}>×</button>
  </div>
  <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border,#dce3eb)"}}>
   <label htmlFor="workspace-environment" style={{display:"block",fontSize:12,fontWeight:700,marginBottom:6}}>OPERATING ENVIRONMENT</label>
   <select id="workspace-environment" aria-label="Switch Live or Demo environment" value={demo?"demo":"live"} onChange={e=>{setOpen(false);router.push(e.target.value==="demo"?"/workspace/demo":"/workspace")}} style={{width:"100%",padding:"10px",borderRadius:8,fontWeight:700}}>
    <option value="live">🟢 Live workspace</option>
    <option value="demo">🟣 Demo workspace</option>
   </select>
   <small style={{display:"block",marginTop:6}}>{demo?"Practice records only — separate demo tables":"Production calibration records"}</small>
  </div>
  <nav>{demo?
   <Link href="/workspace/demo" className="active"><span className="dot"/>Demo Dashboard</Link>
   :liveItems.map(([label,href])=><Link href={href} key={href} className={path===href?"active":""}><span className="dot"/>{label}</Link>)}</nav>
  <div className="usercard"><b>{name}</b><span>{role}</span></div>
 </aside>
 </>;
}
