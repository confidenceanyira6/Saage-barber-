import { useEffect, useState } from "react";
import { supabase, money } from "./lib";
import { Stars } from "./Shared";

/** Stylist dashboard: balance, requests, rating and a short setup checklist. */
export function Dashboard({ uid, go }: { uid: string; go: (tab: string) => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { (async () => {
    const c = async (t: string, extra?: (q: any) => any) => { let q: any = supabase.from(t).select("id", { count: "exact", head: true }).eq("provider_id", uid); if (extra) q = extra(q); return (await q).count ?? 0; };
    const [prov, wal, prof, svc, av, pend, up] = await Promise.all([
      supabase.from("providers").select("business_name,rating_avg,rating_count,is_vip").eq("id", uid).maybeSingle(), supabase.from("wallets").select("available_balance,currency_code").eq("user_id", uid).maybeSingle(),
      supabase.from("profiles").select("identity_verification").eq("id", uid).maybeSingle(), c("provider_services"), c("provider_availability"),
      c("bookings", (q) => q.eq("status", "pending")), c("bookings", (q) => q.in("status", ["accepted", "confirmed", "in_progress"])),
    ]);
    setD({ prov: prov.data, wal: wal.data, kyc: prof.data?.identity_verification, svc, av, pend, up });
  })(); }, [uid]);
  if (!d) return <p className="muted">Loading...</p>;
  const steps: [string, boolean, string][] = [["Add your hairstyles", d.svc > 0, "services"], ["Set your working hours", d.av > 0, "schedule"], ["Verify your identity", d.kyc === "verified", "tools"]];
  const left = steps.filter((s) => !s[1]);
  return (<>
    <h2>Hello, {d.prov?.business_name ?? "Stylist"} {d.prov?.is_vip && <span className="vip">VIP</span>}</h2>
    <div className="card hero"><small>Available balance</small><b className="big">{money(d.wal?.available_balance ?? 0, d.wal?.currency_code ?? "NGN")}</b></div>
    <div className="grid2"><div className="card"><small>New requests</small><b className="big">{d.pend}</b></div><div className="card"><small>Upcoming</small><b className="big">{d.up}</b></div></div>
    <div className="card row"><span><small>Rating</small><br /><Stars n={d.prov?.rating_avg} /> <small>({d.prov?.rating_count ?? 0})</small></span><button className="btn sm" onClick={() => go("book")}>View bookings</button></div>
    {left.length > 0 && <><h3>Finish setting up</h3>{steps.map(([t, ok, tab]) => <button key={t} className="card row menu" onClick={() => go(tab)}><span>{ok ? "✅" : "⬜"} {t}</span><span>›</span></button>)}</>}
  </>);
}
