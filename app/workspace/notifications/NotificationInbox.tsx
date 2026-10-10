"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
type Notice={id:string;type:string;title:string;message:string;entity_type:string|null;entity_id:string|null;read_at:string|null;created_at:string};
export default function NotificationInbox(){
 const s=useMemo(()=>createClient(),[]),[items,setItems]=useState<Notice[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[error,setError]=useState("");
 const refresh=useCallback(async()=>{setLoading(true);const {data,error}=await s.from("notifications").select("id,type,title,message,entity_type,entity_id,read_at,created_at").order("created_at",{ascending:false}).limit(100);if(error)setError(error.message);else{setError("");setItems((data??[]) as Notice[])}setLoading(false)},[s]);
 useEffect(()=>{void refresh()},[refresh]);
 async function markRead(id:string){setBusy(id);const {error}=await s.from("notifications").update({read_at:new Date().toISOString()}).eq("id",id).is("read_at",null);setBusy("");if(error)setError(error.message);else setItems(xs=>xs.map(x=>x.id===id?{...x,read_at:new Date().toISOString()}:x))}
 async function markAll(){setBusy("all");const ids=items.filter(x=>!x.read_at).map(x=>x.id);if(!ids.length){setBusy("");return}const {error}=await s.from("notifications").update({read_at:new Date().toISOString()}).in("id",ids).is("read_at",null);setBusy("");if(error)setError(error.message);else await refresh()}
 const unread=items.filter(x=>!x.read_at).length;
 return <section className="panel" style={{marginBottom:22}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><h2>Notification inbox</h2><p>{unread} unread of {items.length} recent notifications</p></div><div><button type="button" disabled={!!busy||unread===0} onClick={markAll}>Mark all as read</button> <button type="button" disabled={!!busy} onClick={refresh}>Refresh</button></div></div>
 {error&&<p role="alert" className="notice">{error}</p>}
 {loading?<p>Loading inbox…</p>:items.length?<div className="tableWrap"><table><thead><tr><th>Status</th><th>Notification</th><th>Received</th><th>Action</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td>{x.read_at?"Read":"Unread"}</td><td><strong>{x.title}</strong><p>{x.message}</p></td><td>{new Date(x.created_at).toLocaleString("en-GB")}</td><td>{x.entity_type==="instrument"&&x.entity_id&&<Link href={"/workspace/instruments/"+x.entity_id}>View instrument</Link>}{x.entity_type==="certificate"&&<Link href="/workspace/certificates">View certificates</Link>}{!x.read_at&&<button type="button" disabled={!!busy} onClick={()=>markRead(x.id)} style={{marginLeft:8}}>{busy===x.id?"Saving…":"Mark read"}</button>}</td></tr>)}</tbody></table></div>:<p>No notifications have been delivered to your inbox yet.</p>}
 <p><small>This inbox displays notifications stored in Supabase. The daily scheduler must be enabled separately to generate new reminders automatically.</small></p></section>;
}