/**
 * Documents — the signed-in customer's own files, over appengine `client-data/files*`
 * (stored under the org's client-account/<email>/ prefix; list returns signed URLs).
 * Upload is multipart (`client-data/files/upload`, field `file`, optional `location`
 * folder) and goes browser → /api proxy → engine.
 *
 * Note: `repository/customer/file/upload` (base64 JSON) 500s on the local engine and
 * `repository/customer/file/flatlist` lists a different prefix (users/<sk>/), so the
 * client-data routes are the ones used here.
 */
import { apiReq } from "./api";

export interface CustomerFile {
  name: string;
  path: string;       // relative to the customer's root, e.g. "documents/lease.pdf"
  size?: number;
  modified?: string;
  url?: string;       // signed, short-lived
}

export interface FormRequest {
  id: string;
  status: string;     // pending | new | …
  submittedAt?: string | null;
  requestedAt?: string | null;
  expiresAt?: string | null;
  form?: { name?: string; title?: string; description?: string } | null;
}

export const documents = {
  list: () => apiReq<{ files: CustomerFile[]; hasMore?: boolean }>("GET", "client-data/files"),
  remove: (path: string) => apiReq<any>("DELETE", `client-data/files/${encodeURIComponent(path)}`),
  forms: () => apiReq<{ data: FormRequest[]; total: number }>("GET", "client-data/forms"),
};
