import "server-only";
/**
 * SEO config — all of it from the active setup + runtime env. No brand or analytics
 * id is baked in: GA only loads when PORTAL_GA_ID (or NEXT_PUBLIC_GA_ID) is set.
 */
import { appUrl } from "./app-url";
import { runtimeEnv } from "./runtime-env";

/** Canonical origin, no trailing slash (APP_URL at runtime). */
export function siteUrl(): string {
  return appUrl();
}

/** GA4 measurement id for this deployment, or "" (no analytics). */
export function gaId(): string {
  return runtimeEnv("PORTAL_GA_ID") || runtimeEnv("NEXT_PUBLIC_GA_ID");
}

/** Google Search Console HTML-tag token (content="" value), or "". */
export function googleSiteVerification(): string {
  return runtimeEnv("PORTAL_GOOGLE_SITE_VERIFICATION") || runtimeEnv("NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION");
}

/** Absolute URL for a site-relative path, against the canonical origin. */
export function abs(path = "/"): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
