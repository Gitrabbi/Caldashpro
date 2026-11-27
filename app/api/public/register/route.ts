import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const dynamic="force-dynamic";
type Ref={id:string;name:string};
type Row={id:string;area_id:string|null;location_id:string|null;instrument_group_id:string|null};
export async function GET(){try{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw Error();
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const rows:Row[]=[];
 for(let offset=0;;offset+=500){
 const {data,error}=await db.from("instrument_calibration_status").select("id,tag_no,name,manufacturer,model,state,calibration_status,last_calibration_date,next_due_date,calibration_interval_months,area_id,location_id,instrument_group_id").order("id").range(offset,offset+499);
 if(error)throw error;rows.push(...(data??[]));if(!data||data.length<500)break;
 }
 const [a,l,g]=await Promise.all([db.from("areas").select("id,name"),db.from("locations").select("id,name"),db.from("instrument_groups").select("id,name")]);
 const lookup=(refs:Ref[]|null,id:string|null)=>refs?.find(x=>x.id===id)?.name??null;
 return NextResponse.json(rows.map(r=>({...r,area:lookup(a.data,r.area_id),location:lookup(l.data,r.location_id),group:lookup(g.data,r.instrument_group_id)})),{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Register unavailable."},{status:503});}}
