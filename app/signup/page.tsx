"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Signup() {
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [message,setMessage]=useState("");

  async function submit(e:FormEvent) {
    e.preventDefault();
    setMessage("Creating account...");
    const { data,error }=await createClient().auth.signUp({
      email,password,options:{data:{full_name:name},emailRedirectTo:`${window.location.origin}/auth/confirm`}
    });
    if(error){setMessage(error.message);return;}
    if(data.session){location.href="/workspace";return;}
    setMessage("Account created. Check your email to confirm your address, then sign in.");
  }

  return <main className="login"><form onSubmit={submit}>
    <div className="brandmark">C</div>
    <p className="eyebrow">CALDASHPRO</p>
    <h1>Create account</h1>
    <p>New accounts begin with Viewer access until an administrator assigns a role.</p>
    <label>Full name<input required value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label>Password<input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <button type="submit">Create account</button>
    {message&&<small>{message}</small>}
    <small>Already registered? <Link href="/login">Sign in</Link></small>
  </form></main>;
}