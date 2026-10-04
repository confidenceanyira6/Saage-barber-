import { useEffect, useRef, useState } from "react";
import { supabase, money, when } from "./lib";
import { Avatar, Back, Stars } from "./Shared";

type Page = "menu" | "requests" | "chat" | "analytics" | "preview" | "settings" | "help";

export function StylistExtras({ uid, name, email }: { uid: string; name: string; email?: string }) {
  const [page, setPage] = useState<Page>("menu");
  const b = () => setPage("menu");
  if (page === "requests") return <Requests uid={uid} back={b} />;
  if (page === "chat") return <Chats uid={uid} back={b} />;
  if (page === "analytics") return <Analytics uid={uid} back={b} />;
  if (page === "preview") return <Preview uid={uid} back={b} />;
  if (page === "settings") return <Settings email={email} back={b} />;
  if (page === "help") return <Help back={b} />;
  const items: [Page, string, string][] = [["requests", "Home service requests", "Customers who want you to come to them"], ["chat", "Customer chat", "Message your customers"], ["analytics", "Earnings analytics", "Your last 7 days"], ["preview", "Public profile preview", "See what customers see"], ["settings", "Settings", "Password and security"], ["help", "Help & support", "Answers to common questions"]];
  return <>{items.map(([k, t, s]) => <button key={k} className="card row menu" onClick={() => setPage(k)}><span><b>{t}</b><br /><small>{s}</small></span><span>›</span></button>)}<span hidden>{name}</span></>;
}

function Requests({ uid, back }: { uid: string; back: () => void }) {
  const [rows, setRows] = useState<any[] | null>(null); const [names, setNames] = useState<Record<string, string>>({}); const [msg, setMsg] = useState("");
  const load = async () => {
    const { data, error } = await supabase.from("bookings").select("*").eq("provider_id", uid).neq("location_type", "shop").order("scheduled_start", { ascending: false }).limit(40);
    if (error) setMsg(error.message); setRows(data ?? []);
    const ids = [...new Set((data ?? []).map((x: any) => x.customer_id))]; if (ids.length) { const n: Record<string, string> = {}; (await supabase.from("profiles").select("id,full_name").in("id", ids)).data?.forEach((p: any) => (n[p.id] = p.full_name ?? "Customer")); setNames(n); }
  };
  useEffect(() => { load(); }, [uid]);
  async function act(id: string, s: string) { setMsg(""); const { error } = await supabase.rpc("update_booking_status", { p_booking_id: id, p_new_status: s }); if (error) setMsg(error.message); load(); }
  return (<><Back go={back} /><h2>Home Service Requests</h2>{msg && <p className="note err">{msg}</p>}{rows === null && <p className="muted">Loading...</p>}{rows && !rows.length && <p className="muted center">No home service requests yet. Switch on home service in Edit profile.</p>}
    {rows?.map((r) => <div className="card" key={r.id}><div className="row"><b>{names[r.customer_id] ?? "Customer"}</b><span className={"pill s-" + r.status}>{r.status}</span></div><small>{when(r.scheduled_start)}</small><br /><b>{money(r.price, r.currency_code)}</b>{r.status === "pending" && <div className="actions"><button className="btn sm" onClick={() => act(r.id, "accepted")}>Accept</button><button className="btn sm ghost" onClick={() => act(r.id, "rejected")}>Decline</button></div>}</div>)}</>);
}

function Chats({ uid, back }: { uid: string; back: () => void }) {
  const [convs, setConvs] = useState<any[] | null>(null); const [names, setNames] = useState<Record<string, string>>({}); const [open, setOpen] = useState<any | null>(null); const [cands, setCands] = useState<any[]>([]); const [msg, setMsg] = useState("");
  const load = async () => {
    const { data } = await supabase.from("conversations").select("*").eq("provider_id", uid).order("last_message_at", { ascending: false }); setConvs(data ?? []);
    const bk = (await supabase.from("bookings").select("id,customer_id").eq("provider_id", uid).limit(60)).data ?? [];
    const ids = [...new Set([...(data ?? []).map((c: any) => c.customer_id), ...bk.map((x: any) => x.customer_id)])];
    if (ids.length) { const n: Record<string, string> = {}; (await supabase.from("profiles").select("id,full_name").in("id", ids)).data?.forEach((p: any) => (n[p.id] = p.full_name ?? "Customer")); setNames(n); }
    const have = new Set((data ?? []).map((c: any) => c.customer_id)); const seen = new Set<string>();
    setCands(bk.filter((x: any) => !have.has(x.customer_id) && !seen.has(x.customer_id) && seen.add(x.customer_id)));
  };
  useEffect(() => { load(); }, [uid]);
  async function start(c: any) { const { data, error } = await supabase.from("conversations").insert({ customer_id: c.customer_id, provider_id: uid, booking_id: c.id }).select("*").single(); if (error) return setMsg(error.message); setOpen(data); }
  if (open) return <Thread uid={uid} conv={open} title={names[open.customer_id] ?? "Customer"} back={() => { setOpen(null); load(); }} />;
  return (<><Back go={back} /><h2>Customer Chat</h2>{msg && <p className="note err">{msg}</p>}{convs === null && <p className="muted">Loading...</p>}{convs && !convs.length && !cands.length && <p className="muted center">No chats yet. Customers you have bookings with will appear here.</p>}
    {convs?.map((c) => <button key={c.id} className="card row menu" onClick={() => setOpen(c)}><span className="row gap"><Avatar name={names[c.customer_id]} /><b>{names[c.customer_id] ?? "Customer"}</b></span><small>{c.last_message_at ? when(c.last_message_at) : ""}</small></button>)}
    {cands.length > 0 && <><h3>Start a chat</h3>{cands.map((c) => <div key={c.id} className="card row"><span>{names[c.customer_id] ?? "Customer"}</span><button className="btn sm" onClick={() => start(c)}>Message</button></div>)}</>}</>);
}

function Thread({ uid, conv, title, back }: { uid: string; conv: any; title: string; back: () => void }) {
  const [msgs, setMsgs] = useState<any[]>([]); const [text, setText] = useState(""); const [err, setErr] = useState(""); const end = useRef<HTMLDivElement>(null);
  const load = async () => { const { data } = await supabase.from("messages").select("*").eq("conversation_id", conv.id).order("created_at"); setMsgs(data ?? []); await supabase.from("messages").update({ is_read: true }).eq("conversation_id", conv.id).neq("sender_id", uid).eq("is_read", false); };
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [conv.id]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);
  async function send(e: React.FormEvent) { e.preventDefault(); const c = text.trim(); if (!c) return; setErr(""); setText(""); const { error } = await supabase.from("messages").insert({ conversation_id: conv.id, sender_id: uid, content: c }); if (error) { setErr(error.message); setText(c); return; } await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id); load(); }
  return (<><Back go={back} /><h2>{title}</h2><div className="msgs">{msgs.map((m) => <div key={m.id} className={"bubble " + (m.sender_id === uid ? "user" : "assistant")}>{m.content}</div>)}<div ref={end} /></div>{err && <p className="note err">{err}</p>}<form className="row gap" onSubmit={send}><input placeholder="Type a message..." value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} /><button className="btn sm">Send</button></form><p className="muted"><small>Never share passwords or codes in chat.</small></p></>);
}

function Analytics({ uid, back }: { uid: string; back: () => void }) {
  const [tx, setTx] = useState<any[] | null>(null); const [cur, setCur] = useState("NGN");
  useEffect(() => { supabase.from("wallet_transactions").select("amount,currency_code,created_at").eq("user_id", uid).gt("amount", 0).gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString()).then(({ data }) => { setTx(data ?? []); if (data?.[0]) setCur(data[0].currency_code); }); }, [uid]);
  if (!tx) return <><Back go={back} /><p className="muted">Loading...</p></>;
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const vals = days.map((d) => tx.filter((t) => new Date(t.created_at).toDateString() === d.toDateString()).reduce((s, t) => s + Number(t.amount), 0)); const max = Math.max(...vals, 1);
  return (<><Back go={back} /><h2>Earnings Analytics</h2><div className="card hero"><small>Money received, last 7 days</small><b className="big">{money(vals.reduce((a, b) => a + b, 0), cur)}</b></div>
    <div className="card"><div className="bars">{vals.map((v, i) => <div key={i} className="barcol"><i style={{ height: `${(v / max) * 100}%` }} /><small>{days[i].toLocaleDateString(undefined, { weekday: "narrow" })}</small></div>)}</div></div>{!tx.length && <p className="muted center">No earnings in the last 7 days.</p>}</>);
}

function Preview({ uid, back }: { uid: string; back: () => void }) {
  const [p, setP] = useState<any>(null); const [svc, setSvc] = useState<any[]>([]); const [ph, setPh] = useState<any[]>([]);
  useEffect(() => { (async () => { setP((await supabase.from("providers").select("*").eq("id", uid).maybeSingle()).data); setSvc((await supabase.from("provider_services").select("*").eq("provider_id", uid).eq("is_active", true)).data ?? []); setPh((await supabase.from("portfolio_items").select("*").eq("provider_id", uid).order("sort_order").limit(6)).data ?? []); })(); }, [uid]);
  if (!p) return <><Back go={back} /><p className="muted">Loading...</p></>;
  return (<><Back go={back} /><h2>Public Profile Preview</h2><div className="card hero"><div className="row gap"><Avatar name={p.business_name} size={64} /><div><b>{p.business_name}</b>{p.is_vip && <span className="vip">VIP</span>}<br /><Stars n={p.rating_avg} /> <small>({p.rating_count ?? 0})</small><br /><small>{p.city}{p.home_service_enabled ? " · Home service" : ""}</small></div></div>{p.bio && <p>{p.bio}</p>}</div>
    {ph.length > 0 && <div className="photos">{ph.map((x) => <div key={x.id} className="photo"><img src={supabase.storage.from("portfolio").getPublicUrl(x.image_path).data.publicUrl} alt="Work" /></div>)}</div>}<h3>Services</h3>{!svc.length && <p className="muted">No active services - customers can't book you yet.</p>}{svc.map((s) => <div className="card row" key={s.id}><span><b>{s.name}</b><br /><small>{s.duration_minutes} mins</small></span><b>{money(s.price, s.currency_code)}</b></div>)}</>);
}

function Settings({ email, back }: { email?: string; back: () => void }) {
  const [pw, setPw] = useState(""); const [msg, setMsg] = useState("");
  async function change(e: React.FormEvent) { e.preventDefault(); const { error } = await supabase.auth.updateUser({ password: pw }); setMsg(error ? error.message : "Password updated."); setPw(""); }
  return (<><Back go={back} /><h2>Settings</h2><div className="card"><small>Signed in as</small><br /><b>{email}</b></div><h3>Change password</h3><form className="stack" onSubmit={change}><input type="password" minLength={8} placeholder="New password (8+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} required /><button className="btn">Update password</button></form>{msg && <p className="note">{msg}</p>}<p className="muted"><small>The app follows your phone's light or dark setting.</small></p></>);
}

function Help({ back }: { back: () => void }) {
  const faq: [string, string][] = [["How do I get paid?", "Customers pay after you accept a booking. The money is held safely until you and the customer both confirm the service, then it moves to your wallet."], ["How do I withdraw?", "Verify your identity in More, then use Earnings > Withdraw with your bank details."], ["What if a customer doesn't confirm?", "If both sides haven't confirmed within the escrow window after the appointment, the customer is refunded automatically."], ["What is VIP?", "A paid plan that gives your profile more visibility. Find it in More > Go VIP."], ["Why can't customers book me?", "You need at least one active service and some availability hours set."]];
  return <><Back go={back} /><h2>Help &amp; Support</h2>{faq.map(([q, a]) => <details key={q} className="card"><summary><b>{q}</b></summary><p className="muted">{a}</p></details>)}</>;
}
