"use client";
import {useCallback,useEffect,useState} from "react";
type Item={tag_no:string;name:string;next_due_date:string;area:string;group:string;location:string};
type Option={id:string;name:string;area_id?:string};
type Options={areas:Option[];groups:Option[];locations:Option[]};
export default function OverdueReport(){
 const [items,setItems]=useState<Item[]>([]),[recipient,setRecipient]=useState("");
 const [options,setOptions]=useState<Options>({areas:[],groups:[],locations:[]});
 const [area,setArea]=useState(""),[group,setGroup]=useState(""),[location,setLocation]=useState("");
 const [loading,setLoading]=useState(true),[sending,setSending]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const refresh=useCallback(async()=>{
  setLoading(true);setMessage("");
  try{
   const params=new URLSearchParams();
   if(area)params.set("area",area);if(group)params.set("group",group);if(location)params.set("location",location);
   const r=await fetch("/api/notifications/overdue-report?"+params.toString(),{cache:"no-store"});
   const d=await r.json();if(!r.ok)throw Error(d.error??"Unable to load");
   setItems(d.items);setRecipient(d.recipient);setOptions(d.options);setError("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to load");setItems([]);}
  finally{setLoading(false);}
 },[area,group,location]);
 useEffect(()=>{void refresh()},[refresh]);
 async function send(){
  if(!window.confirm("Send Excel report for "+items.length+" matching overdue instruments to "+recipient+"?"))return;
  setSending(true);setMessage("");setError("");
  try{
   const r=await fetch("/api/notifications/overdue-report",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({area,group,location})});
   const d=await r.json();if(!r.ok)throw Error(d.error??"Email failed");
   setMessage(d.message+" ("+d.count+" instruments)");
  }catch(e){setError(e instanceof Error?e.message:"Email failed");}
  finally{setSending(false);}
 }
 return <section className="panel" style={{marginTop:20}}>
  <h2>Send overdue instrument report</h2>
  <p>Filter overdue instruments by area, group and location. Email a formatted Excel workbook containing the matching records.</p>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,margin:"16px 0"}}>
   <label>Area<select value={area} onChange={e=>{setArea(e.target.value);setLocation("");}} style={{display:"block",width:"100%"}}><option value="">All areas</option>{options.areas.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
   <label>Instrument group<select value={group} onChange={e=>setGroup(e.target.value)} style={{display:"block",width:"100%"}}><option value="">All groups</option>{options.groups.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
   <label>Location<select value={location} onChange={e=>setLocation(e.target.value)} style={{display:"block",width:"100%"}}><option value="">All locations</option>{options.locations.filter(x=>!area||x.area_id===area).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
  </div>
  {loading?<p>Checking matching overdue instruments…</p>:<><p><strong>{items.length}</strong> matching overdue instruments · Recipient: <strong>{recipient}</strong></p>
   <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
    <button type="button" onClick={()=>void refresh()} disabled={sending}>Refresh list</button>
    <button type="button" onClick={()=>void send()} disabled={sending||items.length===0}>{sending?"Sending…":"Email filtered Excel report"}</button>
   </div>
   {items.length>0&&<details><summary>Preview all {items.length} matching instruments</summary><div className="tableWrap"><table><thead><tr><th>Tag</th><th>Instrument</th><th>Area</th><th>Group</th><th>Location</th><th>Due date</th></tr></thead><tbody>{items.map((i,n)=><tr key={n}><td>{i.tag_no}</td><td>{i.name}</td><td>{i.area}</td><td>{i.group}</td><td>{i.location}</td><td>{i.next_due_date}</td></tr>)}</tbody></table></div></details>}
  </>}
  {error&&<p role="alert" className="notice">{error}</p>}{message&&<p role="status">{message}</p>}
  <p><small>The Excel report is sent to your registered email. Manual reports are separate from automatic notification statistics.</small></p>
 </section>;
}
