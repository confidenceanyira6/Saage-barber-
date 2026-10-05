import { useEffect, useRef, useState } from "react";
import { supabase, when, initials, publicProfiles } from "./lib";
import { Back } from "./Shared";

export const isStylist = (role?: string | null) => role === "male_barber" || role === "female_stylist";
const roleLabel = (r?: string | null) => (r === "male_barber" ? "Male Barber" : r === "female_stylist" ? "Hairstylist" : "Customer");
const mediaUrl = (m: any) => (m?.path ? supabase.storage.from("posts").getPublicUrl(m.path).data.publicUrl : m?.url ?? "");
const avatarSrc = (a?: string | null) => (!a ? "" : a.startsWith("http") ? a : supabase.storage.from("avatars").getPublicUrl(a).data.publicUrl);

export function Pic({ name, src, size = 40 }: { name?: string | null; src?: string | null; size?: number }) {
  const u = avatarSrc(src);
  return u ? <img className="pic" src={u} alt={name ?? ""} style={{ width: size, height: size }} /> : <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials(name)}</div>;
}

/* ---------- Post card ---------- */
function PostCard({ post, uid, openProfile, onDeleted }: { post: any; uid: string; openProfile: (id: string) => void; onDeleted?: () => void }) {
  const [liked, setLiked] = useState(!!post.liked_by_me); const [likes, setLikes] = useState(post.like_count ?? 0); const [cc, setCc] = useState(post.comment_count ?? 0);
  const [open, setOpen] = useState(false); const [cm, setCm] = useState<any[]>([]); const [text, setText] = useState(""); const [err, setErr] = useState("");
  async function like() {
    const was = liked; setLiked(!was); setLikes(likes + (was ? -1 : 1));
    const r = was ? await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", uid) : await supabase.from("post_likes").insert({ post_id: post.id, user_id: uid });
    if (r.error) { setLiked(was); setLikes(likes); setErr(r.error.message); }
  }
  const loadC = async () => { const { data } = await supabase.rpc("get_comments", { p_post: post.id, p_limit: 40 }); setCm(data ?? []); };
  async function toggle() { setOpen(!open); if (!open) loadC(); }
  async function send(e: React.FormEvent) { e.preventDefault(); const b = text.trim(); if (!b) return; setErr(""); const { error } = await supabase.from("post_comments").insert({ post_id: post.id, author_id: uid, body: b.slice(0, 1000) }); if (error) return setErr(error.message); setText(""); setCc(cc + 1); loadC(); }
  async function del() { if (!confirm("Delete this post?")) return; const { error } = await supabase.from("posts").delete().eq("id", post.id); if (error) setErr(error.message); else onDeleted?.(); }
  const media: any[] = Array.isArray(post.media) ? post.media : [];
  return (<div className="post">
    <div className="row"><button className="row gap link ink" onClick={() => openProfile(post.author_id)}><Pic name={post.author_name} src={post.author_avatar} size={36} /><span><b>{post.author_name}</b><br /><small>{roleLabel(post.author_role)} · {when(post.created_at)}</small></span></button>{post.author_id === uid && <button className="link" onClick={del}>Delete</button>}</div>
    <div className="carousel">{media.map((m, i) => <img key={i} src={mediaUrl(m)} alt="Post" loading="lazy" />)}</div>
    <div className="row gap pa"><button className={"act" + (liked ? " on" : "")} onClick={like}>{liked ? "♥" : "♡"} {likes}</button><button className="act" onClick={toggle}>💬 {cc}</button></div>
    {post.body && <p className="cap"><b>{post.author_name}</b> {post.body}</p>}{err && <p className="note err">{err}</p>}
    {open && <div className="cmts">{cm.map((c) => <p key={c.id}><b>{c.author_name}</b> {c.body}</p>)}{!cm.length && <small className="muted">No comments yet.</small>}<form className="row gap" onSubmit={send}><input placeholder="Add a comment..." value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} /><button className="btn sm">Post</button></form></div>}
  </div>);
}

/* ---------- Compose (stylists, photos only) ---------- */
function Compose({ uid, done, cancel }: { uid: string; done: () => void; cancel: () => void }) {
  const [files, setFiles] = useState<File[]>([]); const [cap, setCap] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  function pick(e: React.ChangeEvent<HTMLInputElement>) { const f = [...(e.target.files ?? [])]; if (f.some((x) => !x.type.startsWith("image/"))) return setErr("Only photos are allowed."); if (f.some((x) => x.size > 25_000_000)) return setErr("That photo is too large."); setErr(""); setFiles(f.slice(0, 6)); }
  async function post() {
    if (!files.length) return setErr("Choose at least one photo."); setBusy(true); setErr(""); const media: any[] = [];
    try {
      for (const [i, f] of files.entries()) { const path = `${uid}/${Date.now()}-${i}.jpg`; const up = await supabase.storage.from("posts").upload(path, f, { contentType: "image/jpeg" }); if (up.error) { setErr("Photo upload failed: " + up.error.message); setBusy(false); return; } media.push({ type: "image", path }); }
      const { error } = await supabase.from("posts").insert({ author_id: uid, body: cap.trim(), media }); setBusy(false); if (error) setErr(error.message); else done();
    } catch (e: any) { setBusy(false); setErr("Could not post: " + (e?.message ?? "check your connection and try again")); }
  }
  return (<><Back go={cancel} /><h2>New post</h2><label className="btn ghost" style={{ textAlign: "center", cursor: "pointer" }}>{files.length ? `${files.length} photo(s) selected` : "Choose photos (up to 6)"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={pick} /></label>
    <div className="pgrid">{files.map((f, i) => <div key={i} className="pcell"><img src={URL.createObjectURL(f)} alt="" /></div>)}</div>
    <textarea className="ta" rows={3} placeholder="Write a caption (optional)..." value={cap} onChange={(e) => setCap(e.target.value)} maxLength={2200} />{err && <p className="note err">{err}</p>}<button className="btn" disabled={busy} onClick={post}>{busy ? "Posting..." : "Share"}</button><p className="muted"><small>Photos only. Show your best work.</small></p></>);
}

/* ---------- Feed ---------- */
export function Feed({ uid, role, openProfile }: { uid: string; role: string; openProfile: (id: string) => void }) {
  const [rows, setRows] = useState<any[] | null>(null); const [fol, setFol] = useState(false); const [err, setErr] = useState(""); const [more, setMore] = useState(true); const [composing, setComposing] = useState(false);
  const load = async (reset = true) => {
    const before = !reset && rows?.length ? rows[rows.length - 1].created_at : null;
    const { data, error } = await supabase.rpc("get_feed", { p_limit: 12, p_before: before, p_following_only: fol }); if (error) { setErr(error.message); setRows(rows ?? []); return; } setErr("");
    setMore((data ?? []).length === 12); setRows(reset ? data ?? [] : [...(rows ?? []), ...(data ?? [])]);
  };
  useEffect(() => { setRows(null); load(true); }, [fol]);
  if (composing) return <Compose uid={uid} cancel={() => setComposing(false)} done={() => { setComposing(false); setRows(null); load(true); }} />;
  return (<><div className="row"><h2>Saage</h2>{isStylist(role) && <button className="btn sm" onClick={() => setComposing(true)}>+ New post</button>}</div>
    <div className="tabs"><button className={!fol ? "on" : ""} onClick={() => setFol(false)}>For you</button><button className={fol ? "on" : ""} onClick={() => setFol(true)}>Following</button></div>
    {err && <p className="note err">{err} <button className="link" onClick={() => load(true)}>Retry</button></p>}{rows === null && <p className="muted">Loading...</p>}
    {rows && !rows.length && !err && <p className="muted center">{fol ? "Follow barbers and stylists to see their work here." : "No posts yet."}</p>}
    {rows?.map((p) => <PostCard key={p.id} post={p} uid={uid} openProfile={openProfile} onDeleted={() => load(true)} />)}{more && rows && rows.length > 0 && <button className="btn ghost" onClick={() => load(false)}>Load more</button>}</>);
}

/* ---------- Instagram-style profile ---------- */
export function ProfilePage({ uid, userId, role, openChat, back, onSettings }: { uid: string; userId: string; role: string; openChat: (id: string) => void; back?: () => void; onSettings?: () => void }) {
  const [p, setP] = useState<any>(null); const [pv, setPv] = useState<any>(null); const [st, setSt] = useState<any>(null); const [posts, setPosts] = useState<any[] | null>(null); const [view, setView] = useState<any | null>(null); const [composing, setComposing] = useState(false); const [msg, setMsg] = useState(""); const [failed, setFailed] = useState(false);
  const mine = uid === userId;
  const load = async () => {
    const pr = (await publicProfiles([userId]))[userId]; if (!pr) { setFailed(true); return; } setP(pr);
    setPv((await supabase.from("providers").select("bio,city,rating_avg,rating_count,is_vip").eq("id", userId).maybeSingle()).data);
    setSt((await supabase.rpc("profile_stats", { p_user: userId })).data);
    setPosts((await supabase.from("posts").select("id,author_id,body,media,like_count,comment_count,created_at").eq("author_id", userId).eq("is_hidden", false).order("created_at", { ascending: false }).limit(60)).data ?? []);
  };
  useEffect(() => { load(); }, [userId]);
  async function follow() { const f = st?.i_follow; const r = f ? await supabase.from("follows").delete().eq("follower_id", uid).eq("followee_id", userId) : await supabase.from("follows").insert({ follower_id: uid, followee_id: userId }); if (r.error) setMsg(r.error.message); setSt((await supabase.rpc("profile_stats", { p_user: userId })).data); }
  async function avatar(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (!f) return; if (!f.type.startsWith("image/")) return setMsg("Choose a photo."); const path = `${uid}/avatar-${Date.now()}.jpg`; const up = await supabase.storage.from("avatars").upload(path, f, { contentType: "image/jpeg" }); if (up.error) return setMsg(up.error.message); const r = await supabase.from("profiles").update({ avatar_url: path }).eq("id", uid); setMsg(r.error ? r.error.message : ""); load(); }
  async function openPost(x: any) { const liked = (await supabase.from("post_likes").select("post_id").eq("post_id", x.id).eq("user_id", uid)).data?.length ? true : false; setView({ ...x, author_name: p?.full_name, author_avatar: p?.avatar_url, author_role: p?.role, liked_by_me: liked }); }
  if (composing) return <Compose uid={uid} cancel={() => setComposing(false)} done={() => { setComposing(false); load(); }} />;
  if (view) return <><Back go={() => { setView(null); load(); }} /><PostCard post={view} uid={uid} openProfile={() => setView(null)} onDeleted={() => { setView(null); load(); }} /></>;
  if (failed) return <>{back && <Back go={back} />}<p className="note err">This profile couldn't be loaded. <button className="link" onClick={() => { setFailed(false); load(); }}>Retry</button></p></>;
  if (!p) return <>{back && <Back go={back} />}<p className="muted">Loading...</p></>;
  return (<>{back && <Back go={back} />}
    <div className="row"><h2 style={{ margin: 0 }}>{p.full_name}{pv?.is_vip && <span className="vip">VIP</span>}</h2>{mine && onSettings && <button className="link" onClick={onSettings}>⚙ Settings</button>}</div>
    <div className="ighead"><label className={mine ? "pointer" : ""}><Pic name={p.full_name} src={p.avatar_url} size={84} />{mine && <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={avatar} />}</label>
      <div className="stats"><div><b>{st?.posts ?? 0}</b><small>Posts</small></div><div><b>{st?.followers ?? 0}</b><small>Followers</small></div><div><b>{st?.following ?? 0}</b><small>Following</small></div></div></div>
    <p style={{ margin: "6px 0" }}><b>{roleLabel(p.role)}</b>{pv?.city ? ` · ${pv.city}` : ""}{pv?.rating_avg ? ` · ★ ${Number(pv.rating_avg).toFixed(1)}` : ""}</p>{pv?.bio && <p style={{ margin: "0 0 8px" }}>{pv.bio}</p>}{mine && <small className="muted">Tap your photo to change it.</small>}
    {msg && <p className="note err">{msg}</p>}
    <div className="grid2">{mine ? (isStylist(role) ? <button className="btn" onClick={() => setComposing(true)}>+ New post</button> : <span />) : <button className={"btn" + (st?.i_follow ? " ghost" : "")} onClick={follow}>{st?.i_follow ? "Following" : "Follow"}</button>}{!mine && <button className="btn dark" onClick={() => openChat(userId)}>Message</button>}</div>
    <div className="pgrid">{posts?.map((x) => { const m = Array.isArray(x.media) ? x.media[0] : null; return <button key={x.id} className="pcell" onClick={() => openPost(x)}>{m ? <img src={mediaUrl(m)} alt="" loading="lazy" /> : null}</button>; })}</div>
    {posts && !posts.length && <p className="muted center">{mine && isStylist(role) ? "Share your first photo." : "No posts yet."}</p>}</>);
}

/* ---------- Chat (both roles) ---------- */
export function Messages({ uid, role, with: target, clear, openProfile }: { uid: string; role: string; with: string | null; clear: () => void; openProfile: (id: string) => void }) {
  const [convs, setConvs] = useState<any[] | null>(null); const [people, setPeople] = useState<Record<string, any>>({}); const [open, setOpen] = useState<any | null>(null); const [err, setErr] = useState("");
  const load = async () => {
    const { data, error } = await supabase.from("conversations").select("*").or(`customer_id.eq.${uid},provider_id.eq.${uid}`).order("last_message_at", { ascending: false }); if (error) setErr(error.message); setConvs(data ?? []);
    const ids = (data ?? []).map((c: any) => (c.customer_id === uid ? c.provider_id : c.customer_id)); if (ids.length) setPeople(await publicProfiles(ids));
    return data ?? [];
  };
  useEffect(() => { (async () => {
    const list = await load(); if (!target) return;
    const ex = list.find((c: any) => c.customer_id === target || c.provider_id === target);
    if (ex) { setOpen(ex); clear(); return; }
    const row = isStylist(role) ? { customer_id: target, provider_id: uid } : { customer_id: uid, provider_id: target };
    const { data, error } = await supabase.from("conversations").insert(row).select("*").single(); if (error) setErr("Couldn't start the chat: " + error.message); else { setOpen(data); const n = await publicProfiles([target]); setPeople((p) => ({ ...p, ...n })); } clear();
  })(); }, [target]);
  if (open) { const o = people[open.customer_id === uid ? open.provider_id : open.customer_id]; return <Thread uid={uid} conv={open} other={o} back={() => { setOpen(null); load(); }} openProfile={openProfile} />; }
  return (<><h2>Messages</h2>{err && <p className="note err">{err}</p>}{convs === null && <p className="muted">Loading...</p>}{convs && !convs.length && <p className="muted center">No chats yet. Open a profile and tap Message to start one.</p>}
    {convs?.map((c) => { const o = people[c.customer_id === uid ? c.provider_id : c.customer_id]; return <button key={c.id} className="card row menu" onClick={() => setOpen(c)}><span className="row gap"><Pic name={o?.full_name} src={o?.avatar_url} /><b>{o?.full_name ?? "User"}</b></span><small>{c.last_message_at ? when(c.last_message_at) : ""}</small></button>; })}</>);
}

function Thread({ uid, conv, other, back, openProfile }: { uid: string; conv: any; other: any; back: () => void; openProfile: (id: string) => void }) {
  const [msgs, setMsgs] = useState<any[]>([]); const [text, setText] = useState(""); const [err, setErr] = useState(""); const end = useRef<HTMLDivElement>(null);
  const load = async () => { const { data } = await supabase.from("messages").select("*").eq("conversation_id", conv.id).order("created_at"); setMsgs(data ?? []); await supabase.from("messages").update({ is_read: true }).eq("conversation_id", conv.id).neq("sender_id", uid).eq("is_read", false); };
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [conv.id]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);
  async function send(e: React.FormEvent) { e.preventDefault(); const c = text.trim(); if (!c) return; setErr(""); setText(""); const { error } = await supabase.from("messages").insert({ conversation_id: conv.id, sender_id: uid, content: c }); if (error) { setErr(error.message); setText(c); return; } await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id); load(); }
  return (<><Back go={back} /><button className="row gap link ink" onClick={() => other && openProfile(other.id)}><Pic name={other?.full_name} src={other?.avatar_url} size={36} /><b>{other?.full_name ?? "Chat"}</b></button>
    <div className="msgs">{msgs.map((m) => <div key={m.id} className={"bubble " + (m.sender_id === uid ? "user" : "assistant")}>{m.content}</div>)}<div ref={end} /></div>{err && <p className="note err">{err}</p>}
    <form className="row gap" onSubmit={send}><input placeholder="Message..." value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} /><button className="btn sm">Send</button></form><p className="muted"><small>Never share passwords or codes in chat.</small></p></>);
}
