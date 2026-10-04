import { useEffect, useState } from "react";
import { supabase, money, when } from "./lib";
import { Avatar, Back, Stars, More } from "./Shared";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Dashboard + first-time setup checklist (stylist onboarding). */
export function Dashboard({ uid, go }: { uid: string; go: (tab: string) => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { (async () => {
    const c = async (t: string, extra?: (q: any) => any) => { let q: any = supabase.from(t).select("id", { count: "exact", head: true }).eq("provider_id", uid); if (extra) q = extra(q); return (await q).count ?? 0; };
    const [prov, wal, prof, svc, av, port, pend, up] = await Promise.all([
      supabase.from("providers").select("business_name,rating_avg,rating_count,is_vip,bio").eq("id", uid).maybeSingle(), supabase.from("wallets").select("available_balance,currency_code").eq("user_id", uid).maybeSingle(),
      supabase.from("profiles").select("identity_verification").eq("id", uid).maybeSingle(), c("provider_services"), c("provider_availability"), c("portfolio_items"),
      c("bookings", (q) => q.eq("status", "pending")), c("bookings", (q) => q.in("status", ["accepted", "confirmed", "in_progress"])),
    ]);
    setD({ prov: prov.data, wal: wal.data, kyc: prof.data?.identity_verification, svc, av, port, pend, up });
  })(); }, [uid]);
  if (!d) return <p className="muted">Loading...</p>;
  const steps: [string, boolean, string][] = [["Add your services", d.svc > 0, "manage"], ["Set your availability", d.av > 0, "manage"], ["Add portfolio photos", d.port > 0, "manage"], ["Verify your identity", d.kyc === "verified", "more"]];
  const left = steps.filter((s) => !s[1]);
  return (<>
    <h2>Hello, {d.prov?.business_name ?? "Stylist"} {d.prov?.is_vip && <span className="vip">VIP</span>}</h2>
    <div className="card hero"><small>Available balance</small><b className="big">{money(d.wal?.available_balance ?? 0, d.wal?.currency_code ?? "NGN")}</b></div>
    <div className="grid2"><div className="card"><small>New requests</small><b className="big">{d.pend}</b></div><div className="card"><small>Upcoming</small><b className="big">{d.up}</b></div></div>
    <div className="card row"><span><small>Rating</small><br /><Stars n={d.prov?.rating_avg} /> <small>({d.prov?.rating_count ?? 0})</small></span><button className="btn sm" onClick={() => go("book")}>View bookings</button></div>
    {left.length > 0 && <><h3>Finish setting up</h3>{steps.map(([t, ok, tab]) => <button key={t} className="card row menu" onClick={() => go(tab)}><span>{ok ? "✅" : "⬜"} {t}</span><span>›</span></button>)}</>}
  </>);
}

/** Services, Availability and Portfolio management. */
export function Manage({ uid }: { uid: string }) {
  const [tab, setTab] = useState("services");
  return <><div className="tabs">{["services", "availability", "portfolio"].map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>)}</div>{tab === "services" ? <Services uid={uid} /> : tab === "availability" ? <Availability uid={uid} /> : <Portfolio uid={uid} />}</>;
}

function Services({ uid }: { uid: string }) {
  const [rows, setRows] = useState<any[] | null>(null); const [cur, setCur] = useState("NGN"); const [msg, setMsg] = useState(""); const [edit, setEdit] = useState<any | null>(null);
  const load = async () => { const { data } = await supabase.from("provider_services").select("*").eq("provider_id", uid).order("created_at"); setRows(data ?? []); };
  useEffect(() => { load(); supabase.from("profiles").select("currency_code").eq("id", uid).maybeSingle().then(({ data }) => data && setCur(data.currency_code)); }, [uid]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const v = { name: edit.name, description: edit.description || null, price: Number(edit.price), duration_minutes: Number(edit.duration_minutes), category: edit.category || null };
    if (!v.name || !(v.price > 0) || !(v.duration_minutes > 0)) return setMsg("Enter a name, a price and a duration.");
    const r = edit.id ? await supabase.from("provider_services").update(v).eq("id", edit.id) : await supabase.from("provider_services").insert({ ...v, provider_id: uid, currency_code: cur, is_active: true });
    if (r.error) setMsg(r.error.message); else { setEdit(null); load(); }
  }
  const toggle = async (s: any) => { await supabase.from("provider_services").update({ is_active: !s.is_active }).eq("id", s.id); load(); };
  const del = async (s: any) => { if (!confirm("Delete this service?")) return; const { error } = await supabase.from("provider_services").delete().eq("id", s.id); if (error) setMsg("This service has bookings, so it can't be deleted. Switch it off instead."); load(); };
  if (edit) return <form className="stack" onSubmit={save}><Back go={() => setEdit(null)} /><h2>{edit.id ? "Edit service" : "New service"}</h2><input placeholder="Service name (e.g. Haircut + Beard Trim)" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /><input type="number" placeholder={`Price (${cur})`} value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /><input type="number" placeholder="Duration (minutes)" value={edit.duration_minutes} onChange={(e) => setEdit({ ...edit, duration_minutes: e.target.value })} /><input placeholder="Category (optional)" value={edit.category ?? ""} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /><input placeholder="Description (optional)" value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />{msg && <p className="note err">{msg}</p>}<button className="btn">Save service</button></form>;
  return (<><div className="row"><h2>My Services</h2><button className="btn sm" onClick={() => setEdit({ name: "", price: "", duration_minutes: 30, category: "", description: "" })}>+ Add</button></div>{msg && <p className="note err">{msg}</p>}{rows === null && <p className="muted">Loading...</p>}{rows && !rows.length && <p className="muted center">No services yet. Add your first one so customers can book you.</p>}
    {rows?.map((s) => <div className="card" key={s.id}><div className="row"><span><b>{s.name}</b><br /><small>{s.duration_minutes} mins · {s.category ?? "General"}</small></span><b>{money(s.price, s.currency_code)}</b></div><div className="actions"><button className="btn sm ghost" onClick={() => setEdit(s)}>Edit</button><button className="btn sm ghost" onClick={() => toggle(s)}>{s.is_active ? "Switch off" : "Switch on"}</button><button className="btn sm dark" onClick={() => del(s)}>Delete</button></div></div>)}</>);
}

function Availability({ uid }: { uid: string }) {
  const [wk, setWk] = useState(DAYS.map(() => ({ on: false, start: "09:00", end: "17:00" }))); const [msg, setMsg] = useState(""); const [loaded, setLoaded] = useState(false);
  useEffect(() => { supabase.from("provider_availability").select("*").eq("provider_id", uid).then(({ data }) => { const w = DAYS.map(() => ({ on: false, start: "09:00", end: "17:00" })); (data ?? []).forEach((a: any) => (w[a.day_of_week] = { on: true, start: a.start_time.slice(0, 5), end: a.end_time.slice(0, 5) })); setWk(w); setLoaded(true); }); }, [uid]);
  async function save() {
    setMsg(""); if (wk.some((d) => d.on && d.start >= d.end)) return setMsg("Closing time must be after opening time.");
    const del = await supabase.from("provider_availability").delete().eq("provider_id", uid); if (del.error) return setMsg(del.error.message);
    const rows = wk.map((d, i) => ({ d, i })).filter(({ d }) => d.on).map(({ d, i }) => ({ provider_id: uid, day_of_week: i, start_time: d.start + ":00", end_time: d.end + ":00" }));
    if (rows.length) { const r = await supabase.from("provider_availability").insert(rows); if (r.error) return setMsg(r.error.message); }
    setMsg("Availability saved.");
  }
  return (<><h2>Availability</h2><p className="muted">Customers can only book you in these hours.</p>{!loaded && <p className="muted">Loading...</p>}
    {wk.map((d, i) => <div className="card row" key={i}><label className="row gap"><input type="checkbox" style={{ width: 20 }} checked={d.on} onChange={(e) => setWk(wk.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} /><b>{DAYS[i]}</b></label>{d.on && <span className="row gap"><input type="time" className="mini" value={d.start} onChange={(e) => setWk(wk.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} /><input type="time" className="mini" value={d.end} onChange={(e) => setWk(wk.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} /></span>}</div>)}
    {msg && <p className="note">{msg}</p>}<button className="btn" onClick={save}>Save availability</button></>);
}

function Portfolio({ uid }: { uid: string }) {
  const [rows, setRows] = useState<any[] | null>(null); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const load = async () => { const { data } = await supabase.from("portfolio_items").select("*").eq("provider_id", uid).order("sort_order"); setRows(data ?? []); };
  useEffect(() => { load(); }, [uid]);
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return; setMsg(""); if (!f.type.startsWith("image/")) return setMsg("Please choose an image."); if (f.size > 5_000_000) return setMsg("Image must be under 5 MB.");
    setBusy(true); const path = `${uid}/${Date.now()}-${f.name.replace(/[^\w.]/g, "_")}`;
    const up = await supabase.storage.from("portfolio").upload(path, f); if (up.error) { setMsg(up.error.message); setBusy(false); return; }
    const r = await supabase.from("portfolio_items").insert({ provider_id: uid, image_path: path, sort_order: rows?.length ?? 0 }); if (r.error) setMsg(r.error.message); setBusy(false); load();
  }
  async function del(p: any) { if (!confirm("Remove this photo?")) return; await supabase.from("portfolio_items").delete().eq("id", p.id); await supabase.storage.from("portfolio").remove([p.image_path]); load(); }
  return (<><h2>Portfolio</h2><label className="btn" style={{ textAlign: "center", cursor: "pointer" }}>{busy ? "Uploading..." : "+ Add photo"}<input type="file" accept="image/*" hidden onChange={upload} disabled={busy} /></label>{msg && <p className="note err">{msg}</p>}{rows && !rows.length && <p className="muted center">Show off your best work. Photos help customers choose you.</p>}
    <div className="photos">{rows?.map((p) => <div key={p.id} className="photo"><img src={supabase.storage.from("portfolio").getPublicUrl(p.image_path).data.publicUrl} alt={p.caption ?? "Work"} /><button onClick={() => del(p)}>×</button></div>)}</div></>);
}

function EditProfile({ uid, back }: { uid: string; back: () => void }) {
  const [p, setP] = useState<any>(null); const [msg, setMsg] = useState("");
  useEffect(() => { supabase.from("providers").select("business_name,bio,city,state,home_service_enabled,travel_fee,service_radius_km").eq("id", uid).maybeSingle().then(({ data }) => setP(data ?? {})); }, [uid]);
  async function save(e: React.FormEvent) { e.preventDefault(); setMsg(""); const { error } = await supabase.from("providers").update({ business_name: p.business_name, bio: p.bio, city: p.city, state: p.state, home_service_enabled: !!p.home_service_enabled, travel_fee: Number(p.travel_fee || 0), service_radius_km: Number(p.service_radius_km || 0) }).eq("id", uid); setMsg(error ? error.message : "Profile saved."); }
  if (!p) return <p className="muted">Loading...</p>;
  const set = (k: string) => (e: any) => setP({ ...p, [k]: e.target.value });
  return (<><Back go={back} /><h2>Edit Profile</h2><form className="stack" onSubmit={save}><input placeholder="Business name" value={p.business_name ?? ""} onChange={set("business_name")} /><input placeholder="Bio - tell customers about your work" value={p.bio ?? ""} onChange={set("bio")} /><input placeholder="City" value={p.city ?? ""} onChange={set("city")} /><input placeholder="State" value={p.state ?? ""} onChange={set("state")} />
    <label className="row"><b>Offer home service</b><input type="checkbox" style={{ width: 22 }} checked={!!p.home_service_enabled} onChange={(e) => setP({ ...p, home_service_enabled: e.target.checked })} /></label>
    {p.home_service_enabled && <><input type="number" placeholder="Travel fee" value={p.travel_fee ?? ""} onChange={set("travel_fee")} /><input type="number" placeholder="Service radius (km)" value={p.service_radius_km ?? ""} onChange={set("service_radius_km")} /></>}
    {msg && <p className="note">{msg}</p>}<button className="btn">Save profile</button></form></>);
}

function Reviews({ uid, back }: { uid: string; back: () => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { supabase.from("reviews").select("id,rating,comment,created_at").eq("provider_id", uid).order("created_at", { ascending: false }).limit(50).then(({ data }) => setRows(data ?? [])); }, [uid]);
  const avg = rows?.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : null;
  return (<><Back go={back} /><h2>Reviews &amp; Ratings</h2>{avg && <div className="card hero center"><b className="big">{avg.toFixed(1)} ★</b><small>{rows!.length} reviews</small></div>}{rows && !rows.length && <p className="muted center">No reviews yet. They appear after customers confirm a completed service.</p>}{rows?.map((r) => <div className="card" key={r.id}><div className="row"><Stars n={r.rating} /><small>{when(r.created_at)}</small></div>{r.comment && <p>{r.comment}</p>}</div>)}</>);
}

export function ProviderMore({ uid, name }: { uid: string; name: string }) {
  const [page, setPage] = useState("menu");
  if (page === "profile") return <EditProfile uid={uid} back={() => setPage("menu")} />;
  if (page === "reviews") return <Reviews uid={uid} back={() => setPage("menu")} />;
  return (<><div className="card row"><Avatar name={name} /><b>{name}</b></div>
    <button className="card row menu" onClick={() => setPage("profile")}><span><b>Edit profile</b><br /><small>Business name, bio, location, home service</small></span><span>›</span></button>
    <button className="card row menu" onClick={() => setPage("reviews")}><span><b>Reviews &amp; ratings</b><br /><small>What customers say about you</small></span><span>›</span></button>
    <More uid={uid} isProvider={true} name={name} hideHeader /></>);
}
