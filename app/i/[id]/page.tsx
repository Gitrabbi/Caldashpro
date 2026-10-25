import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
export default async function PublicInstrument({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const db=await createClient();
 const {data,error}=await db.rpc("get_public_instrument_qr",{p_instrument_id:id});
 const item=data?.[0] as {tag_no:string;instrument_name:string;manufacturer:string|null;model:string|null;engineering_unit:string|null;range_min:number|null;range_max:number|null;accuracy:string|null;area_name:string|null;location_name:string|null;group_name:string|null;calibration_status:string;next_due_date:string|null}|undefined;
 if(error)return <main className="publicInstrument"><div className="publicInstrumentCard"><h1>Instrument information unavailable</h1><p>The public QR overview has not been configured or is temporarily unavailable. Please contact the calibration team.</p></div></main>;
 if(!item)notFound();
 const info:[string,string|number|null|undefined][]=[["Instrument tag",item.tag_no],["Instrument name",item.instrument_name],["Manufacturer",item.manufacturer],["Model",item.model],["Instrument group",item.group_name],["Plant area",item.area_name],["Location",item.location_name],["Range",item.range_min!==null||item.range_max!==null?`${item.range_min??"—"} – ${item.range_max??"—"} ${item.engineering_unit??""}`:null],["Accuracy",item.accuracy],["Calibration status",item.calibration_status],["Next calibration due",item.next_due_date]];
 return <main className="publicInstrument"><div className="publicInstrumentCard"><div className="publicInstrumentBrand">CALDASHPRO · INSTRUMENT IDENTIFICATION</div><h1>{item.tag_no}</h1><p className="publicInstrumentName">{item.instrument_name}</p><div className="publicInstrumentStatus">{item.calibration_status}</div><dl>{info.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value===null||value===undefined||value===""?"—":String(value)}</dd></div>)}</dl><p className="publicInstrumentFoot">Read-only field overview. Calibration evidence, certificates, audit records and instrument editing require authorized access.</p><Link href={"/login?next="+encodeURIComponent("/workspace/instruments/"+id)}>Staff sign in for full instrument record →</Link></div></main>
}
