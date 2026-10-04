import { useState } from "react";
import { supabase } from "./lib";

export const Logo = ({ size = 40 }: { size?: number }) => <div className="slogo" style={{ width: size, height: size, fontSize: size * 0.7 }}>S</div>;

export function Splash() { return <div className="center-screen"><Logo size={88} /><h1 className="brand">Saage</h1><p className="muted">Barber &amp; Beauty Marketplace</p><p className="tag3">Look Good · Feel Good · Book Easy</p></div>; }

type Step = "welcome" | "login" | "role" | "style" | "register" | "verify";

export default function Auth() {
  const [step, setStep] = useState<Step>("welcome");
  const [role, setRole] = useState("customer");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    const r = step === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: name, role }, emailRedirectTo: location.origin } });
    if (r.error) setMsg(r.error.message); else if (step === "register" && !r.data.session) setStep("verify");
    setBusy(false);
  }
  const google = () => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin } }).then(({ error }) => error && setMsg(error.message));

  if (step === "welcome") return <div className="center-screen"><Logo size={72} /><h1 className="brand">Saage</h1><p className="muted">Barber &amp; Beauty Marketplace<br />Professional · Trusted · Convenient</p><button className="btn" onClick={() => setStep("role")}>Get Started</button><button className="btn dark" onClick={() => setStep("login")}>Log In</button></div>;
  if (step === "role") return <div className="page"><h2>Choose your account type</h2><button className="bigopt" onClick={() => { setRole("customer"); setStep("register"); }}><b>Customer</b><small>Find and book barbers &amp; stylists</small></button><button className="bigopt black" onClick={() => setStep("style")}><b>Hair Stylist</b><small>Offer services and get bookings</small></button><button className="link" onClick={() => setStep("welcome")}>Back</button></div>;
  if (step === "style") return <div className="page"><h2>Choose your stylist type</h2><button className="bigopt black" onClick={() => { setRole("male_barber"); setStep("register"); }}><b>Male Barber</b></button><button className="bigopt black" onClick={() => { setRole("female_stylist"); setStep("register"); }}><b>Female Hairstylist</b></button><button className="link" onClick={() => setStep("role")}>Back</button></div>;
  if (step === "verify") return <div className="center-screen"><div className="ring">✉</div><h2>Check your email</h2><p className="muted">We sent a verification link to <b>{email}</b>. Open it, then log in.</p><button className="btn" onClick={() => setStep("login")}>Go to login</button></div>;
  return (
    <div className="page"><div className="center"><Logo size={56} /><h2>{step === "login" ? "Welcome Back" : "Create your account"}</h2></div>
      <form onSubmit={submit} className="stack">
        {step === "register" && <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="btn" disabled={busy}>{step === "login" ? "Login" : "Create Account"}</button>
        {msg && <p className="note err">{msg}</p>}
      </form>
      <button className="btn ghost" onClick={google}>Continue with Google</button>
      <p className="center muted">{step === "login" ? <>New here? <a className="alink" onClick={() => setStep("role")}>Create account</a></> : <>Have an account? <a className="alink" onClick={() => setStep("login")}>Login</a></>}</p>
    </div>
  );
}
