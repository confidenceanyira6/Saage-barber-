import { useState } from "react";
import { supabase } from "./lib";

export const Logo = ({ size = 40 }: { size?: number }) => <div className="slogo" style={{ width: size, height: size, fontSize: size * 0.7 }}>S</div>;

export function Splash() { return <div className="center-screen"><Logo size={88} /><h1 className="brand">Saage</h1><p className="muted">Barber &amp; Beauty Marketplace</p><p className="tag3">Look Good · Feel Good · Book Easy</p></div>; }

/** Password field with an eye button to show or hide what is being typed. */
export function PasswordInput({ value, onChange, placeholder = "Password", autoComplete }: { value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input type={show ? "text" : "password"} placeholder={placeholder} minLength={8} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required style={{ paddingRight: 48 }} />
      <button type="button" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow(!show)} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: "auto", minWidth: 0, height: "auto", margin: 0, background: "none", border: 0, boxShadow: "none", padding: 8, cursor: "pointer", color: "inherit", lineHeight: 0, opacity: 0.7 }}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {show
            ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><path d="M1 1l22 22" /></>
            : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
        </svg>
      </button>
    </div>
  );
}

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
    if (r.error) setMsg(r.error.message);
    else if (step === "register" && !r.data.session) {
      // Accounts are verified automatically, so sign straight in. Only fall back to the email screen if that fails.
      const s = await supabase.auth.signInWithPassword({ email, password });
      if (s.error) setStep("verify");
    }
    setBusy(false);
  }
  const google = () => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin } }).then(({ error }) => error && setMsg(error.message));

  if (step === "welcome") return <div className="center-screen"><Logo size={72} /><h1 className="brand">Saage</h1><p className="muted">Barber &amp; Beauty Marketplace<br />Professional · Trusted · Convenient</p><button className="btn" onClick={() => setStep("role")}>Get Started</button><button className="btn dark" onClick={() => setStep("login")}>Log In</button></div>;
  if (step === "role") return <div className="page"><h2>Choose your account type</h2><button className="bigopt" onClick={() => { setRole("customer"); setStep("register"); }}><b>Customer</b><small>Find and book barbers &amp; stylists</small></button><button className="bigopt black" onClick={() => setStep("style")}><b>Hair Stylist</b><small>Offer services and get bookings</small></button><button className="link" onClick={() => setStep("welcome")}>Back</button></div>;
  if (step === "style") return <div className="page"><h2>Choose your stylist type</h2><button className="bigopt black" onClick={() => { setRole("male_barber"); setStep("register"); }}><b>Male Barber</b></button><button className="bigopt black" onClick={() => { setRole("female_stylist"); setStep("register"); }}><b>Female Hairstylist</b></button><button className="link" onClick={() => setStep("role")}>Back</button></div>;
  if (step === "verify") return <div className="center-screen"><div className="ring">✉</div><h2>Account created</h2><p className="muted">Your account <b>{email}</b> is ready. Please log in.</p><button className="btn" onClick={() => setStep("login")}>Go to login</button></div>;
  return (
    <div className="page"><div className="center"><Logo size={56} /><h2>{step === "login" ? "Welcome Back" : "Create your account"}</h2></div>
      <form onSubmit={submit} className="stack">
        {step === "register" && <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <PasswordInput key={step} value={password} onChange={setPassword} autoComplete={step === "login" ? "current-password" : "new-password"} />
        <button className="btn" disabled={busy}>{step === "login" ? "Login" : "Create Account"}</button>
        {msg && <p className="note err">{msg}</p>}
      </form>
      <button className="btn ghost" onClick={google}>Continue with Google</button>
      <p className="center muted">{step === "login" ? <>New here? <a className="alink" onClick={() => setStep("role")}>Create account</a></> : <>Have an account? <a className="alink" onClick={() => setStep("login")}>Login</a></>}</p>
    </div>
  );
}
