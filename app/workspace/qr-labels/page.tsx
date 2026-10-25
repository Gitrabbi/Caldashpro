"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {QRCodeSVG} from "qrcode.react";
import {createClient} from "@/lib/supabase/client";

type Instrument={id:string;tag_no:string;name:string;area_id:string|null;location_id:string|null;calibration_status:string|null;state:string|null};
type Ref={id:string;name:string;area_id?:string|null};
type Label={instrument_id:string;printed_at:string|null;print_count:number};
export default function QRLabels(){
 const db=useMemo(()=>createClient(),[]);
 const [instruments,setInstruments]=useState<Instrument[]>([]);
 const [areas,setAreas]=useState<Ref[]>([]),[locations,setLocations]=useState<Ref[]>([]);
 const [labels,setLabels]=useState<Label[]>([]),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [search,setSearch]=useState(""),[area,setArea]=useState(""),[location,setLocation]=useState(""),[status,setStatus]=useState("All"),[printFilter,setPrintFilter]=useState("All");
 const [selected,setSelected]=useState<string[]>([]),[printMode,setPrintMode]=useState(false);
 const [origin,setOrigin]=useState(""),[marking,setMarking]=useState(false);
 useEffect(()=>{setOrigin(window.location.origin)},[]);
 useEffect(()=>{void(async()=>{
 const [i,a,l,q]=await Promise.all([
 db.from("instrument_calibration_status").select("id,tag_no,name,area_id,location_id,calibration_status,state").order("tag_no").limit(5000),
 db.from("areas").select("id,name").order("name"),
 db.from("locations").select("id,name,area_id").order("name"),
 db.from("instrument_qr_labels").select("instrument_id,printed_at,print_count").limit(5000)
 ]);
 setInstruments(i.data??[]);setAreas(a.data??[]);setLocations(l.data??[]);setLabels(q.data??[]);
 setError([i.error,a.error,l.error,q.error].filter(Boolean).map(e=>e?.message).join("; "));
 setLoading(false);
 })()},[db]);
 const labelMap=useMemo(()=>new Map(labels.map(x=>[x.instrument_id,x])),[labels]);
 const filtered=instruments.filter(i=>(i.tag_no+" "+i.name).toLowerCase().includes(search.toLowerCase())&&(!area||i.area_id===area)&&(!location||i.location_id===location)&&(status==="All"||i.calibration_status===status)&&(printFilter==="All"||(printFilter==="Never printed"?!labelMap.get(i.id)?.printed_at:!!labelMap.get(i.id)?.printed_at)));
 const chosen=filtered.filter(i=>selected.includes(i.id));
 const printable=chosen.length?chosen:filtered;
 const missing=instruments.filter(i=>!labelMap.get(i.id)?.printed_at).length;
 const url=(id:string)=>origin+"/workspace/instruments/"+encodeURIComponent(id);
 function printLabels(){if(!printable.length)return;setPrintMode(true);setNotice("Print preview ready. Use your browser Print option and choose Save as PDF or a printer.");setTimeout(()=>window.print(),350)}
 async function markPrinted(){if(!printable.length||marking)return;const ids=printable.map(x=>x.id);if(!window.confirm("Confirm that "+ids.length+" labels were actually printed or saved for printing?"))return;setMarking(true);const {error:err}=await db.rpc("mark_instrument_qr_printed",{p_instrument_ids:ids});if(err){setNotice(err.message)}else{const q=await db.from("instrument_qr_labels").select("instrument_id,printed_at,print_count").limit(5000);if(q.data)setLabels(q.data);setNotice("Print status recorded for "+ids.length+" instruments.")}setMarking(false)}
 return <main className="content qrManager">
 <header className="qrScreenOnly"><div><p className="eyebrow">FIELD IDENTIFICATION · LIVE WORKSPACE</p><h1>Instrument QR Labels</h1><p>Scan a label to open that instrument's live information and calibration history.</p></div><Link href="/workspace/instruments">← Instrument register</Link></header>
 {error&&<p role="alert" className="notice qrScreenOnly">{error.includes("instrument_qr_labels")?"QR registry is not configured. Run supabase/manual/instrument_qr_labels.sql in CalDashPro Supabase. "+error:error}</p>}
 <section className="cards qrScreenOnly"><article><div><span>Live instruments</span><strong>{instruments.length}</strong></div></article><article><div><span>Not yet printed</span><strong>{missing}</strong></div></article><article><div><span>Printed labels</span><strong>{instruments.length-missing}</strong></div></article><article><div><span>Filtered results</span><strong>{filtered.length}</strong></div></article></section>
 <section className="panel qrScreenOnly"><h2>Find and prepare labels</h2><div className="qrFilters">
 <label>Search<input placeholder="Tag or instrument name" value={search} onChange={e=>setSearch(e.target.value)}/></label>
 <label>Area<select value={area} onChange={e=>{setArea(e.target.value);setLocation("")}}><option value="">All areas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
 <label>Location<select value={location} onChange={e=>setLocation(e.target.value)}><option value="">All locations</option>{locations.filter(l=>!area||l.area_id===area).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
 <label>Calibration status<select value={status} onChange={e=>setStatus(e.target.value)}>{["All","Valid","Expiring Soon","Critical","Overdue","No Due Date"].map(s=><option key={s}>{s}</option>)}</select></label>
 <label>QR label status<select value={printFilter} onChange={e=>setPrintFilter(e.target.value)}>{["All","Never printed","Previously printed"].map(s=><option key={s}>{s}</option>)}</select></label>
 </div><p><small>QR codes are available automatically for every instrument, including newly registered instruments. “Never printed” identifies instruments without a recorded print confirmation, not missing QR images.</small></p>
 <div className="qrActions"><button type="button" onClick={()=>setSelected([...new Set([...selected,...filtered.map(i=>i.id)])])}>Select all filtered</button><button type="button" className="secondary" onClick={()=>setSelected([])}>Clear selection</button><button type="button" onClick={printLabels} disabled={loading||!printable.length}>Print / Save PDF ({printable.length})</button><button type="button" className="secondary" onClick={markPrinted} disabled={marking||!printable.length||!!error}>{marking?"Recording…":"Mark as printed"}</button></div>
 {notice&&<p role="status">{notice}</p>}
 <p><small>{selected.length?"Printing selected instruments that match the current filters.":"No selection: printing all filtered instruments."} Use 100% scale and test a label with your phone before printing a full batch.</small></p></section>
 <section className="qrLabelGrid" aria-label="Printable QR instrument labels">
 {loading?<p>Loading instruments…</p>:printable.length===0?<p className="qrScreenOnly">No instruments match your filters.</p>:printable.map(i=><article className="qrLabel" key={i.id}>
 <div className="qrSelect qrScreenOnly"><label><input type="checkbox" checked={selected.includes(i.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,i.id]:old.filter(x=>x!==i.id))}/> Select label</label><span>{labelMap.get(i.id)?.printed_at?"Printed":"Not printed"}</span></div>
 <div className="qrLabelBody"><div className="qrCode">{origin&&<QRCodeSVG value={url(i.id)} size={124} level="H" marginSize={1} bgColor="#ffffff" fgColor="#111827"/>}</div><div className="qrLabelInfo"><b className="qrBrand">CalDashPro</b><strong>{i.tag_no}</strong><span>{i.name}</span><small>Scan for instrument information</small><Link className="qrScreenOnly" href={"/workspace/instruments/"+i.id}>View instrument →</Link></div></div>
 </article>)}
 </section><style jsx global>{`
 .qrFilters{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.qrFilters label{display:grid;gap:5px;font-size:12px}.qrActions{display:flex;gap:10px;flex-wrap:wrap;margin:15px 0}.qrLabelGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px;margin:18px 0}.qrLabel{background:#fff;color:#111827;border:1px solid #9aa4b2;border-radius:10px;break-inside:avoid;padding:12px;min-width:0}.qrSelect{display:flex;justify-content:space-between;align-items:center;font-size:11px;margin-bottom:10px;color:#243447}.qrLabelBody{display:flex;gap:12px;align-items:center}.qrCode{flex:none;background:white}.qrLabelInfo{display:flex;flex-direction:column;gap:5px;min-width:0;overflow-wrap:anywhere}.qrLabelInfo strong{font-size:17px;color:#101828}.qrLabelInfo span{font-size:12px;color:#263445}.qrLabelInfo small{font-size:9px;color:#526073}.qrBrand{font-size:11px;color:#176985}.qrManager .qrLabelInfo a{font-size:11px;color:#155a91!important}
 @media print{@page{size:A4;margin:9mm}html,body{background:white!important;color:black!important}.shell{display:block!important;background:white!important}.shell .workspaceSidebar,.shell .mobileMenu,.shell .navBackdrop,.qrScreenOnly{display:none!important}.shell .content.qrManager{display:block!important;padding:0!important;margin:0!important;background:white!important;width:100%!important;max-width:none!important}.qrLabelGrid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:4mm!important;margin:0!important}.qrLabel{border:1px solid #333!important;box-shadow:none!important;border-radius:2mm!important;padding:3mm!important;min-height:40mm!important}.qrLabelInfo strong,.qrLabelInfo span,.qrLabelInfo small,.qrBrand{color:black!important}.qrLabelInfo strong{font-size:13pt!important}.qrLabelInfo span{font-size:9pt!important}.qrLabelBody{gap:3mm!important}}
 `}</style></main>
}
