import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib";
import Auth, { Splash } from "./Auth";
import { Discover, ProviderPage } from "./Customer";
import { Bookings, Wallet, More, Back } from "./Shared";
import { Dashboard, ProviderMore } from "./Stylist";
import { StylistExtras } from "./Extra";
import { Feed, ProfilePage, Messages, isStylist } from "./Social";
import { ServicesPro, Schedule } from "./Booking";
import { ThemePicker, applyTheme } from "./theme";
import { ProfileSetup } from "./Location";

const P = { feed: "M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z", find: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3", chat: "M21 12a8 8 0 01-11.6 7.1L3 21l1.9-5.4A8 8 0 1121 12z", book: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z", biz: "M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 7l12-3v3M17 14h2", me: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" } as Record<string, string>;

function Business({ uid, name, email, goBook }: { uid: string; name: string; email?: string; goBook: () => void }) {
  const [t, setT] = useState("dash");
  const tabs: [string, string][] = [["dash", "Home"], ["services", "Styles"], ["schedule", "Calendar"], ["wallet", "Earnings"], ["tools", "Tools"]];
  const map: Record<string, string> = { manage: "services", more: "tools" };
  return <><div className="tabs">{tabs.map(([k, l]) => <button key={k} className={t === k ? "on" : ""} onClick={() => setT(k)}>{l}</button>)}</div>
    {t === "dash" && <Dashboard uid={uid} go={(x) => (x === "book" ? goBook() : setT(map[x] ?? x))} />}{t === "services" && <ServicesPro uid={uid} />}{t === "schedule" && <Schedule uid={uid} />}{t === "wallet" && <Wallet uid={uid} isProvider={true} />}{t === "tools" && <><StylistExtras uid={uid} name={name} email={email} /><ProviderMore uid={uid} name={name} /></>}</>;
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined); const [role, setRole] = useState<string | null>(null); const [name, setName] = useState("");
  const [tab, setTab] = useState("feed"); const [splash, setSplash] = useState(true); const [notice, setNotice] = useState("");
  const [viewing, setViewing] = useState<string | null>(null); const [chatWith, setChatWith] = useState<string | null>(null); const [settings, setSettings] = useState(false); const [avKey, setAvKey] = useState(0);
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
      const { data: p } = await supabase.from("profiles").select("role,full_name,country_code,theme").eq("id", uid).maybeSingle();
      if (p?.theme) applyTheme(p.theme);
      setRole(p?.role ?? "customer"); setName(p?.full_name ?? session?.user.email ?? "");
      if (p && isStylist(p.role)) { const { data: pr } = await supabase.from("providers").select("id").eq("id", uid).maybeSingle(); if (!pr) await supabase.from("providers").insert({ id: uid, provider_type: p.role, business_name: p.full_name, country_code: p.country_code }); }
    })();
  }, [uid]);

  if (session === undefined || splash) return <Splash />;
  if (!session || !uid) return <>{notice && <div className="note" style={{ margin: 16 }}>{notice}</div>}<Auth /></>;
  if (!role) return <Splash />;
  const provider = isStylist(role);
  const tabs: [string, string][] = provider ? [["feed", "Feed"], ["chat", "Chat"], ["book", "Bookings"], ["biz", "Business"], ["me", "Profile"]] : [["feed", "Feed"], ["find", "Find"], ["chat", "Chat"], ["book", "Bookings"], ["me", "Profile"]];
  const cur = tabs.some(([k]) => k === tab) ? tab : "feed";
  const go = (k: string) => { setViewing(null); setSettings(false); setTab(k); };
  const openChat = (id: string) => { setViewing(null); setChatWith(id); setTab("chat"); };
  let body: React.ReactNode;
  if (viewing) body = provider ? <ProfilePage uid={uid} userId={viewing} role={role} openChat={openChat} back={() => setViewing(null)} /> : <ProviderPage uid={uid} role={role} userId={viewing} back={() => setViewing(null)} openChat={openChat} />;
  else if (cur === "feed") body = <Feed uid={uid} role={role} openProfile={setViewing} />;
  else if (cur === "find") body = <Discover uid={uid} role={role} openChat={openChat} />;
  else if (cur === "chat") body = <Messages uid={uid} role={role} with={chatWith} clear={() => setChatWith(null)} openProfile={setViewing} />;
  else if (cur === "book") body = <Bookings uid={uid} isProvider={provider} />;
  else if (cur === "biz") body = <Business uid={uid} name={name} email={session.user.email} goBook={() => setTab("book")} />;
  else body = settings ? <><Back go={() => setSettings(false)} /><h2>Settings</h2><ThemePicker uid={uid} />{!provider && <Wallet uid={uid} isProvider={false} />}<More uid={uid} isProvider={provider} name={name} /></> : <><ProfileSetup uid={uid} isProvider={provider} onDone={() => setAvKey(avKey + 1)} /><ProfilePage key={avKey} uid={uid} userId={uid} role={role} openChat={openChat} onSettings={() => setSettings(true)} /></>;
  return (<div className="shell">{notice && <div className="note" onClick={() => setNotice("")}>{notice}</div>}<main>{body}</main>
    <nav>{tabs.map(([k, l]) => <button key={k} className={cur === k && !viewing ? "on" : ""} onClick={() => go(k)}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={P[k]} /></svg><span>{l}</span></button>)}</nav></div>);
}
