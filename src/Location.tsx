import { useEffect, useState } from "react";
import { supabase } from "./lib";

const COUNTRIES = ["NG", "GH", "KE", "ZA", "UG", "TZ", "RW", "ET", "EG", "MA", "SN", "CI", "CM", "ZM", "ZW", "BW", "NA", "GB", "IE", "US", "CA", "AE", "SA", "FR", "DE", "NL", "IT", "ES", "PT", "IN", "AU"];
export const countryName = (c: string) => { try { return new Intl.DisplayNames(undefined, { type: "region" }).of(c) ?? c; } catch { return c; } };
export interface Loc { country: string; state: string; city: string }
type Row = { country_code: string; state: string | null; city: string | null };
const uniq = (xs: (string | null)[]) => [...new Map(xs.filter(Boolean).map((x) => [(x as string).toLowerCase(), x as string])).values()].sort();

/** Country > state > town pickers built from where barbers actually are, so every choice returns results. */
export function LocationFilters({ value, onChange }: { value: Loc; onChange: (l: Loc) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { supabase.from("providers").select("country_code,state,city").eq("is_active", true).limit(2000).then(({ data }) => setRows((data as Row[]) ?? [])); }, []);
  if (!rows) return <p className="muted"><small>Loading locations...</small></p>;
  const inC = rows.filter((r) => !value.country || r.country_code === value.country);
  const inS = inC.filter((r) => !value.state || (r.state ?? "").toLowerCase() === value.state.toLowerCase());
  const countries = uniq(rows.map((r) => r.country_code)); const states = uniq(inC.map((r) => r.state)); const cities = uniq(inS.map((r) => r.city));
  if (!countries.length) return <p className="muted"><small>No barber locations yet.</small></p>;
  return (<div className="locgrid">
    <select value={value.country} onChange={(e) => onChange({ country: e.target.value, state: "", city: "" })}><option value="">All countries</option>{countries.map((c) => <option key={c} value={c}>{countryName(c)}</option>)}</select>
    <select value={value.state} disabled={!states.length} onChange={(e) => onChange({ ...value, state: e.target.value, city: "" })}><option value="">All states</option>{states.map((s) => <option key={s} value={s}>{s}</option>)}</select>
    <select value={value.city} disabled={!cities.length} onChange={(e) => onChange({ ...value, city: e.target.value })}><option value="">All towns</option>{cities.map((c) => <option key={c} value={c}>{c}</option>)}</select>
  </div>);
}

/** Profile photo for everyone; country, state and town for barbers/stylists (so customers can find them by location). */
export function ProfileSetup({ uid, isProvider, onDone }: { uid: string; isProvider: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false); const [loc, setLoc] = useState<Loc>({ country: "NG", state: "", city: "" }); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open && isProvider) supabase.from("providers").select("country_code,state,city").eq("id", uid).maybeSingle().then(({ data }) => data && setLoc({ country: data.country_code ?? "NG", state: data.state ?? "", city: data.city ?? "" })); }, [open]);
  async function photo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return; if (!f.type.startsWith("image/")) return setMsg("Choose a photo."); setBusy(true); setMsg("");
    const path = `${uid}/avatar-${Date.now()}.jpg`; const up = await supabase.storage.from("avatars").upload(path, f, { contentType: "image/jpeg" });
    if (up.error) { setMsg("Photo upload failed: " + up.error.message); setBusy(false); return; }
    const r = await supabase.from("profiles").update({ avatar_url: path }).eq("id", uid); setBusy(false); if (r.error) setMsg(r.error.message); else { setMsg("Profile photo updated."); onDone(); }
  }
  async function saveLoc(e: React.FormEvent) {
    e.preventDefault(); setMsg(""); if (!loc.country || !loc.state.trim() || !loc.city.trim()) return setMsg("Choose your country and enter your state and town.");
    const r = await supabase.from("providers").update({ country_code: loc.country, state: loc.state.trim(), city: loc.city.trim() }).eq("id", uid); setMsg(r.error ? r.error.message : "Location saved. Customers can now find you by location.");
  }
  return (<div className="card"><button className="btn ghost" style={{ margin: 0 }} onClick={() => setOpen(!open)}>{open ? "Close" : isProvider ? "Edit photo & location" : "Change profile photo"}</button>
    {open && <div className="stack" style={{ marginTop: 10 }}><label className="btn" style={{ textAlign: "center", cursor: "pointer", margin: 0 }}>{busy ? "Uploading..." : "Choose profile photo"}<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={photo} disabled={busy} /></label>
      {isProvider && <form className="stack" onSubmit={saveLoc}><b>Where do you work?</b><select value={loc.country} onChange={(e) => setLoc({ ...loc, country: e.target.value })}>{COUNTRIES.map((c) => <option key={c} value={c}>{countryName(c)}</option>)}</select><input placeholder="State (e.g. Lagos)" value={loc.state} onChange={(e) => setLoc({ ...loc, state: e.target.value })} /><input placeholder="Town / city (e.g. Ikeja)" value={loc.city} onChange={(e) => setLoc({ ...loc, city: e.target.value })} /><button className="btn">Save location</button></form>}
      {msg && <p className="note">{msg}</p>}</div>}</div>);
}
