import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import UserDirectory from "./UserDirectory";
export const dynamic="force-dynamic";
export default async function UsersPage(){
 const db=await createClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/login");
 const {data:profile,error:profileError}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
 if(!profile?.active||profile.role!=="admin")return <main className="content"><h1>User Management</h1><p>{profileError?"Unable to verify your profile.":"Administrator access is required."}</p><p>Signed in as: {user.email}</p><p>Role: {profile?.role??"Unavailable"}</p><SignOutButton label="Switch account"/><Link href="/workspace">Back to dashboard</Link></main>;
 return <main className="content"><header><div><p className="eyebrow">ADMINISTRATION</p><h1>User Management</h1><p>Manage technician roles, account access and assignments.</p></div></header><UserDirectory currentUserId={user.id}/></main>;
}