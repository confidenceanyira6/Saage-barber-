import { useState } from "react";
import { supabase } from "./lib";

export type Theme = "system" | "light" | "dark";

export function applyTheme(t: string | null | undefined) {
  const v: Theme = t === "light" || t === "dark" ? t : "system";
  document.documentElement.dataset.theme = v;
  try { localStorage.setItem("saage-theme", v); } catch { /* private mode */ }
  const dark = v === "dark" || (v === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b0b0c" : "#ffffff");
}

export function initTheme() { let t: string | null = null; try { t = localStorage.getItem("saage-theme"); } catch { /* ignore */ } applyTheme(t); }

export function ThemePicker({ uid }: { uid: string }) {
  const [cur, setCur] = useState<Theme>((document.documentElement.dataset.theme as Theme) || "system"); const [msg, setMsg] = useState("");
  async function pick(t: Theme) {
    setCur(t); applyTheme(t); setMsg("");
    const { error } = await supabase.from("profiles").update({ theme: t }).eq("id", uid);
    if (error) setMsg("Theme changed on this device, but couldn't be saved to your account: " + error.message);
  }
  const opts: [Theme, string, string][] = [["light", "Light", "White background, black text"], ["dark", "Dark", "Black background, white text"], ["system", "Match my phone", "Switches automatically"]];
  return (<><h3>Theme</h3>{opts.map(([k, l, d]) => <button key={k} className={"card row menu" + (cur === k ? " picked" : "")} onClick={() => pick(k)}><span><b>{l}</b><br /><small>{d}</small></span><span>{cur === k ? "✓" : ""}</span></button>)}{msg && <p className="note err">{msg}</p>}</>);
}
