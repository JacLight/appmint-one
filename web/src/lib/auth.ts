/**
 * Customer auth — over appengine `profile/customer/*` (dual-prefix profile|user).
 * Contract from /Users/imzee/projects/appengine/src/users.
 *
 * A successful signup/signin returns { customer, token, refreshToken }. The `token`
 * is the customer JWT — store it in the `token` cookie so the connector forwards it
 * as x-client-authorization on subsequent calls. Cookie writing happens in the
 * Server Actions (see src/app/actions/auth.ts); this module is the raw API layer.
 */
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { apiReq, appClientInfo, type Envelope } from "./api";
import { getSetup } from "./setup";
import type { Role } from "@/setups/types";
import { isSchedulingProvider } from "@/modules/scheduling/lib/provider";

const P = "profile/customer";

export interface Customer {
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  benefits?: string[];
  image?: string;
  [k: string]: any;
}

export interface AuthSuccess {
  customer: Envelope<Customer>;
  token: string;
  refreshToken: string;
  orgId?: string;
}
export interface RequiresPasswordChange { requiresPasswordChange: true; message?: string; userId: string; email: string; }
export interface RequiresTwoFactor { requiresTwoFactor: true; challengeToken: string; twoFactorMethod?: string; message?: string; isNewDevice?: boolean; }
export type AuthResult = AuthSuccess | RequiresPasswordChange | RequiresTwoFactor;

export function isAuthSuccess(r: AuthResult): r is AuthSuccess {
  return typeof (r as AuthSuccess).token === "string";
}

export interface SignUpInput {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  username?: string;
  [k: string]: any;
}
export interface SignInInput {
  email?: string;
  username?: string;
  phone?: string;
  password: string;
}

export const auth = {
  signUp: (data: SignUpInput) => apiReq<AuthResult>("POST", `${P}/signup`, { data }),
  // The customer-update endpoint wants the whole record envelope: datatype +
  // sk, with the fields to change under `data`.
  updateProfile: (sk: string, fields: { firstName?: string; lastName?: string; phone?: string }) =>
    apiReq<any>("POST", `${P}/update`, { data: { datatype: "customer", sk, data: fields } }),
  signIn: (data: SignInInput) => apiReq<AuthResult>("POST", `${P}/signin`, { data }),
  verifyChallenge: (data: { challengeToken: string; code: string; trustDevice: boolean }) =>
    apiReq<AuthResult>("POST", "profile/security/challenge/verify", { data }),
  resendChallenge: (challengeToken: string) =>
    apiReq("POST", "profile/security/challenge/send", { data: { challengeToken } }),
  refresh: (refresh_token: string) => apiReq<AuthResult>("POST", `${P}/refresh`, { data: { refresh_token } }),
  socialLogin: (data: any) => apiReq<AuthResult>("POST", `${P}/social-login`, { data }),
  forgotPassword: (email: string, redirectUrl?: string) =>
    apiReq("GET", `${P}/password/forgot/${encodeURIComponent(email)}${redirectUrl ? `/${encodeURIComponent(redirectUrl)}` : ""}`),
  resetPassword: (token: string, password: string) =>
    apiReq<any>("POST", `${P}/password/reset`, { data: { token, password } }),
  exists: (emailOrUsername: string) => apiReq<any>("GET", `${P}/exist/${encodeURIComponent(emailOrUsername)}`),

  // ── passwordless (magic link + magic code), appengine `profile/magic-link` ──
  /**
   * Email the customer a sign-in LINK. appengine builds it as
   * `${protocol}://${clientHost}/auth/magiclink?email=&token=` from the x-client-host /
   * x-client-protocol headers, so we pass this app's host as clientInfo (the "redirect").
   */
  magicLinkSend: (email: string) =>
    apiReq("GET", `profile/magic-link`, { query: { email }, clientInfo: appClientInfo() }),
  /** Email/SMS the customer a 6-digit CODE (type=code). */
  magicCodeSend: (email: string, deliveryType: "email" | "sms" = "email", phone?: string) =>
    apiReq("GET", `profile/magic-link`, { query: { email, type: "code", deliveryType, phone }, clientInfo: appClientInfo() }),
  /** Verify a magic link token OR a magic code → returns AuthResult (token on success). */
  magicVerify: (data: { email?: string; token?: string; code?: string }) =>
    apiReq<AuthResult>("POST", `profile/magic-link/redirect`, { data }),
};

export interface SessionCustomer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  image?: string;
  benefits?: string[];
}

export interface Session {
  signedIn: boolean;
  customer?: SessionCustomer;
  /** "customer" for everyone signed in; "provider" when the setup's provider signal is set. */
  roles: Role[];
  /** Shorthand for roles.includes("provider") — the Rentals (Stowbo) code calls it `host`. */
  host: boolean;
  /** The customer JWT was presented but the engine rejected it (expired/revoked). */
  expired?: boolean;
}

const SIGNED_OUT: Session = { signedIn: false, roles: [], host: false };

/** Is the signed-in customer a provider in this setup by benefit (Rentals hosts:
 *  `stowbo-host`)? Logistics drivers are checked against their driver record instead. */
function providerFrom(benefits: string[] | undefined, benefit: string | undefined): boolean {
  return !!benefit && Array.isArray(benefits) && benefits.includes(benefit);
}

/**
 * Who is signed in — generic for every setup: `GET client-data/profile` returns the
 * caller's own customer record (empty when there is no customer token, 401 when the
 * token is bad). No call at all when there is no `token` cookie.
 *
 * Wrapped in React cache() so one request makes ONE probe: the header, the route
 * guard and the page share the same result (no disagreement, and no duplicate calls
 * tripping the engine's rate limiter).
 */
export const getSession = cache(async (): Promise<Session> => {
  const jar = await cookies();
  if (!jar.get("token")?.value) return SIGNED_OUT;
  try {
    const rec: any = await apiReq("GET", "client-data/profile");
    const d = rec?.data;
    if (!rec?.sk || !d?.email) return SIGNED_OUT;
    const setup = await getSetup();
    // A setup's provider signal: a customer benefit (Rentals hosts), or the module's own check.
    const signal = setup.provider?.module === "scheduling"
      ? await isSchedulingProvider(d.email) // Scheduling: a host of one of the business's booking types
      : providerFrom(d.benefits, setup.provider?.benefit);
    const provider = signal && setup.roles.includes("provider");
    return {
      signedIn: true,
      customer: {
        id: String(rec.sk), email: d.email, firstName: d.firstName, lastName: d.lastName,
        phone: d.phone, image: d.image, benefits: Array.isArray(d.benefits) ? d.benefits : undefined,
      },
      roles: provider ? ["customer", "provider"] : ["customer"],
      host: provider,
    };
  } catch (e: any) {
    if (e?.response?.status === 401) return { ...SIGNED_OUT, expired: true };
    return SIGNED_OUT;
  }
});
