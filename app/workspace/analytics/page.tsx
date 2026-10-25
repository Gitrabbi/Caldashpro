"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
type Instrument={id:string;tag_no:string;name:string;calibration_status:string|null;days_to_due:number|null;next_due_date:string|null;area_id:string|null};
type Event={instrument_id:string;result:string;review_status:string;calibration_date:string};
export default function Analytics(){
 const db=useMemo(()=>createClient(),[]);
 const [instruments,setInstruments]=useState<Instrument[]>([]);
 const [events,setEvents]=useState<Event[]>([]);
 const [areas,setAreas]=useState<{id:string;name:string}[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [analysis,setAnalysis]=useState("");
 const [aiError,setAiError]=useState("");
 const [thinking,setThinking]=useState(false);
 useEffect(()=>{void(async()=>{const [i,e,a]=await Promise.all([db.from("instrument_calibration_status").select("id,tag_no,name,calibration_status,days_to_due,next_due_date,area_id").eq("state","active").limit(2000),db.from("calibration_events").select("instrument_id,result,review_status,calibration_date").limit(3000),db.from("areas").select("id,name")]);setInstruments(i.data??[]);setEvents(e.data??[]);setAreas(a.data??[]);setError(i.error?.message??e.error?.message??a.error?.message??"");setLoading(false)})()},[db]);
 const overdue=instruments.filter(i=>i.calibration_status==="Overdue");
 const due30=instruments.filter(i=>i.days_to_due!==null&&i.days_to_due>=0&&i.days_to_due<=30);
 const unscheduled=instruments.filter(i=>!i.next_due_date);
 const priority=instruments.filter(i=>i.calibration_status==="Overdue"||(i.days_to_due!==null&&i.days_to_due<=30)).sort((a,b)=>(a.days_to_due??99999)-(b.days_to_due??99999)).slice(0,15);
 const byArea=areas.map(a=>({name:a.name,rows:instruments.filter(i=>i.area_id===a.id)})).filter(a=>a.rows.length).sort((a,b)=>b.rows.filter(x=>x.calibration_status==="Overdue").length-a.rows.filter(x=>x.calibration_status==="Overdue").length);
 async function runAI(){setThinking(true);setAiError("");setAnalysis("");try{const response=await fetch("/api/instrument-ai",{method:"POST"});const data=await response.json();if(!response.ok)throw new Error(data.error||"AI analysis unavailable");setAnalysis(data.analysis||"No analysis returned")}catch(e){setAiError(e instanceof Error?e.message:"Analysis failed")}finally{setThinking(false)}}
 return <main className="content intelligencePage">
 <header><div><p className="eyebrow">LIVE DATA · INSTRUMENT INTELLIGENCE</p><h1>Instrument AI Analytics</h1><p>Evidence-led calibration insights and model-generated recommendations.</p></div><Link className="primary" href="/workspace">Overview</Link></header>
 {error&&<p role="alert" className="notice">{error}</p>}
 {loading?<p>Loading live calibration records…</p>:<>
 <section className="cards">{[["Active instruments",instruments.length],["Overdue",overdue.length],["Due within 30 days",due30.length],["Missing due dates",unscheduled.length],["Failed calibration events",events.filter(e=>e.result==="fail").length],["Approved events",events.filter(e=>e.review_status==="approved").length]].map(([k,v])=><article key={k}><div><span>{k}</span><strong>{v}</strong></div></article>)}</section>
 <section className="panel"><h2>AI calibration intelligence</h2><p>Generate a new assessment using a real AI model and the latest available Live records. AI observations require engineering review.</p><button className="primary" disabled={thinking} onClick={runAI}>{thinking?"Analyzing records…":"Generate AI analysis"}</button>{aiError&&<p role="alert">{aiError}</p>}{analysis&&<div className="aiResponse">{analysis}</div>}</section>
 <section className="grid" style={{marginTop:20}}><article className="panel"><h2>Priority instruments</h2><p>Scheduling exposure, not predicted equipment failure.</p><div className="statusList">{priority.map(i=><div key={i.id}><Link href={"/workspace/instruments/"+i.id}>{i.tag_no} · {i.name}</Link><b>{i.days_to_due===null?"Unscheduled":i.days_to_due<0?Math.abs(i.days_to_due)+" days overdue":i.days_to_due+" days remaining"}</b></div>)}</div>{!priority.length&&<p>No overdue or due-soon instruments.</p>}</article>
 <article className="panel"><h2>Exposure by plant area</h2>{byArea.map(a=>{const n=a.rows.filter(i=>i.calibration_status==="Overdue").length;return <div key={a.name} style={{marginBottom:18}}><div className="statusList"><div><span>{a.name}</span><b>{n} / {a.rows.length} overdue</b></div></div><div className="riskTrack"><div style={{width:(n/a.rows.length*100)+"%"}}/></div></div>})}{!byArea.length&&<p>No plant area data available.</p>}</article></section>
 <p><small>Source: live Supabase calibration tables. Maximum 2,000 active instruments and 3,000 calibration events per query; large datasets may require pagination. AI is not a validated predictive-maintenance model.</small></p>
 </>}</main>;
}
