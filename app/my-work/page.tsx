"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
import {createClient} from "@/lib/supabase/client";
type Job={id:string;due_date:string|null;priority:string;status:string;notes:string|null;assigned_to:string|null;instruments:{tag_no:string;name:string}|{tag_no:string;name:string}[]|null};
const today=()=>new Date().toISOString().slice(0,10);
export default function MyWork(){
 const s=useMemo(()=>createClient(),[]);
 const [jobs,setJobs]=useState<Job[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[filter,setFilter]=useState("active");
 const load=useCallback(async()=>{
  setLoading(true);
  const {data:{user},error:authError}=await s.auth.getUser();
  if(authError||!user){setError("Sign in to view your assigned calibration work.");setJobs([]);setLoading(false);return;}
  const {data,error}=await s.from("calibration_requests").select("id,due_date,priority,status,notes,assigned_to,instruments(tag_no,name)").eq("assigned_to",user.id).order("due_date",{ascending:true,nullsFirst:false}).limit(500);
  if(error){setError(error.message);setJobs([]);}else{setError("");setJobs((data??[]) as Job[]);}
  setLoading(false);
 },[s]);
 useEffect(()=>{void load()},[load]);
 const active=jobs.filter(j=>!["completed","cancelled"].includes(j.status));
 const overdue=active.filter(j=>j.due_date&&j.due_date<today()).length;
 const dueSoon=active.filter(j=>j.due_date&&j.due_date>=today()&&j.due_date<=new Date(Date.now()+7*86400000).toISOString().slice(0,10)).length;
 const visible=filter==="active"?active:filter==="overdue"?active.filter(j=>j.due_date&&j.due_date<today()):filter==="completed"?jobs.filter(j=>j.status==="completed"):jobs;
 return <main className="content"><header><div><p className="eyebrow">TECHNICIAN WORKSPACE</p><h1>My Work</h1><p>Calibration work orders assigned to your account.</p></div><button type="button" onClick={()=>void load()} disabled={loading}>Refresh</button></header>
 {error&&<div className="notice" role="alert">{error}</div>}
 <section className="cards"><article><div><span>Active assignments</span><strong>{loading?"…":active.length}</strong></div></article><article><div><span>Overdue</span><strong>{loading?"…":overdue}</strong></div></article><article><div><span>Due within 7 days</span><strong>{loading?"…":dueSoon}</strong></div></article></section>
 <section className="panel tablePanel" style={{marginTop:18}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><h2>My calibration queue</h2><label>Show <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="active">Active</option><option value="overdue">Overdue</option><option value="completed">Completed</option><option value="all">All assigned</option></select></label></div>
  {loading?<p>Loading assigned work…</p>:visible.length?<div className="tableWrap"><table><thead><tr><th>Instrument</th><th>Due date</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map(j=>{const i=Array.isArray(j.instruments)?j.instruments[0]:j.instruments;const late=j.due_date&&j.due_date<today()&&!["completed","cancelled"].includes(j.status);return <tr key={j.id}><td><strong>{i?.tag_no??"Unknown instrument"}</strong><small className="cellSub">{i?.name??""}</small></td><td>{j.due_date??"Not set"} {late&&<span className="status overdue">Overdue</span>}</td><td>{j.priority}</td><td>{j.status.replaceAll("_"," ")}</td><td>{!["completed","cancelled"].includes(j.status)?<Link href={"/workspace/calibrate/"+j.id}>Open work order →</Link>:"—"}</td></tr>})}</tbody></table></div>:<div className="empty">No work orders match this filter.</div>}
 </section></main>;
}
