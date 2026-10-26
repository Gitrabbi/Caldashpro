"use client";
import {useState} from "react";
export default function TestEmailButton(){
 const [sending,setSending]=useState(false),[message,setMessage]=useState(""),[ok,setOk]=useState(false);
 async function send(){
  setSending(true);setMessage("");
  try{
   const response=await fetch("/api/notifications/test-email",{method:"POST",headers:{"Content-Type":"application/json"}});
   const data=await response.json();
   setOk(response.ok);setMessage(data.message??data.error??"Unexpected server response.");
  }catch{setOk(false);setMessage("Unable to connect to the email test service.");}
  finally{setSending(false);}
 }
 return <div><button type="button" disabled={sending} onClick={send}>{sending?"Sending test…":"Send test email to my account"}</button>{message&&<p role="status" className={ok?"":"notice"} style={{marginTop:12}}>{message}</p>}<p><small>Available to active administrators and managers. The email is sent only to your signed-in account.</small></p></div>;
}
