"use client";
import {useEffect,useState} from "react";
type Item={tag_no:string;name:string;next_due_date:string};
export default function OverdueReport(){
 const [items,setItems]=useState<Item[]>([]),[recipient,setRecipient]=useState(""),[loading,setLoading]=useState(true),[sending,setSending]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function refresh(){
  setLoading(true);
  try{const r=await fetch("/api/notifications/overdue-report",{cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error??"Unable to load");setItems(d.items);setRecipient(d.recipient);setError("");}
  catch(e){setError(e instanceof Error?e.message:"Unable to load");}finally{setLoading(false);}
 }
 useEffect(()=>{void refresh()},[]);
 async function send(){
  if(!window.confirm("Send one email containing all "+items.length+" overdue instruments to "+recipient+"?"))return;
  setSending(true);setMessage("");setError("");
  try{const r=await fetch("/api/notifications/overdue-report",{method:"POST"});const d=await r.json();if(!r.ok)throw Error(d.error??"Email failed");setMessage(d.message+" ("+d.count+" instruments)");}
  catch(e){setError(e instanceof Error?e.message:"Email failed");}finally{setSending(false);}
 }
 return <section className="panel" style={{marginTop:20}}><h2>Send overdue instrument report</h2><p>Send one consolidated email listing all active instruments whose calibration due date has passed.</p>{loading?<p>Checking overdue instruments…</p>:<><p><strong>{items.length}</strong> overdue instruments · Recipient: <strong>{recipient}</strong></p><div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}><button type="button" onClick={()=>void refresh()} disabled={sending}>Refresh list</button><button type="button" onClick={()=>void send()} disabled={sending||items.length===0}>{sending?"Sending…":"Send all overdue instruments"}</button></div>{items.length>0&&<details><summary>Preview all {items.length} instruments</summary><div className="tableWrap"><table><thead><tr><th>Tag</th><th>Instrument</th><th>Due date</th></tr></thead><tbody>{items.map((i,n)=><tr key={n}><td>{i.tag_no}</td><td>{i.name}</td><td>{i.next_due_date}</td></tr>)}</tbody></table></div></details>}</>}{error&&<p role="alert" className="notice">{error}</p>}{message&&<p role="status">{message}</p>}<p><small>This manual report is separate from the automatic reminder delivery ledger.</small></p></section>;
}

