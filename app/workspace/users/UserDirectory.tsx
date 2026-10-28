"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {createClient} from "@/lib/supabase/client";
type Member={id:string;full_name:string;role:string;active:boolean};
const roles=["technician","manager","viewer","admin"];
export default function UserDirectory({currentUserId}:{currentUserId:string}){
 const db=useMemo(()=>createClient(),[]);
 const [people,setPeople]=useState<Member[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState("");
 const [message,setMessage]=useState("");
 const [inviteName,setInviteName]=useState("");
 const [inviteEmail,setInviteEmail]=useState("");
 const [inviteRole,setInviteRole]=useState("technician");
 const [inviting,setInviting]=useState(false);
 const load=useCallback(async()=>{
  setLoading(true);
  const {data,error}=await db.from("profiles").select("id,full_name,role,active").order("full_name");
  if(error)setMessage(error.message);else setPeople((data??[]) as Member[]);
  setLoading(false);
 },[db]);
 useEffect(()=>{void load()},[load]);
 function change(id:string,key:"full_name"|"role"|"active",value:string|boolean){
  setPeople(current=>current.map(p=>p.id===id?{...p,[key]:value}:p));
 }
 async function save(p:Member){
  if(p.id===currentUserId&&(!p.active||p.role!=="admin")){setMessage("You cannot deactivate or demote your own administrator account.");return;}
  setSaving(p.id);setMessage("");
  const response=await fetch("/api/admin/user-profile",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)});
  const result=await response.json().catch(()=>({error:"Unable to save changes"}));
  setSaving("");setMessage(response.ok?"Profile updated.":result.error??"Unable to save changes.");
  await load();
 }
 async function invite(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setInviting(true);setMessage("");
  const response=await fetch("/api/admin/invite-user",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({full_name:inviteName,email:inviteEmail,role:inviteRole})});
  const result=await response.json().catch(()=>({error:"Unable to send invitation"}));
  setInviting(false);setMessage(response.ok?result.message:result.error??"Invitation failed.");
  if(response.ok){setInviteName("");setInviteEmail("");await load();}
 }
 return <>
 {message&&<p className="notice" role="status">{message}</p>}
 <section className="cards"><article><div><span>Team members</span><strong>{people.length}</strong></div></article><article><div><span>Active technicians</span><strong>{people.filter(p=>p.active&&p.role==="technician").length}</strong></div></article><article><div><span>Inactive accounts</span><strong>{people.filter(p=>!p.active).length}</strong></div></article></section>
 <section className="panel" style={{margin:"18px 0"}}><h2>Invite a team member</h2><p>Send a secure invitation email. The new account will appear in the team directory with the selected role.</p><form onSubmit={invite} className="formGrid"><label>Full name<input required maxLength={120} value={inviteName} onChange={e=>setInviteName(e.target.value)} placeholder="Technician name"/></label><label>Email address<input required type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="technician@example.com"/></label><label>Role<select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>{roles.map(r=><option key={r} value={r}>{r}</option>)}</select></label><div><button type="submit" disabled={inviting}>{inviting?"Sending invitation…":"Send invitation"}</button></div></form></section>
 <section className="panel tablePanel"><h2>Team directory</h2>{loading?<p>Loading users…</p>:<div className="tableWrap"><table><thead><tr><th>Name</th><th>Role</th><th>Account</th><th>Action</th></tr></thead><tbody>{people.map(p=><tr key={p.id}><td><input aria-label="Full name" value={p.full_name??""} onChange={e=>change(p.id,"full_name",e.target.value)}/></td><td><select aria-label="Role" value={p.role} onChange={e=>change(p.id,"role",e.target.value)}>{roles.map(r=><option key={r} value={r}>{r}</option>)}</select></td><td><label><input type="checkbox" checked={p.active} onChange={e=>change(p.id,"active",e.target.checked)}/> Active</label></td><td><button type="button" disabled={saving===p.id} onClick={()=>void save(p)}>{saving===p.id?"Saving…":"Save"}</button></td></tr>)}</tbody></table></div>}{!loading&&!people.length&&<p>No profiles found.</p>}</section>
 </>;
}