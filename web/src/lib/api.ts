/**
 * Shared appengine request helper. Every domain client (rentals, community, wallet,
 * auth) goes through here so they all carry the dual auth:
 *   • App Authorization  → Bearer <appToken>            (server-injected)
 *   • Customer auth       → x-client-authorization: <jwt> (from the `token` cookie)
 */
import { getAppEngineClient } from "./appmint-client";
import { getAppmintAuth } from "./appmint-auth";
import { appUrl } from "./app-url";

const api = getAppEngineClient();

/** On the server, pull the customer JWT from the cookie so authed calls are attributed. */
async function serverClientAuth(): Promise<string | null> {
  if (typeof window !== "undefined") return null;
  try {
    const { token } = await getAppmintAuth().getClientInfo();
    return token ?? null;
  } catch {
    return null;
  }
}

export type Query =
  | Record<string, string | number | boolean | undefined | null>
  | undefined;

export function withQuery(path: string, query: Query): string {
  if (!query) return path;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export async function apiReq<T = any>(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  path: string,
  opts: { data?: any; query?: Query; clientInfo?: Record<string, any> } = {},
): Promise<T> {
  const clientAuth = await serverClientAuth();
  const fullPath = withQuery(path, opts.query);
  // clientInfo populates x-client-host / x-client-protocol so appengine can build
  // absolute callback URLs (e.g. the magic-link return to /auth/magiclink).
  return api.processRequest(method, fullPath, opts.data, clientAuth, opts.query, opts.clientInfo);
}

/** Host + protocol of this app, for callbacks appengine must build back to us. */
export function appClientInfo(): { host: string; protocol: string } {
  const raw = appUrl();
  try {
    const u = new URL(raw);
    return { host: u.host, protocol: u.protocol.replace(":", "") };
  } catch {
    return { host: "localhost:3710", protocol: "http" };
  }
}

/** AppMint persistence envelope every record is wrapped in. */
export interface Envelope<T = any> {
  sk: string;
  pk?: string;
  name?: string;
  author?: string;
  data: T;
  createdate?: string;
  modifydate?: string;
}

export interface Paged<T = any> {
  data: T[];
  total: number;
}
