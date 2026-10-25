import { useState } from "react";
import { styleImgUrl, type StyleImage } from "./ServiceImages";

/** Stylist's hairstyle card: the photo fills the card and the Edit / Switch / Delete controls sit in its top-right corner. */
const ico = (d: string) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const PENCIL = "M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z";
const POWER = "M12 2v10M18.4 6.6a9 9 0 11-12.8 0";
const TRASH = "M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6M10 11v6M14 11v6";
const BTN: React.CSSProperties = { width: 36, height: 36, borderRadius: 18, border: 0, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.6)", color: "#fff", cursor: "pointer" };
const BADGE: React.CSSProperties = { position: "absolute", background: "rgba(0,0,0,.6)", color: "#fff", borderRadius: 12, padding: "3px 10px", fontSize: 12 };

export function StyleCard({ title, meta, price, active, images, onEdit, onToggle, onDelete }: { title: string; meta: string; price: string; active: boolean; images?: StyleImage[]; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState<string | null>(null); const [idx, setIdx] = useState(0);
  const list = images ?? [];
  return (<div className="card" style={{ padding: 0, overflow: "hidden" }}>
    <div style={{ position: "relative" }}>
      {list.length > 0
        ? <div onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))} style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", opacity: active ? 1 : 0.5 }}>
          {list.map((im) => <img key={im.id} src={styleImgUrl(im.image_path)} alt={title} loading="lazy" onClick={() => setOpen(styleImgUrl(im.image_path))} style={{ flex: "0 0 100%", width: "100%", height: 280, objectFit: "cover", scrollSnapAlign: "center", cursor: "zoom-in", display: "block" }} />)}
        </div>
        : <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 16, background: "rgba(128,128,128,.15)" }} className="muted"><small>No photo yet. Tap the pencil to add one so customers can see the look.</small></div>}
      <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
        <button type="button" aria-label="Edit" title="Edit" style={BTN} onClick={onEdit}>{ico(PENCIL)}</button>
        <button type="button" aria-label={active ? "Switch off" : "Switch on"} title={active ? "Switch off" : "Switch on"} style={{ ...BTN, background: active ? "rgba(0,0,0,.6)" : "#16a34a" }} onClick={onToggle}>{ico(POWER)}</button>
        <button type="button" aria-label="Delete" title="Delete" style={{ ...BTN, background: "rgba(185,28,28,.9)" }} onClick={onDelete}>{ico(TRASH)}</button>
      </div>
      {!active && <span style={{ ...BADGE, top: 14, left: 10 }}>Switched off</span>}
      {list.length > 1 && <span style={{ ...BADGE, bottom: 10, right: 10 }}>{Math.min(idx + 1, list.length)}/{list.length}</span>}
    </div>
    <div className="row" style={{ padding: "10px 14px 14px" }}><span><b>{title}</b><br /><small>{meta}</small></span><b>{price}</b></div>
    {open && <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}><img src={open} alt={title} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 12 }} /></div>}
  </div>);
}
