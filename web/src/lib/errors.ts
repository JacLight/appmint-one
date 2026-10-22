/**
 * Canonical server-error message extractor — reuse base-app's `getResponseErrorMessage`
 * (ported into src/lib-client/helpers.ts). It walks axios / thrown-body / nested shapes
 * and deliberately skips the useless generic "Request failed with status code N".
 */
import { getResponseErrorMessage } from "@/lib-client/helpers";

export { getResponseErrorMessage as getErrorMessage };

export type AuthErrCtx = "signin" | "signup" | "magic-send" | "magic-verify";

/**
 * Turn a raw backend auth error into clean, user-facing copy.
 * AUTH FLOW ONLY — every other surface shows the server message verbatim.
 * The backend sometimes embeds a serialized query in its own string
 * (e.g. `customer {"email":"..."} not found`); that must never reach a user, so
 * we interpret known patterns and otherwise fall back to safe per-context copy.
 */
export function friendlyAuthError(err: unknown, context: AuthErrCtx = "signin"): string {
  const raw = (getResponseErrorMessage(err, "") || "").toLowerCase();
  const has = (...keys: string[]) => keys.some((k) => raw.includes(k));

  if (has("already", "exists", "in use", "taken") && context === "signup")
    return "An account with that email already exists — try signing in instead.";

  if (has("not found", "no user", "no account", "does not exist", "doesn't exist", "cannot find", "no customer"))
    return context === "signup"
      ? "We couldn't create that account. Please try again."
      : "We couldn't find an account with that email. Check the address, or create an account.";

  if (has("too many", "rate limit", "locked", "attempts"))
    return "Too many attempts. Please wait a minute and try again.";

  if (has("expired", "already used"))
    return context === "magic-verify" || context === "magic-send"
      ? "That link or code has expired. Request a new one."
      : "Your session expired. Please try again.";

  if (context === "magic-verify" && has("code", "invalid", "incorrect", "wrong", "mismatch"))
    return "That code didn't work. Double-check it, or request a new one.";

  if (has("password", "credential", "incorrect", "wrong", "invalid login", "unauthorized", "bad "))
    return "Your email or password is incorrect.";

  if (has("verify your email", "not verified", "verify email", "confirm your email"))
    return "Please verify your email address before signing in.";

  if (has("valid email", "invalid email", "email is required", "email required"))
    return "Please enter a valid email address.";

  // Never surface the raw backend string in the auth flow — use safe copy.
  switch (context) {
    case "signup": return "We couldn't create the account. Please try again.";
    case "magic-send": return "We couldn't send that. Check the email and try again.";
    case "magic-verify": return "That code didn't work. Try again, or request a new one.";
    default: return "We couldn't sign you in. Check your details and try again.";
  }
}
