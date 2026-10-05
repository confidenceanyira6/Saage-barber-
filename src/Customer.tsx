import { useEffect, useState } from "react";
import { supabase, money, when, publicProfiles } from "./lib";
import { Back, Stars } from "./Shared";
import { ClientTime, ClientReview, dur } from "./Booking";
import { ProfilePage, Pic } from "./Social";

type Step = { n: "profile" } | { n: "book" } | { n: "time"; s: any } | { n: "review"; s: any; at: Date } | { n: "done"; s: any; at: Date };

/** A barber/stylist's page for customers: Instagram-style profile (posts, follow, Message) plus booking. */
export function ProviderPage({ uid, role, userId, back, openChat }: { uid: string; role: string; userId: string; back: () => void; openChat: (id: string) => void }) {
  const [p, setP] = useState<any | null | undefined>(undefined); const [step, setStep] = useState<Step>({ n: "profile" }); const [svc, setSvc] = useState<any[] | null>(null);
  useEffect(() => { (async () => {
    const [pv, pr] = await Promise.all([supabase.from("providers").select("*").eq("id", userId).maybeSingle(), publicProfiles([userId])]);
    setP(pv.data ? { ...pv.data, full_name: pr[userId]?.full_name, avatar_url: pr[userId]?.avatar_url } : null);
  })(); }, [userId]);
  useEffect(() => { if (step.n === "book") supabase.from("provider_services").select("*").eq("provider_id", userId).eq("is_active", true).then(({ data }) => setSvc(data ?? [])); }, [step.n, userId]);
  if (p === undefined) return <><Back go={back} /><p className="muted">Loading...</p></>;
  const canBook = !!p && role === "customer" && uid !== userId;
  const name = p?.business_name ?? p?.full_name;
  if (step.n === "book" && p) return (<><Back go={() => setStep({ n: "profile" })} label="Profile" />
    <div className="card hero"><div className="row gap"><Pic name={name} src={p.avatar_url} size={56} /><div><b>{name}</b><br /><Stars n={p.rating_avg} /> <small>({p.rating_count ?? 0})</small></div></div></div>
    <h3>Hairstyles &amp; services</h3>{svc === null && <p className="muted">Loading...</p>}{svc && !svc.length && <p className="muted">No services listed yet.</p>}
    {svc?.map((s) => <div className="card row" key={s.id}><span><b>{s.name}</b><br /><small>⏱ {dur(s.duration_minutes)}{s.description ? " · " + s.description : ""}</small></span><span className="right"><b>{money(s.price, s.currency_code)}</b><br /><button className="btn sm" onClick={() => setStep({ n: "time", s })}>Book Now</button></span></div>)}</>);
  if (step.n === "time" && p) return <ClientTime p={p} s={step.s} back={() => setStep({ n: "book" })} next={(at) => setStep({ n: "review", s: step.s, at })} />;
  if (step.n === "review" && p) return <ClientReview uid={uid} p={p} s={step.s} at={step.at} back={() => setStep({ n: "time", s: step.s })} done={() => setStep({ n: "done", s: step.s, at: step.at })} />;
  if (step.n === "done" && p) return <div className="center-screen inline"><div className="ring ok">✓</div><h2>Booking request sent!</h2><p className="muted">{name} · {step.s.name}<br />{when(step.at.toISOString())}</p><p className="muted">You can pay from Bookings once they accept.</p><button className="btn" onClick={() => setStep({ n: "profile" })}>Back to profile</button><button className="btn ghost" onClick={() => openChat(userId)}>Message {name}</button></div>;
  return (<><Back go={back} />{canBook && <button className="btn" onClick={() => setStep({ n: "book" })}>Book a hairstyle</button>}<ProfilePage uid={uid} userId={userId} role={role} openChat={openChat} /></>);
}

export function Discover({ uid, role, openChat }: { uid: string; role: string; openChat: (id: string) => void }) {
  const [view, setView] = useState<string | null>(null);
  if (view) return <ProviderPage uid={uid} role={role} userId={view} back={() => setView(null)} openChat={openChat} />;
  return <Search open={(id) => setView(id)} />;
}

function Search({ open }: { open: (id: string) => void }) {
  const [q, setQ] = useState(""); const [home, setHome] = useState(false); const [max, setMax] = useState(""); const [minR, setMinR] = useState("");
  const [rows, setRows] = useState<any[] | null>(null); const [err, setErr] = useState("");
  const go = async () => { setRows(null); setErr(""); const { data, error } = await supabase.rpc("search_providers", { p_query: q || null, p_home_service: home || null, p_max_price: max ? Number(max) : null, p_min_rating: minR ? Number(minR) : null, p_limit: 30 }); if (error) setErr(error.message); setRows(data ?? []); };
  useEffect(() => { go(); }, []);
  return (<>
    <h2>Find your barber</h2>
    <form className="row gap" onSubmit={(e) => { e.preventDefault(); go(); }}><input placeholder="Search stylists, services..." value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn sm">Search</button></form>
    <div className="chips"><span className={"chip" + (home ? " on" : "")} onClick={() => setHome(!home)}>Home service</span><input className="mini" type="number" placeholder="Max price" value={max} onChange={(e) => setMax(e.target.value)} /><input className="mini" type="number" step="0.5" max="5" placeholder="Min rating" value={minR} onChange={(e) => setMinR(e.target.value)} /></div>
    {err && <p className="note err">{err} <button className="link" onClick={go}>Retry</button></p>}{rows === null && <p className="muted">Searching...</p>}
    {rows && !rows.length && !err && <p className="muted center">No barbers found yet. Try different filters.</p>}
    {rows?.map((p) => <button className="card row menu" key={p.id} onClick={() => open(p.id)}><div className="row gap"><Pic name={p.business_name ?? p.full_name} src={p.avatar_url} /><span><b>{p.business_name ?? p.full_name}</b>{p.is_vip && <span className="vip">VIP</span>}<br /><small>{p.provider_type === "male_barber" ? "Male Barber" : "Female Hairstylist"} · {p.city ?? ""}</small></span></div><span className="right"><Stars n={p.rating_avg} /><br /><small>{p.min_price != null ? "from " + money(p.min_price, p.currency_code) : ""}</small></span></button>)}
  </>);
}
