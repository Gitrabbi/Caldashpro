import ExcelJS from "exceljs";
import tls from "node:tls";
import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export function smtpSend({user,password,to,subject,body,attachment}:{user:string;password:string;to:string;subject:string;body:string;attachment?:{filename:string;content:Buffer;contentType:string}}):Promise<void>{
 return new Promise((resolve,reject)=>{
  const socket=tls.connect({host:"smtp.gmail.com",port:465,servername:"smtp.gmail.com",rejectUnauthorized:true});
  socket.setTimeout(20000);
  let buffer="",pending:{resolve:(value:string)=>void;reject:(reason:Error)=>void}|null=null;
  let responseLines:string[]=[];
  const fail=(e:Error)=>{if(pending){pending.reject(e);pending=null}socket.destroy();reject(e)};
  socket.on("error",fail);socket.on("timeout",()=>fail(new Error("SMTP timeout")));
  socket.on("data",chunk=>{
   buffer+=chunk.toString("utf8");let index;
   while((index=buffer.indexOf("\r\n"))>=0){
    const line=buffer.slice(0,index);buffer=buffer.slice(index+2);
    if(!/^\d{3}[ -]/.test(line))continue;
    responseLines.push(line);
    if(line[3]==="-" )continue;
    const response=responseLines.join("\n");responseLines=[];
    if(pending){const p=pending;pending=null;p.resolve(response)}
   }
  });
  const command=(value:string|null,expected:number[])=>new Promise<string>((ok,no)=>{
   pending={resolve:(response)=>{const code=Number(response.slice(0,3));if(expected.includes(code))ok(response);else no(new Error("SMTP error "+code))},reject:no};
   if(value!==null)socket.write(value+"\r\n");
  });
  const clean=(v:string)=>v.replace(/[\r\n]/g," ");
  (async()=>{
   await command(null,[220]);
   await command("EHLO caldashpro.vercel.app",[250]);
   await command("AUTH LOGIN",[334]);
   await command(Buffer.from(user).toString("base64"),[334]);
   await command(Buffer.from(password).toString("base64"),[235]);
   await command("MAIL FROM:<"+clean(user)+">",[250]);
   await command("RCPT TO:<"+clean(to)+">",[250,251]);
   await command("DATA",[354]);
   const encodedSubject="=?UTF-8?B?"+Buffer.from(subject).toString("base64")+"?=";
   const baseHeaders=["From: "+clean(user),"To: "+clean(to),"Subject: "+encodedSubject,"MIME-Version: 1.0"];
   const encodedBody=Buffer.from(body).toString("base64").match(/.{1,76}/g)?.join("\r\n")??"";
   let message:string;
   if(attachment){
    const boundary="caldashpro_"+Date.now().toString(36);
    const filename=attachment.filename.replace(/[^a-zA-Z0-9._-]/g,"_");
    const encodedFile=attachment.content.toString("base64").match(/.{1,76}/g)?.join("\r\n")??"";
    message=[...baseHeaders,'Content-Type: multipart/mixed; boundary="'+boundary+'"',"","--"+boundary,"Content-Type: text/plain; charset=UTF-8","Content-Transfer-Encoding: base64","",encodedBody,"--"+boundary,"Content-Type: "+attachment.contentType+'; name="'+filename+'"','Content-Disposition: attachment; filename="'+filename+'"',"Content-Transfer-Encoding: base64","",encodedFile,"--"+boundary+"--"].join("\r\n");
   }else{
    message=[...baseHeaders,"Content-Type: text/plain; charset=UTF-8","Content-Transfer-Encoding: base64","",encodedBody].join("\r\n");
   }
   await command(message+"\r\n.",[250]);
   await command("QUIT",[221]);socket.end();resolve();
  })().catch(fail);
 });
}

type Notice={id:string;recipient_id:string;title:string;message:string;created_at:string;entity_type:string|null;entity_id:string|null;type:string};
type Details={tag:string;name:string;area:string;group:string;location:string;due:string};
type DB=ReturnType<typeof createClient>;
async function lookup(db:DB,notices:Notice[]){
 const instrumentIds=[...new Set(notices.filter(n=>n.entity_type==="instrument"&&n.entity_id).map(n=>n.entity_id!))];
 const requestIds=[...new Set(notices.filter(n=>n.entity_type==="calibration_request"&&n.entity_id).map(n=>n.entity_id!))];
 const certificateIds=[...new Set(notices.filter(n=>n.entity_type==="certificate"&&n.entity_id).map(n=>n.entity_id!))];
 const [requests,certificates]=await Promise.all([
  requestIds.length?db.from("calibration_requests").select("id,instrument_id,due_date").in("id",requestIds):Promise.resolve({data:[],error:null}),
  certificateIds.length?db.from("certificates").select("id,instrument_id,expiry_date").in("id",certificateIds):Promise.resolve({data:[],error:null})
 ]);
 if(requests.error||certificates.error)throw Error("Failed to load report references");
 const reqMap=new Map((requests.data??[]).map(x=>[x.id,x]));
 const certMap=new Map((certificates.data??[]).map(x=>[x.id,x]));
 const allIds=[...new Set([...instrumentIds,...(requests.data??[]).map(x=>x.instrument_id),...(certificates.data??[]).map(x=>x.instrument_id)].filter((x):x is string=>!!x))];
 const [instruments,areas,groups,locations]=await Promise.all([
  allIds.length?db.from("instrument_calibration_status").select("id,tag_no,name,next_due_date,area_id,instrument_group_id,location_id").in("id",allIds):Promise.resolve({data:[],error:null}),
  db.from("areas").select("id,name"),db.from("instrument_groups").select("id,name"),db.from("locations").select("id,name")
 ]);
 if(instruments.error||areas.error||groups.error||locations.error)throw Error("Failed to load instrument metadata");
 const im=new Map((instruments.data??[]).map(x=>[x.id,x]));
 const am=new Map((areas.data??[]).map(x=>[x.id,x.name]));
 const gm=new Map((groups.data??[]).map(x=>[x.id,x.name]));
 const lm=new Map((locations.data??[]).map(x=>[x.id,x.name]));
 const details=new Map<string,Details>();
 for(const n of notices){
  const req=n.entity_type==="calibration_request"?reqMap.get(n.entity_id??""):undefined;
  const cert=n.entity_type==="certificate"?certMap.get(n.entity_id??""):undefined;
  const instrumentId=n.entity_type==="instrument"?n.entity_id:req?.instrument_id??cert?.instrument_id;
  const inst=im.get(instrumentId??"");
  details.set(n.id,{tag:inst?.tag_no??"—",name:inst?.name??"—",area:am.get(inst?.area_id??"")??"Unassigned",group:gm.get(inst?.instrument_group_id??"")??"Unassigned",location:lm.get(inst?.location_id??"")??"Unassigned",due:req?.due_date??cert?.expiry_date??inst?.next_due_date??""});
 }
 return details;
}
async function spreadsheet(notices:Notice[],details:Map<string,Details>){
 const wb=new ExcelJS.Workbook();wb.creator="CalDashPro";wb.created=new Date();
 const sheets:[string,(n:Notice)=>boolean][]=[
  ["Overdue calibrations",n=>n.entity_type==="instrument"&&n.type==="overdue"],
  ["Upcoming calibrations",n=>n.entity_type==="instrument"&&n.type!=="overdue"],
  ["Certificate expiries",n=>n.entity_type==="certificate"],
  ["Work order escalations",n=>n.entity_type==="calibration_request"]
 ];
 for(const [name,test] of sheets){
  const entries=notices.filter(test);if(!entries.length)continue;
  const ws=wb.addWorksheet(name,{views:[{state:"frozen",ySplit:1}]});
  ws.addRow(["Instrument Tag","Instrument Name","Area","Group","Location","Due Date","Days Overdue","Alert","Message"]);
  ws.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};
  ws.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF183153"}};
  for(const n of entries){
   const d=details.get(n.id)!;
   const days=d.due?Math.max(0,Math.floor((Date.parse(new Date().toISOString().slice(0,10)+"T00:00:00Z")-Date.parse(d.due+"T00:00:00Z"))/86400000)):0;
   ws.addRow([d.tag,d.name,d.area,d.group,d.location,d.due,days,n.title,n.message]);
  }
  ws.columns=[{width:20},{width:35},{width:23},{width:24},{width:24},{width:18},{width:17},{width:30},{width:65}];
  ws.autoFilter={from:{row:1,column:1},to:{row:entries.length+1,column:9}};
 }
 // Unclassified notifications are included rather than silently dropped.
 const others=notices.filter(n=>!sheets.some(([,test])=>test(n)));
 if(others.length){const ws=wb.addWorksheet("Other alerts");ws.addRow(["Type","Title","Message","Received"]);for(const n of others)ws.addRow([n.type,n.title,n.message,n.created_at]);ws.columns=[{width:20},{width:36},{width:70},{width:26}];}
 return Buffer.from(await wb.xlsx.writeBuffer());
}
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Unauthorized"},{status:401});
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY,mailUser=process.env.SMTP_USER,mailPassword=process.env.SMTP_PASSWORD;
 if(!key||!mailUser||!mailPassword||!process.env.NEXT_PUBLIC_SUPABASE_URL)return NextResponse.json({error:"Email delivery environment is not configured"},{status:503});
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{autoRefreshToken:false,persistSession:false}});
 // Scan in pages; never send a separate message per notification.
 const candidates:Notice[]=[];
 for(let from=0;from<10000;from+=500){
  const {data,error}=await db.from("notifications").select("id,recipient_id,title,message,created_at,entity_type,entity_id,type").order("created_at",{ascending:false}).range(from,from+499);
  if(error)return NextResponse.json({error:"Notification query failed"},{status:500});
  candidates.push(...(data??[]) as Notice[]);
  if((data??[]).length<500)break;
 }
 const recipients=new Map<string,Notice[]>();
 for(const n of candidates)recipients.set(n.recipient_id,[...(recipients.get(n.recipient_id)??[]),n]);
 let emailsSent=0,emailsFailed=0,notificationsSent=0,skipped=0;
 for(const [recipientId,notices] of recipients){
  const {data:pref}=await db.from("notification_preferences").select("email_enabled").eq("user_id",recipientId).maybeSingle();
  if(pref?.email_enabled!==true){skipped+=notices.length;continue;}
  const ids=notices.map(n=>n.id);
  const delivered=new Set<string>();
  for(let k=0;k<ids.length;k+=300){
   const {data,error}=await db.from("notification_email_deliveries").select("notification_id").in("notification_id",ids.slice(k,k+300));
   if(error)return NextResponse.json({error:"Delivery ledger unavailable"},{status:500});
   for(const row of data??[])delivered.add(row.notification_id);
  }
  const pending=notices.filter(n=>!delivered.has(n.id));
  skipped+=notices.length-pending.length;
  if(!pending.length)continue;
  const {data:authUser,error:userError}=await db.auth.admin.getUserById(recipientId);
  if(userError||!authUser.user?.email){emailsFailed++;continue;}
  // Claim the whole batch before SMTP to prevent concurrent cron invocations duplicating emails.
  const {data:claims,error:claimError}=await db.from("notification_email_deliveries").upsert(
   pending.map(n=>({notification_id:n.id,recipient_id:recipientId,status:"pending"})),{onConflict:"notification_id",ignoreDuplicates:true}
  ).select("notification_id");
  if(claimError){emailsFailed++;continue;}
  const claimed=new Set((claims??[]).map(x=>x.notification_id));
  const batch=pending.filter(n=>claimed.has(n.id));
  if(!batch.length)continue;
  try{
   const details=await lookup(db,batch);
   const attachment=await spreadsheet(batch,details);
   const date=new Date().toISOString().slice(0,10);
   await smtpSend({user:mailUser,password:mailPassword,to:authUser.user.email,
    subject:`CalDashPro daily calibration summary — ${batch.length} alerts (${date})`,
    body:`CalDashPro Daily Calibration Summary\n\nYou have ${batch.length} new calibration, certificate or work-order alerts.\nAll details are included in the attached Excel workbook.\n\nOpen CalDashPro: https://caldashpro.vercel.app/workspace/notifications\n\nYou can disable email reminders in your notification preferences.`,
    attachment:{filename:`CalDashPro_Daily_Alerts_${date}.xlsx`,content:attachment,contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}});
   for(let k=0;k<batch.length;k+=300){
    const {error}=await db.from("notification_email_deliveries").update({status:"sent",sent_at:new Date().toISOString(),last_error:null}).in("notification_id",batch.slice(k,k+300).map(n=>n.id));
    if(error)console.error("Email accepted but ledger update failed",error.message);
   }
   emailsSent++;notificationsSent+=batch.length;
  }catch(e){
   console.error("Consolidated email failed",e instanceof Error?e.message:"Unknown");
   for(let k=0;k<batch.length;k+=300)await db.from("notification_email_deliveries").update({status:"failed",last_error:"Consolidated delivery failed"}).in("notification_id",batch.slice(k,k+300).map(n=>n.id));
   emailsFailed++;
  }
 }
 return NextResponse.json({checked:candidates.length,emailsSent,emailsFailed,notificationsSent,skipped});
}
