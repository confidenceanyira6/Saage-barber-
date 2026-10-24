import { useEffect, useState } from "react";
import { supabase } from "./lib";

/** Photos a stylist attaches to a hairstyle (provider_services row) so customers can see what they are booking. */
export const MAX_STYLE_PHOTOS = 6;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type StyleImage = { id: string; service_id: string; image_path: string; sort_order: number };

export const styleImgUrl = (path: string) => supabase.storage.from("portfolio").getPublicUrl(path).data.publicUrl;

/** All hairstyle photos for one stylist, grouped by service id. */
export async function loadStyleImages(providerId: string): Promise<Record<string, StyleImage[]>> {
  const { data } = await supabase.from("service_images").select("id,service_id,image_path,sort_order").eq("provider_id", providerId).order("sort_order");
  const out: Record<string, StyleImage[]> = {};
  (data ?? []).forEach((r: any) => { (out[r.service_id] ||= []).push(r); });
  return out;
}

/** Uploads files to storage and links them to a hairstyle. Returns an error message, or "" when everything worked. */
export async function saveStyleFiles(uid: string, serviceId: string, files: File[], startAt: number): Promise<string> {
  let err = "";
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const path = `${uid}/styles/${serviceId}/${Date.now()}-${i}-${f.name.replace(/[^\w.]/g, "_")}`;
    const up = await supabase.storage.from("portfolio").upload(path, f);
    if (up.error) { err = up.error.message; continue; }
    const r = await supabase.from("service_images").insert({ service_id: serviceId, provider_id: uid, image_path: path, sort_order: startAt + i });
    if (r.error) { err = r.error.message; await supabase.storage.from("portfolio").remove([path]); }
  }
  return err;
}

export async function removeStyleImages(rows: StyleImage[]) {
  if (!rows.length) return;
  await supabase.from("service_images").delete().in("id", rows.map((r) => r.id));
  await supabase.storage.from("portfolio").remove(rows.map((r) => r.image_path));
}

/** Stylist side: choose, preview and remove photos before saving a hairstyle. */
export function PhotoPicker({ existing, files, onAdd, onRemoveExisting, onRemoveFile }: { existing: StyleImage[]; files: File[]; onAdd: (f: File[]) => void; onRemoveExisting: (p: StyleImage) => void; onRemoveFile: (i: number) => void }) {
  const [previews, setPreviews] = useState<string[]>([]); const [warn, setWarn] = useState("");
  useEffect(() => { const urls = files.map((f) => URL.createObjectURL(f)); setPreviews(urls); return () => urls.forEach((u) => URL.revokeObjectURL(u)); }, [files]);
  const total = existing.length + files.length;
  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []); e.target.value = ""; setWarn("");
    const ok: File[] = []; let problem = "";
    for (const f of list) {
      if (!OK_TYPES.includes(f.type)) problem = "Use JPG, PNG or WebP photos.";
      else if (f.size > 5_000_000) problem = `${f.name} is over 5 MB.`;
      else if (total + ok.length >= MAX_STYLE_PHOTOS) problem = `You can add up to ${MAX_STYLE_PHOTOS} photos.`;
      else ok.push(f);
    }
    if (problem) setWarn(problem); if (ok.length) onAdd(ok);
  }
  return (<div className="stack"><b>Photos of this hairstyle</b><p className="muted" style={{ margin: 0 }}><small>Customers see these before they book. Up to {MAX_STYLE_PHOTOS} photos, 5 MB each.</small></p>
    {total > 0 && <div className="photos">
      {existing.map((p) => <div key={p.id} className="photo"><img src={styleImgUrl(p.image_path)} alt="Hairstyle" /><button type="button" aria-label="Remove photo" onClick={() => onRemoveExisting(p)}>×</button></div>)}
      {files.map((f, i) => <div key={f.name + i} className="photo">{previews[i] && <img src={previews[i]} alt="New photo" />}<button type="button" aria-label="Remove photo" onClick={() => onRemoveFile(i)}>×</button></div>)}
    </div>}
    {total < MAX_STYLE_PHOTOS && <label className="btn ghost" style={{ textAlign: "center", cursor: "pointer", display: "block" }}>+ Add photos<input type="file" accept={OK_TYPES.join(",")} multiple hidden onChange={pick} /></label>}
    {warn && <p className="note err">{warn}</p>}</div>);
}

/** Customer side: scrollable strip of a hairstyle's photos; tap one to view it full size. */
export function ServiceGallery({ images, size = 84 }: { images?: StyleImage[]; size?: number }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!images?.length) return null;
  return (<>
    <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "8px 0" }}>
      {images.map((im) => <img key={im.id} src={styleImgUrl(im.image_path)} alt="Hairstyle" loading="lazy" onClick={() => setOpen(styleImgUrl(im.image_path))} style={{ width: size, height: size, objectFit: "cover", borderRadius: 10, flex: "0 0 auto", cursor: "zoom-in" }} />)}
    </div>
    {open && <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}><img src={open} alt="Hairstyle" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 12 }} /></div>}
  </>);
}
