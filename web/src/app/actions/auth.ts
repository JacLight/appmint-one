"use server";

import { auth, isAuthSuccess, getSession, type SignInInput, type SignUpInput } from "@/lib/auth";
import { setSessionCookies, clearSessionCookies } from "@/lib/session";
import { friendlyAuthError, getErrorMessage } from "@/lib/errors";
import { getSetup } from "@/lib/setup";
import { appClientInfo } from "@/lib/api";

export type AuthActionResult =
  | { ok: true; host: boolean; email: string; redirectTo: string }
  | { ok: false; needs: "password"; message?: string; email?: string }
  | { ok: false; needs: "2fa"; challengeToken: string; method: string; message?: string }
  | { ok: false; error: string };

/** Signed-in landing: a provider (per the setup's provider signal) goes to the
 *  provider home, everyone else to /account. */
async function landing(customer: any): Promise<{ host: boolean; redirectTo: string }> {
  const setup = await getSetup();
  const b = customer?.data?.benefits;
  const benefit = setup.provider?.benefit;
  const host = !!benefit && setup.roles.includes("provider") && Array.isArray(b) && b.includes(benefit);
  return { host, redirectTo: host ? setup.provider?.home || "/account" : "/account" };
}

export async function signInAction(input: SignInInput): Promise<AuthActionResult> {
  try {
    const res = await auth.signIn(input);
    if (isAuthSuccess(res)) {
      await setSessionCookies(res.token, res.refreshToken);
      return { ok: true, ...(await landing(res.customer)), email: res.customer?.data?.email ?? input.email ?? "" };
    }
    if ("requiresTwoFactor" in res && res.requiresTwoFactor) {
      if (!res.challengeToken) return { ok: false, error: "Could not start verification. Please sign in again." };
      return { ok: false, needs: "2fa", challengeToken: res.challengeToken, method: res.twoFactorMethod || "email", message: res.message };
    }
    if ("requiresPasswordChange" in res && res.requiresPasswordChange) return { ok: false, needs: "password", message: res.message, email: res.email };
    // The API returned an error body instead of throwing (e.g. bad password / rate limit).
    return { ok: false, error: friendlyAuthError(res, "signin") };
  } catch (e: any) {
    return { ok: false, error: friendlyAuthError(e, "signin") };
  }
}

export async function verifySignInChallengeAction(input: { challengeToken: string; code: string; trustDevice: boolean }): Promise<AuthActionResult> {
  if (typeof input?.challengeToken !== "string" || !input.challengeToken || typeof input.code !== "string" || !input.code.trim()) {
    return { ok: false, error: "Enter your verification code." };
  }
  try {
    const res = await auth.verifyChallenge({ challengeToken: input.challengeToken, code: input.code.trim(), trustDevice: input.trustDevice === true });
    if (!isAuthSuccess(res)) return { ok: false, error: "Verification did not complete. Please sign in again." };
    await setSessionCookies(res.token, res.refreshToken);
    return { ok: true, ...(await landing(res.customer)), email: res.customer?.data?.email ?? "" };
  } catch (e: unknown) {
    return { ok: false, error: friendlyAuthError(e, "magic-verify") };
  }
}

export async function resendSignInChallengeAction(challengeToken: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof challengeToken !== "string" || !challengeToken) return { ok: false, error: "Please sign in again to request a code." };
  try {
    await auth.resendChallenge(challengeToken);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: friendlyAuthError(e, "magic-send") };
  }
}

export async function signUpAction(input: SignUpInput): Promise<AuthActionResult> {
  try {
    const res = await auth.signUp(input);
    if (isAuthSuccess(res)) {
      await setSessionCookies(res.token, res.refreshToken);
      return { ok: true, host: false, redirectTo: "/account", email: res.customer?.data?.email ?? input.email };
    }
    return { ok: false, error: friendlyAuthError(res, "signup") };
  } catch (e: any) {
    return { ok: false, error: friendlyAuthError(e, "signup") };
  }
}

export async function updateProfileAction(input: { firstName?: string; lastName?: string; phone?: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await getSession();
    const sk = session.customer?.id;
    if (!sk) return { ok: false, error: "You need to be signed in." };
    await auth.updateProfile(String(sk), input);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not save your profile.") };
  }
}

export async function signOutAction() {
  await clearSessionCookies();
}

/* ── passwordless ── */

export async function sendMagicLinkAction(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!email) return { ok: false, error: "Email is required." };
    await auth.magicLinkSend(email);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: friendlyAuthError(e, "magic-send") };
  }
}

export async function sendMagicCodeAction(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!email) return { ok: false, error: "Email is required." };
    await auth.magicCodeSend(email);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: friendlyAuthError(e, "magic-send") };
  }
}

export async function verifyMagicCodeAction(email: string, code: string): Promise<AuthActionResult> {
  try {
    const res = await auth.magicVerify({ email, code });
    if (isAuthSuccess(res)) {
      await setSessionCookies(res.token, res.refreshToken);
      return { ok: true, ...(await landing(res.customer)), email: res.customer?.data?.email ?? email };
    }
    return { ok: false, error: "That code didn't work. Try again." };
  } catch (e: any) {
    return { ok: false, error: friendlyAuthError(e, "magic-verify") };
  }
}

/* ── forgot / reset password ── */

export async function forgotPasswordAction(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!email?.trim()) return { ok: false, error: "Enter the email on your account." };
    const { host, protocol } = appClientInfo();
    await auth.forgotPassword(email.trim(), `${protocol}://${host}/reset-password`);
    return { ok: true };
  } catch (e: any) {
    // Never reveal whether the address has an account.
    if (e?.response?.status === 404) return { ok: true };
    return { ok: false, error: getErrorMessage(e, "Could not send the reset link.") };
  }
}

export async function resetPasswordAction(token: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!token) return { ok: false, error: "This reset link is incomplete. Request a new one." };
    if (!password || password.length < 8) return { ok: false, error: "Use at least 8 characters." };
    await auth.resetPassword(token, password);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "That reset link has expired. Request a new one.") };
  }
}
