import { createClient } from "@supabase/supabase-js";

// Public, client-safe values (the anon key is meant for browsers; RLS protects the data). Env vars override.
const URL = import.meta.env.VITE_SUPABASE_URL || "https://krhvfpblabfchrolhgve.supabase.co";
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyaHZmcGJsYWJmY2hyb2xoZ3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTg4NzksImV4cCI6MjA5NDc5NDg3OX0.sfvCXmO-qGsO7iY1oKRz2h0gwQpxwqccFdSqnZMjPYQ";
export const supabase = createClient(URL, KEY);

/** Shrink a phone photo to a JPEG of at most 1600px so uploads stay far below the bucket limits (2-5 MB) and work on slow mobile networks. */
async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { return file; }
}

// Every storage upload goes through here: photos are compressed first and network failures become a readable message instead of "Failed to fetch".
const rawFrom = supabase.storage.from.bind(supabase.storage);
(supabase.storage as any).from = (bucket: string) => {
  const api: any = rawFrom(bucket); const up = api.upload.bind(api);
  api.upload = async (path: string, file: any, opts?: any) => {
    try { const f = file instanceof File && file.type.startsWith("image/") ? await shrink(file) : file; return await up(path, f, opts); }
    catch { return { data: null, error: { message: "Upload failed - check your internet connection and try again." } }; }
  };
  return api;
};

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
