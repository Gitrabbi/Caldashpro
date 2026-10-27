"use client";
import {useCallback,useEffect,useState} from "react";
type RecordRow={notificationId:string;status:string;attemptedAt:string;sentAt:string|null;lastError:string|null};
type Payload={counts:{sent:number;failed:number;pending:number};lastSentAt:string|null;records:RecordRow[]};
export default function DeliveryMonitor(){
 const [data,setData]=useState<Payload|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);
  try{const r=await fetch("/api/notifications/delivery-monitor",{cache:"no-store"});const j=await r.json();if(!r.ok)throw Error(j.error??"Unable to load");setData(j);setError("");}
  catch(e){setError(e instanceof Error?e.message:"Unable to load");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load()},[load]);
 async function retry(id:string){
  if(!window.confirm("Retry this failed email to its original recipient?"))return;
  setBusy(id);setError("");
  try{const r=await fetch("/api/notifications/delivery-monitor",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({notificationId:id})});const j=await r.json();if(!r.ok)throw Error(j.error??"Retry failed");await load();}
  catch(e){setError(e instanceof Error?e.message:"Retry failed");}
  finally{setBusy("");}
 }
 const fmt=(date:string|null)=>date?new Date(date).toLocaleString("en-GB"):"—";
 return <section className="panel" style={{marginTop:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><h2>Email delivery monitor</h2><p>Administrator and manager view of automatic reminder delivery.</p></div><button type="button" onClick={()=>void load()} disabled={loading||!!busy}>Refresh status</button></div>
 {error&&<p className="notice" role="alert">{error}</p>}
 {loading?<p>Loading delivery records…</p>:data&&<><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,margin:"16px 0"}}>{([["Sent",data.counts.sent],["Failed",data.counts.failed],["Pending",data.counts.pending]] as const).map(([label,value])=><div key={label} style={{padding:14,border:"1px solid rgba(150,180,210,.25)",borderRadius:12}}><div style={{opacity:.8}}>{label}</div><strong style={{fontSize:25}}>{value}</strong></div>)}</div><p>Last successful delivery: <strong>{fmt(data.lastSentAt)}</strong></p><div className="tableWrap"><table><thead><tr><th>Status</th><th>Attempted</th><th>Sent</th><th>Details</th><th>Action</th></tr></thead><tbody>{data.records.length?data.records.map(row=><tr key={row.notificationId}><td>{row.status}</td><td>{fmt(row.attemptedAt)}</td><td>{fmt(row.sentAt)}</td><td>{row.lastError??"—"}</td><td>{row.status==="failed"&&<button type="button" disabled={!!busy} onClick={()=>void retry(row.notificationId)}>{busy===row.notificationId?"Retrying…":"Retry"}</button>}</td></tr>):<tr><td colSpan={5}>No automatic email deliveries recorded yet. Test emails are not included in this ledger.</td></tr>}</tbody></table></div><p><small>Showing the 100 most recent delivery attempts. Counts include all recorded attempts. Pending records may indicate an in-progress or interrupted send.</small></p></>}
 </section>;
}
