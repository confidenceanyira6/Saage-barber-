import { useEffect, useMemo, useState } from "react";
import { supabase, money, when } from "./lib";
import { Avatar, Back } from "./Shared";

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);
const WD = ["S", "M", "T", "W", "T", "F", "S"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Month calendar used by customers (pick a day) and stylists (see bookings, mark days off). */
export function CalendarGrid({ month, setMonth, info, onPick, sel }: { month: Date; setMonth: (d: Date) => void; info: (d: Date) => { disabled?: boolean; off?: boolean; dot?: boolean }; onPick: (d: Date) => void; sel: string | null }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1); const n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: n }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  return (<div className="cal"><div className="row"><button className="link" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><b>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</b><button className="link" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
    <div className="calgrid">{WD.map((w, i) => <small key={i} className="calh">{w}</small>)}{cells.map((d, i) => { if (!d) return <span key={i} />; const f = info(d); return <button key={i} disabled={f.disabled} className={"day" + (sel === ymd(d) ? " sel" : "") + (f.off ? " off" : "") + (ymd(d) === ymd(new Date()) ? " today" : "")} onClick={() => onPick(d)}>{d.getDate()}{f.dot && <i />}</button>; })}</div></div>);
}

/* ---------------- Customer: pick a day and a time ---------------- */
export function ClientTime({ p, s, back, next }: { p: any; s: any; back: () => void; next: (d: Date) => void }) {
  const [month, setMonth] = useState(new Date()); const [av, setAv] = useState<any[] | null>(null); const [off, setOff] = useState<Set<string>>(new Set()); const [busy, setBusy] = useState<{ a: number; b: number }[]>([]); const [day, setDay] = useState<string | null>(null); const [sel, setSel] = useState<Date | null>(null);
  useEffect(() => { (async () => {
    setAv((await supabase.from("provider_availability").select("*").eq("provider_id", p.id)).data ?? []);
    setOff(new Set(((await supabase.from("provider_days_off").select("off_date").eq("provider_id", p.id)).data ?? []).map((x: any) => x.off_date)));
    const r = await supabase.rpc("provider_busy_slots", { p_provider: p.id, p_from: new Date().toISOString(), p_to: new Date(Date.now() + 120 * 864e5).toISOString() });
    setBusy((r.data ?? []).map((x: any) => ({ a: new Date(x.start_at).getTime(), b: new Date(x.end_at).getTime() })));
  })(); }, [p.id]);
  const slotsFor = (d: Date) => {
    if (!av || off.has(ymd(d))) return [] as Date[];
    const out: Date[] = []; const ms = s.duration_minutes * 60000;
    av.filter((a) => a.day_of_week === d.getDay()).forEach((a) => { const [sh, sm] = a.start_time.split(":").map(Number), [eh, em] = a.end_time.split(":").map(Number); for (let m = sh * 60 + sm; m + s.duration_minutes <= eh * 60 + em; m += 30) { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, m); const t0 = t.getTime(); if (t0 > Date.now() && !busy.some((x) => t0 < x.b && t0 + ms > x.a)) out.push(t); } });
    return out;
  };
  const slots = useMemo(() => { if (!day) return []; const [y, m, dd] = day.split("-").map(Number); return slotsFor(new Date(y, m - 1, dd)); }, [day, av, off, busy]);
  return (<><Back go={back} /><h2>Pick a date &amp; time</h2><p className="muted">{s.name} · takes about <b>{dur(s.duration_minutes)}</b></p>
    {av === null ? <p className="muted">Loading...</p> : <CalendarGrid month={month} setMonth={setMonth} sel={day} info={(d) => ({ disabled: slotsFor(d).length === 0 })} onPick={(d) => { setDay(ymd(d)); setSel(null); }} />}
    {av && !av.length && <p className="note">This barber hasn't set their working hours yet.</p>}
    {day && <><h3>Available times</h3>{!slots.length && <p className="muted">No free times this day.</p>}<div className="slots">{slots.map((t) => <button key={t.getTime()} className={"slot" + (sel?.getTime() === t.getTime() ? " on" : "")} onClick={() => setSel(t)}>{t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</button>)}</div></>}
    <p className="muted"><small>Times shown in your local time zone.</small></p><button className="btn" disabled={!sel} onClick={() => sel && next(sel)}>Next</button></>);
}

const ERR: Record<string, string> = { OUTSIDE_AVAILABILITY: "That time is outside the barber's working hours.", PROVIDER_DAY_OFF: "The barber is off that day.", START_IN_PAST: "That time has already passed.", ADDRESS_REQUIRED: "Enter your address for a home visit.", KYC_REQUIRED: "Verify your identity (More) before booking a home visit.", PROVIDER_KYC_REQUIRED: "This barber isn't verified for home visits yet.", HOME_SERVICE_NOT_AVAILABLE: "This barber doesn't do home visits.", CANNOT_BOOK_SELF: "You can't book yourself.", INVALID_SERVICE: "That service isn't available." };
export function ClientReview({ uid, p, s, at, back, done }: { uid: string; p: any; s: any; at: Date; back: () => void; done: () => void }) {
  const [loc, setLoc] = useState<"salon" | "home">("salon"); const [addr, setAddr] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function book() {
    setBusy(true); setErr("");
    const { error } = await supabase.from("bookings").insert({ customer_id: uid, provider_id: p.id, service_id: s.id, location_type: loc, service_address: loc === "home" ? addr : null, scheduled_start: at.toISOString(), scheduled_end: new Date(at.getTime() + s.duration_minutes * 60000).toISOString(), price: s.price, currency_code: s.currency_code });
    if (error) { const k = Object.keys(ERR).find((x) => error.message.includes(x)); setErr(k ? ERR[k] : /overlap|exclusion|conflict/i.test(error.message) ? "Someone just booked that time. Please pick another." : error.message); setBusy(false); } else done();
  }
  return (<><Back go={back} /><h2>Review &amp; Confirm</h2><div className="card"><div className="row gap"><Avatar name={p.business_name ?? p.full_name} /><div><b>{p.business_name ?? p.full_name}</b><br /><small>{when(at.toISOString())} · {dur(s.duration_minutes)}</small></div></div></div>
    {p.home_service_enabled && <div className="tabs"><button className={loc === "salon" ? "on" : ""} onClick={() => setLoc("salon")}>At the salon</button><button className={loc === "home" ? "on" : ""} onClick={() => setLoc("home")}>Home visit</button></div>}
    {loc === "home" && <input placeholder="Your address" value={addr} onChange={(e) => setAddr(e.target.value)} />}
    <div className="card"><div className="row"><span>{s.name}</span><span>{money(s.price, s.currency_code)}</span></div>{loc === "home" && Number(p.travel_fee) > 0 && <div className="row"><small>Travel fee added at confirmation</small></div>}</div>
    <p className="muted">You pay after the barber accepts. Your payment is held securely until the service is done.</p>{err && <p className="note err">{err}</p>}<button className="btn" disabled={busy} onClick={book}>Send booking request</button></>);
}

/* ---------------- Stylist: services with hairstyle durations ---------------- */
const PRESETS = [30, 60, 90, 120, 180, 240, 360];
export function ServicesPro({ uid }: { uid: string }) {
  const [rows, setRows] = useState<any[] | null>(null); const [cur, setCur] = useState("NGN"); const [msg, setMsg] = useState(""); const [e, setE] = useState<any | null>(null);
  const load = async () => setRows((await supabase.from("provider_services").select("*").eq("provider_id", uid).order("created_at")).data ?? []);
  useEffect(() => { load(); supabase.from("profiles").select("currency_code").eq("id", uid).maybeSingle().then(({ data }) => data && setCur(data.currency_code)); }, [uid]);
  async function save(ev: React.FormEvent) {
    ev.preventDefault(); setMsg(""); const minutes = Number(e.h) * 60 + Number(e.m);
    const v = { name: e.name.trim(), description: e.description || null, price: Number(e.price), duration_minutes: minutes, category: e.category || null };
    if (!v.name || !(v.price > 0)) return setMsg("Enter the hairstyle name and a price."); if (minutes < 5 || minutes > 720) return setMsg("Duration must be between 5 minutes and 12 hours.");
    const r = e.id ? await supabase.from("provider_services").update(v).eq("id", e.id) : await supabase.from("provider_services").insert({ ...v, provider_id: uid, currency_code: cur, is_active: true });
    if (r.error) setMsg(r.error.message); else { setE(null); load(); }
  }
  const edit = (s?: any) => setE(s ? { ...s, h: Math.floor(s.duration_minutes / 60), m: s.duration_minutes % 60 } : { name: "", price: "", h: 1, m: 0, category: "", description: "" });
  const toggle = async (s: any) => { await supabase.from("provider_services").update({ is_active: !s.is_active }).eq("id", s.id); load(); };
  const del = async (s: any) => { if (!confirm("Delete this hairstyle?")) return; const { error } = await supabase.from("provider_services").delete().eq("id", s.id); if (error) setMsg("It has bookings, so switch it off instead."); load(); };
  if (e) return (<form className="stack" onSubmit={save}><Back go={() => setE(null)} /><h2>{e.id ? "Edit hairstyle" : "New hairstyle"}</h2><input placeholder="Hairstyle (e.g. Knotless braids, Fade + beard)" value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} /><input placeholder="Type (e.g. Braids, Cut, Colour)" value={e.category ?? ""} onChange={(x) => setE({ ...e, category: x.target.value })} /><input type="number" placeholder={`Price (${cur})`} value={e.price} onChange={(x) => setE({ ...e, price: x.target.value })} />
    <b>How long does it usually take you?</b><div className="chips">{PRESETS.map((m) => <span key={m} className={"chip" + (Number(e.h) * 60 + Number(e.m) === m ? " on" : "")} onClick={() => setE({ ...e, h: Math.floor(m / 60), m: m % 60 })}>{dur(m)}</span>)}</div>
    <div className="grid2"><label>Hours<select value={e.h} onChange={(x) => setE({ ...e, h: x.target.value })}>{Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>{i}</option>)}</select></label><label>Minutes<select value={e.m} onChange={(x) => setE({ ...e, m: x.target.value })}>{[0, 5, 10, 15, 20, 30, 45].map((i) => <option key={i} value={i}>{i}</option>)}</select></label></div>
    <p className="muted"><small>Customers can only book times where this whole duration fits in your hours.</small></p><input placeholder="Description (optional)" value={e.description ?? ""} onChange={(x) => setE({ ...e, description: x.target.value })} />{msg && <p className="note err">{msg}</p>}<button className="btn">Save hairstyle</button></form>);
  return (<><div className="row"><h2>My Hairstyles</h2><button className="btn sm" onClick={() => edit()}>+ Add</button></div>{msg && <p className="note err">{msg}</p>}{rows && !rows.length && <p className="muted center">Add each hairstyle you offer, with the time it usually takes.</p>}
    {rows?.map((s) => <div className="card" key={s.id}><div className="row"><span><b>{s.name}</b><br /><small>⏱ {dur(s.duration_minutes)} · {s.category ?? "General"}</small></span><b>{money(s.price, s.currency_code)}</b></div><div className="actions"><button className="btn sm ghost" onClick={() => edit(s)}>Edit</button><button className="btn sm ghost" onClick={() => toggle(s)}>{s.is_active ? "Switch off" : "Switch on"}</button><button className="btn sm dark" onClick={() => del(s)}>Delete</button></div></div>)}</>);
}

/* ---------------- Stylist: calendar, weekly hours, days off ---------------- */
export function Schedule({ uid }: { uid: string }) {
  const [month, setMonth] = useState(new Date()); const [day, setDay] = useState<string | null>(null); const [off, setOff] = useState<Set<string>>(new Set()); const [bk, setBk] = useState<any[]>([]); const [wk, setWk] = useState(DAYS.map(() => ({ on: false, start: "09:00", end: "17:00" }))); const [msg, setMsg] = useState("");
  const loadMonth = async () => {
    setOff(new Set(((await supabase.from("provider_days_off").select("off_date").eq("provider_id", uid)).data ?? []).map((x: any) => x.off_date)));
    setBk((await supabase.from("bookings").select("id,scheduled_start,scheduled_end,status,service_id").eq("provider_id", uid).not("status", "in", "(cancelled,rejected)").gte("scheduled_start", new Date(month.getFullYear(), month.getMonth(), 1).toISOString()).lt("scheduled_start", new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString())).data ?? []);
  };
  useEffect(() => { loadMonth(); }, [uid, month.getMonth(), month.getFullYear()]);
  useEffect(() => { supabase.from("provider_availability").select("*").eq("provider_id", uid).then(({ data }) => { const w = DAYS.map(() => ({ on: false, start: "09:00", end: "17:00" })); (data ?? []).forEach((a: any) => (w[a.day_of_week] = { on: true, start: a.start_time.slice(0, 5), end: a.end_time.slice(0, 5) })); setWk(w); }); }, [uid]);
  const dayBk = (k: string) => bk.filter((b) => ymd(new Date(b.scheduled_start)) === k);
  async function toggleOff() { if (!day) return; setMsg(""); const r = off.has(day) ? await supabase.from("provider_days_off").delete().eq("provider_id", uid).eq("off_date", day) : await supabase.from("provider_days_off").insert({ provider_id: uid, off_date: day }); if (r.error) setMsg(r.error.message); loadMonth(); }
  async function saveWeek() {
    setMsg(""); if (wk.some((d) => d.on && d.start >= d.end)) return setMsg("Closing time must be after opening time.");
    const del = await supabase.from("provider_availability").delete().eq("provider_id", uid); if (del.error) return setMsg(del.error.message);
    const rows = wk.map((d, i) => ({ d, i })).filter(({ d }) => d.on).map(({ d, i }) => ({ provider_id: uid, day_of_week: i, start_time: d.start + ":00", end_time: d.end + ":00" }));
    if (rows.length) { const r = await supabase.from("provider_availability").insert(rows); if (r.error) return setMsg(r.error.message); }
    const tz = await supabase.from("providers").update({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }).eq("id", uid); setMsg(tz.error ? "Hours saved, but your time zone wasn't: " + tz.error.message : "Working hours saved.");
  }
  return (<><h2>My Schedule</h2><p className="muted">Tap a day to see its bookings or mark it as a day off.</p>
    <CalendarGrid month={month} setMonth={setMonth} sel={day} info={(d) => ({ off: off.has(ymd(d)), dot: dayBk(ymd(d)).length > 0 })} onPick={(d) => setDay(ymd(d))} />
    {day && <div className="card"><div className="row"><b>{new Date(day + "T00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</b><button className="btn sm ghost" onClick={toggleOff}>{off.has(day) ? "Remove day off" : "Mark day off"}</button></div>{!dayBk(day).length && <small className="muted">No bookings.</small>}{dayBk(day).map((b) => <div key={b.id} className="row"><span>{new Date(b.scheduled_start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} - {new Date(b.scheduled_end).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span><span className={"pill s-" + b.status}>{b.status}</span></div>)}</div>}
    <h3>Weekly working hours</h3>{wk.map((d, i) => <div className="card row" key={i}><label className="row gap"><input type="checkbox" style={{ width: 20 }} checked={d.on} onChange={(e) => setWk(wk.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} /><b>{DAYS[i]}</b></label>{d.on && <span className="row gap"><input type="time" className="mini" value={d.start} onChange={(e) => setWk(wk.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} /><input type="time" className="mini" value={d.end} onChange={(e) => setWk(wk.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} /></span>}</div>)}
    {msg && <p className="note">{msg}</p>}<button className="btn" onClick={saveWeek}>Save working hours</button></>);
}
