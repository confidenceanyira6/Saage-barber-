import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib";
import Auth, { Splash } from "./Auth";
import { Discover } from "./Customer";
import { Bookings, Wallet, More } from "./Shared";
import { Dashboard, Manage, ProviderMore } from "./Stylist";
import { StylistExtras } from "./Extra";

const HOME = "M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z";
const ICON: Record<string, string> = { home: HOME, dash: HOME, book: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z", wallet: "M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 7l12-3v3M17 14h2", manage: "M6 6l12 12M6 18L18 6M4 4l4 4M16 16l4 4", more: "M5 12h.01M12 12h.01M19 12h.01" };

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined); const [role, setRole] = useState<string | null>(null); const [name, setName] = useState("");
  const [tab, setTab] = useState("home"); const [splash, setSplash] = useState(true); const [notice, setNotice] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 1200);
    const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.replace(/^#/, "")), th = q.get("token_hash"), type = q.get("type");
    if (th && type) supabase.auth.verifyOtp({ token_hash: th, type: type as any }).then(({ error }) => { setNotice(error ? "We couldn't verify that link: " + error.message : "Email verified."); history.replaceState(null, "", location.pathname); });
    else if (h.get("error_description")) { setNotice(h.get("error_description")!.replace(/\+/g, " ")); history.replaceState(null, "", location.pathname); }
    if (q.get("reference") || q.get("tx_ref") || q.get("trxref")) { setNotice("Thanks! We're confirming your payment - it will show in My Bookings or your wallet shortly."); setTab("book"); history.replaceState(null, "", location.pathname); }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { clearTimeout(t); data.subscription.unsubscribe(); };
  }, []);
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) { setRole(null); return; }
    (async () => {
      const { data: p } = await supabase.from("profiles").select("role,full_name,country_code").eq("id", uid).maybeSingle();
      setRole(p?.role ?? "customer"); setName(p?.full_name ?? session?.user.email ?? "");
      if (p && (p.role === "male_barber" || p.role === "female_stylist")) { const { data: pr } = await supabase.from("providers").select("id").eq("id", uid).maybeSingle(); if (!pr) await supabase.from("providers").insert({ id: uid, provider_type: p.role, business_name: p.full_name, country_code: p.country_code }); }
    })();
  }, [uid]);

  if (session === undefined || splash) return <Splash />;
  if (!session || !uid) return <>{notice && <div className="note" style={{ margin: 16 }}>{notice}</div>}<Auth /></>;
  if (!role) return <Splash />;
  const isProvider = role === "male_barber" || role === "female_stylist";
  const tabs: [string, string][] = isProvider ? [["dash", "Dashboard"], ["book", "Bookings"], ["manage", "Services"], ["wallet", "Earnings"], ["more", "More"]] : [["home", "Home"], ["book", "Bookings"], ["wallet", "Wallet"], ["more", "More"]];
  const cur = tabs.some(([k]) => k === tab) ? tab : tabs[0][0];
  return (<div className="shell">{notice && <div className="note" onClick={() => setNotice("")}>{notice}</div>}
    <main>{cur === "home" && <Discover uid={uid} />}{cur === "dash" && <Dashboard uid={uid} go={setTab} />}{cur === "manage" && <Manage uid={uid} />}{cur === "book" && <Bookings uid={uid} isProvider={isProvider} />}{cur === "wallet" && <Wallet uid={uid} isProvider={isProvider} />}{cur === "more" && (isProvider ? <><StylistExtras uid={uid} name={name} email={session.user.email} /><ProviderMore uid={uid} name={name} /></> : <More uid={uid} isProvider={false} name={name} />)}</main>
    <nav>{tabs.map(([k, l]) => <button key={k} className={cur === k ? "on" : ""} onClick={() => setTab(k)}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[k]} /></svg><span>{l}</span></button>)}</nav></div>);
}
