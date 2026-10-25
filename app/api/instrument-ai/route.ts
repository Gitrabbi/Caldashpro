import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export const runtime="nodejs";
export async function POST(req:Request){
 const db=await createClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
 const profile=await db.from("profiles").select("active,role").eq("id",user.id).maybeSingle();
 if(profile.error||!profile.data?.active)return NextResponse.json({error:"Active account required"},{status:403});
 if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:"AI model not configured. Set OPENAI_API_KEY in Vercel environment variables."},{status:503});
 const [ir,er]=await Promise.all([
  db.from("instrument_calibration_status").select("id,tag_no,name,area_id,instrument_group_id,calibration_status,days_to_due,next_due_date").eq("state","active").limit(2000),
  db.from("calibration_events").select("instrument_id,calibration_date,result,review_status").order("calibration_date",{ascending:false}).limit(3000)
 ]);
 if(ir.error||er.error)return NextResponse.json({error:ir.error?.message??er.error?.message},{status:500});
 const instruments=ir.data??[],events=er.data??[];
 const now=new Date().toISOString().slice(0,10);
 const summary={asOf:now,total:instruments.length,overdue:instruments.filter(x=>x.calibration_status==="Overdue").length,unscheduled:instruments.filter(x=>!x.next_due_date).length,
 due30:instruments.filter(x=>x.days_to_due!==null&&x.days_to_due>=0&&x.days_to_due<=30).length,
 failed:events.filter(x=>x.result==="fail").length,approved:events.filter(x=>x.review_status==="approved").length,
 instruments:instruments.map(x=>({tag:x.tag_no,name:x.name,area:x.area_id,group:x.instrument_group_id,status:x.calibration_status,daysToDue:x.days_to_due})),
 recentEvents:events.slice(0,400).map(x=>({instrumentId:x.instrument_id,date:x.calibration_date,result:x.result,review:x.review_status}))};
 const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.INSTRUMENT_AI_MODEL||"gpt-4.1-mini",store:false,max_output_tokens:1100,instructions:"You are an industrial instrumentation calibration analyst. Analyze ONLY supplied live database facts. Provide concise, practical, evidence-linked insights in plain text: priority issues, patterns, potential causes explicitly labeled hypotheses, and 3 recommended next actions. Quote actual instrument tags and figures. Clearly distinguish due-date risk from actual instrument failure probability. Do not claim predictive failure modeling or verified root causes. Never invent records. Do not recommend bypassing safety or calibration procedures.",input:JSON.stringify(summary)})});
 const body=await response.json();
 if(!response.ok)return NextResponse.json({error:"AI provider error: "+(body.error?.message??response.status)},{status:502});
 const output=(body.output??[]).flatMap((o:{content?:{type:string;text?:string}[]})=>o.content??[]).filter((x:{type:string})=>x.type==="output_text").map((x:{text?:string})=>x.text??"").join("\n");
 return NextResponse.json({analysis:output,asOf:now,sourceCount:instruments.length,eventCount:events.length});
}
