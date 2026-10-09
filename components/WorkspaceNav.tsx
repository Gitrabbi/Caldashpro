"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useState} from "react";

const items=[
  ["Dashboard","/workspace"],
  ["Instruments","/workspace/instruments"],
  ["Calibration Schedule","/workspace/schedule"],
  ["Calibration Requests","/workspace/requests"],
  ["Calibration Review","/workspace/reviews"],
  ["Calibration Activity","/workspace/activity"],
  ["Certificates","/workspace/certificates"],
  ["Settings","/workspace/settings"],
] as const;

export default function WorkspaceNav({name,role}:{name:string;role:string}){
  const [open,setOpen]=useState(false);
  const path=usePathname();
  useEffect(()=>{setOpen(false)},[path]);
  return <>
    <button className="mobileMenu" type="button" aria-label="Open navigation" aria-expanded={open} onClick={()=>setOpen(true)}>☰</button>
    {open&&<button className="navBackdrop" type="button" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
    <aside className={"workspaceSidebar"+(open?" isOpen":"")} aria-label="Workspace navigation">
      <div className="navTop">
        <Link href="/workspace" className="logo"><b>C</b><span>CalDashPro</span></Link>
        <button className="navClose" type="button" aria-label="Close navigation" onClick={()=>setOpen(false)}>×</button>
      </div>
      <nav>{items.map(([label,href])=><Link href={href} key={href} className={path===href?"active":""}><span className="dot"/>{label}</Link>)}</nav>
      <div className="usercard"><b>{name}</b><span>{role}</span></div>
    </aside>
  </>;
}