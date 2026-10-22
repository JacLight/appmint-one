// from base-app/src/lib/affiliate-tracking.ts — ported verbatim; only import paths rewired.
const COOKIE_NAME = 'affiliateCode';

/**
 * Save affiliate code to cookie
 * @param code - affiliate code
 * @param days - cookie age in days (from trackingCookieAge config, default 30)
 */
export function saveAffiliateCode(code: string, days = 30) {
  if (typeof document === 'undefined' || !code) return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(code)};expires=${expires};path=/;SameSite=Lax`;
}

/**
 * Get saved affiliate code from cookie
 */
export function getAffiliateCode(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Clear the affiliate cookie
 */
export function clearAffiliateCode() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`;
}
