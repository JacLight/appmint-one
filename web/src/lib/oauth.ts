"use server";

/**
 * Social OAuth (Google + Facebook), ported from base-app's (auth)/auth flow.
 * Redirect model: /auth/<provider> → provider consent → /auth/<provider>/callback
 * → exchange code → provider profile → appengine `customer/social-login`.
 * Requires OAuth app creds in env: GOOGLE_ID/GOOGLE_SECRET, FACEBOOK_ID/FACEBOOK_SECRET.
 */
import { getAppmintAuth } from "./appmint-auth";

type Provider = "google" | "facebook";

import { appUrl } from "./app-url";

/** Read an env var at RUNTIME. Next.js inlines every static `process.env.FOO`
 *  reference at build time (even after constant-folding a dynamic key), freezing
 *  it to the build value — empty for server-only vars not present at build. A
 *  `new Function` body is opaque to the bundler, so the access inside it is a real
 *  runtime lookup and the k8s-injected value wins. */
// eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
const readRuntimeEnv = new Function(
  "k",
  "return (typeof process !== 'undefined' && process.env && process.env[k]) || '';",
) as (k: string) => string;

function env(key: string): string {
  return readRuntimeEnv(key);
}

const providerMeta: Record<Provider, {
  authUrl: string; tokenUrl: string; userApiUrl: string; scope: string;
  idKey: string; secretKey: string;
}> = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userApiUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    scope:
      "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
    idKey: "GOOGLE_ID",
    secretKey: "GOOGLE_SECRET",
  },
  facebook: {
    authUrl: "https://www.facebook.com/v12.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v12.0/oauth/access_token",
    userApiUrl: "https://graph.facebook.com/me?fields=id,name,email,picture",
    scope: "email,public_profile",
    idKey: "FACEBOOK_ID",
    secretKey: "FACEBOOK_SECRET",
  },
};

/** Config with credentials resolved from the runtime env at call time. */
function providerConfigFor(provider: Provider) {
  const m = providerMeta[provider];
  return { ...m, clientId: env(m.idKey), clientSecret: env(m.secretKey) };
}

function encodeState(callbackUrl: string) {
  return Buffer.from(JSON.stringify({ callbackUrl, nonce: Math.random().toString(36).slice(2, 15) })).toString("base64");
}
function parseState(state: string): { callbackUrl: string } {
  try {
    return JSON.parse(Buffer.from(state, "base64").toString());
  } catch {
    return { callbackUrl: "/" };
  }
}

/** Build the provider consent URL to redirect the user to. */
export async function getOAuthUrl(provider: Provider): Promise<string> {
  const cfg = providerConfigFor(provider);
  const url = new URL(cfg.authUrl);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", `${appUrl()}/auth/${provider}/callback`);
  url.searchParams.set("scope", cfg.scope);
  url.searchParams.set("state", encodeState("/account"));
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export interface OAuthResult {
  ok: boolean;
  token?: string;
  refreshToken?: string;
  redirectTo: string;
  error?: string;
}

async function getUserProfile(provider: Provider, accessToken: string) {
  const cfg = providerConfigFor(provider);
  const url = provider === "facebook" ? `${cfg.userApiUrl}&access_token=${accessToken}` : cfg.userApiUrl;
  const headers: Record<string, string> = provider === "facebook" ? {} : { Authorization: `Bearer ${accessToken}` };
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to fetch ${provider} profile`);
  return res.json();
}

/** Exchange the OAuth code, fetch the profile, hand it to appengine social-login. */
export async function processOAuthCallback(provider: Provider, code: string, state: string): Promise<OAuthResult> {
  try {
    const cfg = providerConfigFor(provider);
    if (!cfg?.clientId) return { ok: false, redirectTo: "/login?error=Provider+not+configured", error: "not configured" };

    const tokenRes = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code,
        redirect_uri: `${appUrl()}/auth/${provider}/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error("Token exchange failed");
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error("No access token");

    const profile = await getUserProfile(provider, accessToken);
    const userData = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      image: profile.picture?.data?.url || profile.picture || profile.image,
    };

    const validated: any = await getAppmintAuth().validateSocialLogin({
      user: userData,
      account: { provider, providerAccountId: userData.id },
    });

    if (validated?.customer && validated?.token) {
      const { callbackUrl } = parseState(state);
      return { ok: true, token: validated.token, refreshToken: validated.refreshToken || "", redirectTo: callbackUrl || "/account" };
    }
    return { ok: false, redirectTo: "/login?error=Social+sign-in+failed", error: "no token" };
  } catch (e: any) {
    return { ok: false, redirectTo: `/login?error=${encodeURIComponent(e?.message || "Authentication failed")}`, error: e?.message };
  }
}
