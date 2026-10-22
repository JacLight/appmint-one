/** Where to land after signing in or up: the page that sent the customer to /login
 *  (`?next=/events/…`), else the default. Same-origin paths only. */
export function afterAuth(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const next = new URLSearchParams(window.location.search).get("next") || "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
