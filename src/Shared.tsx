import { useEffect, useState } from "react";
import { supabase, fn, money, when, initials } from "./lib";

export const Back = ({ go, label = "Back" }: { go: () => void; label?: string }) => <button className="link back" onClick={go}>‹ {label}</button>;
export const Avatar = ({ name, size = 44 }: { name?: string | null; size?: number }) => <div className="avatar" style={{ width: size, height: size }}>{initials(name)}</div>;
export const Stars = ({ n }: { n: number | null }) => <span className="stars">★ {n ? Number(n).toFixed(1) : "New"}</span>;

const BOOKING_ERR: Record<string, string> = {
  NOT_PAID: "This booking hasn't been paid in the app yet.", DISPUTED: "This booking is under dispute.", INVALID_STATE: "This booking can't be confirmed right now.",
  EXTERNAL_PAYMENT: "This booking is paid outside the app.", FORBIDDEN: "You can't do that on this booking.",
};

export function Bookings({ uid, isProvider }: { uid: string; isProvider: boolean }) {
  const [rows, setRows] = useState<any[] | null>(null); const [names, setNames] = useState<Record<string, string>>({}); const [tab, setTab] = useState("upcoming");
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState("");
  const load = async () => {
    const { data, error } = await supabase.from("bookings").select("*").eq(isProvider ? "provider_id" : "customer_id", uid).order("scheduled_start", { ascending: false }).limit(60);
    if (error) { setMsg(error.message); setRows([]); return; }
    setRows(data ?? []);
    const ids = [...new Set((data ?? []).map((b: any) => (isProvider ? b.customer_id : b.provider_id)))];
    const sids = [...new Set((data ?? []).map((b: any) => b.service_id).filter(Boolean))];
    const n: Record<string, string> = {};
    if (ids.length) { (await supabase.from("profiles").select("id,full_name").in("id", ids)).data?.forEach((p: any) => (n[p.id] = p.full_name ?? "User")); if (!isProvider) (await supabase.from("providers").select("id,business_name").in("id", ids)).data?.forEach((p: any) => p.business_name && (n[p.id] = p.business_name)); }
    if (sids.length) (await supabase.from("provider_services").select("id,name").in("id", sids)).data?.forEach((s: any) => (n[s.id] = s.name));
    setNames(n);
  };
  useEffect(() => { load(); }, [uid]);
  async function run(id: string, p: Promise<any>) { setBusy(id); setMsg(""); try { await p; await load(); } catch (e: any) { setMsg(e.message ?? String(e)); } setBusy(""); }
  const rpc = async (name: string, args: object) => { const { error } = await supabase.rpc(name, args); if (error) { const k = Object.keys(BOOKING_ERR).find((x) => error.message.includes(x)); throw new Error(k ? BOOKING_ERR[k] : error.message); } };
  async function pay(id: string) { const r = await fn("payments-init", { purpose: "booking", booking_id: id }); location.href = r.url; }
  const grp = (b: any) => ["cancelled", "rejected", "refunded"].includes(b.status) ? "cancelled" : b.status === "completed" || new Date(b.scheduled_start) < new Date(Date.now() - 36e5) ? "past" : "upcoming";
  const list = (rows ?? []).filter((b) => grp(b) === tab);
  return (<>
    <h2>My Bookings</h2>
    <div className="tabs">{["upcoming", "past", "cancelled"].map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>)}</div>
    {msg && <p className="note err">{msg}</p>}{rows === null && <p className="muted">Loading...</p>}
    {rows && !list.length && <p className="muted center">No {tab} bookings.</p>}
    {list.map((b) => {
      const ext = b.payment_method === "external";
      const live = ["accepted", "confirmed", "in_progress"].includes(b.status);
      const canConfirm = live && b.escrow_status !== "disputed" && (ext || b.escrow_status === "held");
      const mine = isProvider ? b.provider_confirmed_at : b.customer_confirmed_at;
      const theirs = isProvider ? b.customer_confirmed_at : b.provider_confirmed_at;
      return (<div className="card" key={b.id}>
      <div className="row"><div><b>{names[isProvider ? b.customer_id : b.provider_id] ?? "-"}</b><br /><small>{names[b.service_id] ?? "Service"} · {when(b.scheduled_start)}</small></div><span className={"pill s-" + b.status}>{b.status.replace("_", " ")}</span></div>
      <div className="row"><b>{money(b.price, b.currency_code)}</b><small>{ext ? "Paid outside the app" : "Escrow: " + b.escrow_status}</small></div>
      {ext && live && <small className="muted">Payment is handled directly between you and {isProvider ? "the customer" : "the barber"}. No money moves through Saage.</small>}
      <div className="actions">
        {!isProvider && !ext && ["accepted", "confirmed"].includes(b.status) && b.escrow_status === "none" && <button className="btn sm" disabled={busy === b.id} onClick={() => run(b.id, pay(b.id))}>Pay now</button>}
        {canConfirm && !mine && <button className="btn sm dark" disabled={busy === b.id} onClick={() => run(b.id, rpc("confirm_service", { p_booking: b.id }))}>{isProvider ? "I've finished the haircut - Confirm" : "Confirm haircut done"}</button>}
        {canConfirm && mine && !theirs && <small className="muted">You confirmed. Waiting for the {isProvider ? "customer" : "barber"} to confirm.</small>}
        {b.status === "completed" && b.customer_confirmed_at && b.provider_confirmed_at && <small className="muted">✓ Both confirmed{ext ? "" : isProvider ? " - payment sent to your wallet" : " - payment released to the barber"}</small>}
        {isProvider && b.status === "pending" && <><button className="btn sm" onClick={() => run(b.id, rpc("update_booking_status", { p_booking_id: b.id, p_new_status: "accepted" }))}>Accept</button><button className="btn sm ghost" onClick={() => run(b.id, rpc("update_booking_status", { p_booking_id: b.id, p_new_status: "rejected" }))}>Reject</button></>}
        {!isProvider && b.status === "pending" && <button className="btn sm ghost" onClick={() => run(b.id, rpc("update_booking_status", { p_booking_id: b.id, p_new_status: "cancelled" }))}>Cancel</button>}
      </div></div>);
    })}
  </>);
}

export function Wallet({ uid, isProvider }: { uid: string; isProvider: boolean }) {
  const [w, setW] = useState<any>(null); const [tx, setTx] = useState<any[]>([]); const [msg, setMsg] = useState(""); const [form, setForm] = useState(false);
  const [f, setF] = useState({ amount: "", bank_code: "", account_number: "", account_name: "" }); const [busy, setBusy] = useState(false);
  const load = async () => { setW((await supabase.from("wallets").select("*").eq("user_id", uid).maybeSingle()).data); setTx((await supabase.from("wallet_transactions").select("id,amount,currency_code,type,status,created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(30)).data ?? []); };
  useEffect(() => { load(); }, [uid]);
  async function withdraw(e: React.FormEvent) { e.preventDefault(); setBusy(true); setMsg(""); try { await fn("withdraw", { amount: Number(f.amount), destination: { bank_code: f.bank_code, account_number: f.account_number, account_name: f.account_name } }); setMsg("Withdrawal requested. It will show as pending until the bank confirms."); setForm(false); load(); } catch (er: any) { setMsg(er.message); } setBusy(false); }
  async function deposit() { const a = Number(prompt("Amount to add")); if (!a) return; try { const r = await fn("payments-init", { purpose: "wallet_deposit", amount: a }); location.href = r.url; } catch (er: any) { setMsg(er.message); } }
  return (<>
    <h2>{isProvider ? "My Earnings" : "Wallet"}</h2>
    <div className="card hero"><small>Available balance</small><b className="big">{money(w?.available_balance ?? 0, w?.currency_code ?? "NGN")}</b><small>Pending {money(w?.pending_balance ?? 0, w?.currency_code ?? "NGN")}</small></div>
    <div className="grid2">{!isProvider && <button className="btn" onClick={deposit}>Add money</button>}<button className="btn dark" onClick={() => setForm(!form)}>Withdraw</button></div>
    {msg && <p className="note">{msg}</p>}
    {form && <form className="stack card" onSubmit={withdraw}><input type="number" placeholder="Amount" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /><input placeholder="Bank code" value={f.bank_code} onChange={(e) => setF({ ...f, bank_code: e.target.value })} required /><input placeholder="Account number" value={f.account_number} onChange={(e) => setF({ ...f, account_number: e.target.value })} required /><input placeholder="Account name" value={f.account_name} onChange={(e) => setF({ ...f, account_name: e.target.value })} required /><button className="btn" disabled={busy}>Request withdrawal</button></form>}
    <h3>Transactions</h3>{!tx.length && <p className="muted">No transactions yet.</p>}
    {tx.map((t) => <div className="card row" key={t.id}><span>{String(t.type).replace(/_/g, " ")}<br /><small>{when(t.created_at)} · {t.status}</small></span><b className={Number(t.amount) >= 0 ? "up" : "down"}>{money(t.amount, t.currency_code)}</b></div>)}
  </>);
}

export function More({ uid, isProvider, name }: { uid: string; isProvider: boolean; name: string }) {
  const [page, setPage] = useState("menu"); const [msg, setMsg] = useState(""); const [notifs, setNotifs] = useState<any[]>([]);
  useEffect(() => { if (page === "notifs") supabase.from("notifications").select("id,title,body,is_read,created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(40).then(({ data }) => setNotifs(data ?? [])); }, [page, uid]);
  async function vip() { try { const r = await fn("payments-init", { purpose: "vip_subscription", months: 1 }); location.href = r.url; } catch (e: any) { setMsg(e.message); } }
  if (page === "notifs") return <><Back go={() => setPage("menu")} /><h2>Notifications</h2>{!notifs.length && <p className="muted">Nothing yet.</p>}{notifs.map((n) => <div className="card" key={n.id}><b>{n.title}</b><br /><small>{n.body}</small></div>)}</>;
  if (page === "kyc") return <><Back go={() => setPage("menu")} /><h2>Identity verification</h2><div className="card"><b>✓ Verified</b><br /><small>Your account is verified automatically. You can book home visits and withdraw earnings.</small></div></>;
  const items: [string, string, () => void][] = [["Notifications", "Alerts and updates", () => setPage("notifs")], ["Identity verification", "Verified automatically", () => setPage("kyc")], ...(isProvider ? [["Go VIP", "More bookings, more visibility", vip] as [string, string, () => void]] : []), ["Log out", "", () => supabase.auth.signOut()]];
  return <><div className="card row"><Avatar name={name} /><b>{name}</b></div>{msg && <p className="note">{msg}</p>}{items.map(([t, s, fnc]) => <button key={t} className="card row menu" onClick={fnc}><span><b>{t}</b><br /><small>{s}</small></span><span>›</span></button>)}</>;
}
