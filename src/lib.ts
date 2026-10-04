import { createClient } from "@supabase/supabase-js";

// Public, client-safe values (the anon key is meant for browsers; RLS protects the data). Env vars override.
const URL = import.meta.env.VITE_SUPABASE_URL || "https://krhvfpblabfchrolhgve.supabase.co";
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyaHZmcGJsYWJmY2hyb2xoZ3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTg4NzksImV4cCI6MjA5NDc5NDg3OX0.sfvCXmO-qGsO7iY1oKRz2h0gwQpxwqccFdSqnZMjPYQ";
export const supabase = createClient(URL, KEY);

const MSG: Record<string, string> = {
  KYC_REQUIRED: "Verify your identity first (More > Identity verification).", INSUFFICIENT_FUNDS: "Not enough funds in your wallet.",
  PAYMENT_PROVIDER_NOT_CONFIGURED: "Payments aren't set up yet. Please try again later.", UNAUTHENTICATED: "Please log in again.",
  INVALID_STATE: "This booking can't be paid yet - the barber must accept it first.", ALREADY_PAID: "This booking is already paid.",
  NOT_A_PROVIDER: "Only barbers and stylists can subscribe.", VIP_PRICE_NOT_CONFIGURED: "VIP isn't available yet.", KYC_PROVIDER_NOT_CONFIGURED: "ID checks aren't available yet.",
  TOO_MANY_ATTEMPTS: "Too many attempts today. Try again tomorrow.", INVALID_AMOUNT: "Enter a valid amount.", RATE_LIMITED: "Slow down a little and try again.",
};

/** Call an Edge Function; throws a readable message. */
export async function fn<T = any>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let code = "";
    try { const j = await (error as any).context?.json?.(); code = j?.error ?? ""; } catch { /* ignore */ }
    throw new Error(MSG[code] ?? (code || "Something went wrong. Please try again."));
  }
  return data as T;
}

export const money = (n: number | null | undefined, cur = "NGN") => n == null ? "-" : new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(Number(n));
export const initials = (s?: string | null) => (s ?? "?").split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
export const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
