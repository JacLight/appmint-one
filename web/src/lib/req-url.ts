import { appUrl } from "./app-url";

/**
 * The public origin the visitor actually reached us on.
 *
 * `request.url` is NOT usable for building redirects behind a proxy: inside the
 * container it reflects the internal bind (`http://0.0.0.0:3000/…`), so an OAuth
 * redirect resolved against it lands on a dead host (ERR_CONNECTION_REFUSED).
 * Reconstruct from the proxy's forwarded headers instead, preserving whichever
 * host the user came in on (apex or www so the session cookie stays valid), and
 * fall back to NEXT_PUBLIC_APP_URL when there's no proxy (local dev).
 */
export function publicBaseUrl(request: Request): string {
  const h = request.headers;
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = (h.get("x-forwarded-host") || h.get("host"))?.split(",")[0]?.trim();
  if (proto && host && !/^(0\.0\.0\.0|127\.0\.0\.1|\[::\]|localhost:3000)/.test(host)) {
    return `${proto}://${host}`;
  }
  return appUrl();
}
