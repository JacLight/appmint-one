"use server";

import { signInAction } from "./auth";

/** Dev-only quick login. Accounts come from the DEV_QUICK_LOGINS env var (a JSON
 *  array), so real passwords live only in .env.local — never in code, never sent
 *  to the browser. Hard-disabled in production. */
type DevLogin = { email: string; label?: string; role?: string; pw?: string };

function loadLogins(): DevLogin[] {
  if (process.env.NODE_ENV === "production") return [];
  try {
    const arr = JSON.parse(process.env.DEV_QUICK_LOGINS || "[]");
    return Array.isArray(arr) ? arr.filter((x: any) => x?.email) : [];
  } catch { return []; }
}

/** The pickable accounts — labels + emails only, NO passwords cross to the client. */
export async function devLoginOptions(): Promise<{ email: string; label: string; role?: string }[]> {
  return loadLogins().map(({ email, label, role }) => ({ email, label: label || email, role }));
}

/** Sign in as the chosen dev account, using the password held server-side in env. */
export async function devLoginAction(email: string): Promise<{ ok: boolean; role?: string; redirectTo?: string; error?: string }> {
  if (process.env.NODE_ENV === "production") return { ok: false, error: "Disabled in production." };
  const entry = loadLogins().find((x) => x.email === email);
  if (!entry) return { ok: false, error: "Unknown account." };
  if (!entry.pw) return { ok: false, error: `No password set for ${email} in DEV_QUICK_LOGINS.` };
  const r = await signInAction({ email: entry.email, password: entry.pw });
  if (r.ok) return { ok: true, role: entry.role, redirectTo: r.redirectTo };
  return { ok: false, error: (r as any).error || (r as any).message || "Sign-in failed." };
}
