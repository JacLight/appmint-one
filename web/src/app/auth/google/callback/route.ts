import { NextRequest, NextResponse } from "next/server";
import { processOAuthCallback } from "@/lib/oauth";
import { setSessionCookies } from "@/lib/session";
import { publicBaseUrl } from "@/lib/req-url";

/** Google OAuth callback. MUST be a Route Handler (not a page) — cookies can only
 *  be set here or in a Server Action, never during a Server Component render. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const base = publicBaseUrl(request); // NOT request.url — that's the internal 0.0.0.0:3000 host
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (error || !code || !state) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error || "Missing parameters")}`, base));
  }
  const r = await processOAuthCallback("google", code, state);
  if (r.ok && r.token) await setSessionCookies(r.token, r.refreshToken);
  return NextResponse.redirect(new URL(r.redirectTo, base));
}
