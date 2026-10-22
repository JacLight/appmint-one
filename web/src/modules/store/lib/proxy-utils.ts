// from base-app/src/lib/proxy-utils.ts — ported verbatim; only import paths rewired.
/**
 * Converts a path to a proxied URL if needed
 * @param path The path part of the URL (without host)
 * @param host Optional host for server-side calls
 * @returns The URL to use (either proxied or original with host)
 */
export const getProxiedUrl = (path: string, host: string): string => {
  const isBrowser = typeof window !== 'undefined';
  const relativePath = path.replace(/^\/?api(?:\/|$)/, '').replace(/^\/+/, '');
  const base = isBrowser ? '/api' : host.replace(/\/+$/, '');
  return `${base}/${relativePath}`;
};
