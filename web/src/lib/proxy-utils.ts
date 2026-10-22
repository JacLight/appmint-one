// @ts-nocheck — vendored AppEngine connector (ported from base-app, kept as-is)
/**
 * Converts a path to a proxied URL if needed
 * @param path The path part of the URL (without host)
 * @param host Optional host for server-side calls
 * @returns The URL to use (either proxied or original with host)
 */
export const getProxiedUrl = (path: string, host: string): string => {
  const isBrowser = typeof window !== 'undefined';
  if (path.startsWith('/api/')) {
    path = path.replace('/api', '');
  } else if (path.startsWith('api')) {
    path = path.replace('api', '');
  }
  if (isBrowser) {
    return `/api/${path}`.replace(/([^:])\/\/+/g, '$1/');
  }
  // Join host + path with a single slash WITHOUT collapsing the protocol's "://".
  return `${host.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
};
