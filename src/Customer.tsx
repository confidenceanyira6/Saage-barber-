import { useEffect, useState } from "react";
import { supabase, money } from "./lib";
import { Avatar, Back, Stars } from "./Shared";
import { ClientTime, ClientReview, dur } from "./Booking";
import { when } from "./lib";

type Prov = any;
type Screen = { n: "search" } | { n: "profile"; p: Prov } | { n: "time"; p: Prov; s: any } | { n: "review"; p: Prov; s: any; at: Date } | { n: "done"; p: Prov; s: any; at: Date };

export function Discover({ uid }: { uid: string }) {
  const [sc, setSc] = useState<Screen>({ n: "search" });
  if (sc.n === "search") return <Search open={(p) => setSc({ n: "profile", p })} />;
  if (sc.n === "profile") return <Profile p={sc.p} back={() => setSc({ n: "search" })} pick={(s) => setSc({ n: "time", p: sc.p, s })} />;
  if (sc.n === "time") return <ClientTime p={sc.p} s={sc.s} back={() => setSc({ n: "profile", p: sc.p })} next={(at) => setSc({ n: "review", p: sc.p, s: sc.s, at })} />;
  if (sc.n === "review") return <ClientReview uid={uid} p={sc.p} s={sc.s} at={sc.at} back={() => setSc({ n: "time", p: sc.p, s: sc.s })} done={() => setSc({ n: "done", p: sc.p, s: sc.s, at: sc.at })} />;
  return <div className="center-screen inline"><div className="ring ok">✓</div><h2>Booking request sent!</h2><p className="muted">{sc.p.business_name ?? sc.p.full_name} · {sc.s.name}<br />{when(sc.at.toISOString())}</p><p className="muted">You can pay from My Bookings once they accept.</p><button className="btn" onClick={() => setSc({ n: "search" })}>Back to Home</button></div>;
}

function Search({ open }: { open: (p: Prov) => void }) {
  const [q, setQ] = useState(""); const [home, setHome] = useState(false); const [max, setMax] = useState(""); const [minR, setMinR] = useState("");
  const [rows, setRows] = useState<Prov[] | null>(null); const [err, setErr] = useState("");
  const go = async () => { setRows(null); setErr(""); const { data, error } = await supabase.rpc("search_providers", { p_query: q || null, p_home_service: home || null, p_max_price: max ? Number(max) : null, p_min_rating: minR ? Number(minR) : null, p_limit: 30 }); if (error) setErr(error.message); setRows(data ?? []); };
  useEffect(() => { go(); }, []);
  return (<>
    <h2>Find your barber</h2>
    <form className="row gap" onSubmit={(e) => { e.preventDefault(); go(); }}><input placeholder="Search stylists, services..." value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn sm">Search</button></form>
    <div className="chips"><span className={"chip" + (home ? " on" : "")} onClick={() => setHome(!home)}>Home service</span><input className="mini" type="number" placeholder="Max price" value={max} onChange={(e) => setMax(e.target.value)} /><input className="mini" type="number" step="0.5" max="5" placeholder="Min rating" value={minR} onChange={(e) => setMinR(e.target.value)} /></div>
    {err && <p className="note err">{err} <button className="link" onClick={go}>Retry</button></p>}{rows === null && <p className="muted">Searching...</p>}
    {rows && !rows.length && !err && <p className="muted center">No barbers found yet. Try different filters.</p>}
    {rows?.map((p) => <button className="card row menu" key={p.id} onClick={() => open(p)}><div className="row gap"><Avatar name={p.business_name ?? p.full_name} /><span><b>{p.business_name ?? p.full_name}</b>{p.is_vip && <span className="vip">VIP</span>}<br /><small>{p.provider_type === "male_barber" ? "Male Barber" : "Female Hairstylist"} · {p.city ?? ""}</small></span></div><span className="right"><Stars n={p.rating_avg} /><br /><small>{p.min_price != null ? "from " + money(p.min_price, p.currency_code) : ""}</small></span></button>)}
  </>);
}

function Profile({ p, back, pick }: { p: Prov; back: () => void; pick: (s: any) => void }) {
  const [svc, setSvc] = useState<any[] | null>(null);
  useEffect(() => { supabase.from("provider_services").select("*").eq("provider_id", p.id).eq("is_active", true).then(({ data }) => setSvc(data ?? [])); }, [p.id]);
  return (<><Back go={back} />
    <div className="card hero"><div className="row gap"><Avatar name={p.business_name ?? p.full_name} size={64} /><div><h2 style={{ margin: 0 }}>{p.business_name ?? p.full_name}</h2><Stars n={p.rating_avg} /> <small>({p.rating_count ?? 0} reviews)</small><br /><small>{p.city}{p.home_service_enabled ? " · Home service available" : ""}</small></div></div>{p.bio && <p>{p.bio}</p>}</div>
    <h3>Hairstyles &amp; services</h3>{svc === null && <p className="muted">Loading...</p>}{svc && !svc.length && <p className="muted">No services listed yet.</p>}
    {svc?.map((s) => <div className="card row" key={s.id}><span><b>{s.name}</b><br /><small>⏱ {dur(s.duration_minutes)}{s.description ? " · " + s.description : ""}</small></span><span className="right"><b>{money(s.price, s.currency_code)}</b><br /><button className="btn sm" onClick={() => pick(s)}>Book Now</button></span></div>)}
  </>);
}
