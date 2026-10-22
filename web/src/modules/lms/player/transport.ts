// from base-app/src/runtime/transport.ts — only its upload (the player's file answers) and
// error shape. Uploads go to the same-origin /api proxy (allow-listed for uploads), which adds
// the app token and the customer's session. Every other player call is a server action.

export class AppmintError extends Error {
  status?: number;
  details?: unknown;
  constructor(public code: string, message: string, extra: { status?: number; details?: unknown } = {}) {
    super(message);
    this.status = extra.status;
    this.details = extra.details;
  }
}

function mapStatus(status: number): string {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 422) return 'validation';
  if (status === 429) return 'rate-limited';
  if (status >= 500) return 'server';
  return 'unknown';
}

const urlFor = (path: string) => `/api/${path.replace(/^\/+/, '')}`;

export class Transport {
  /** Multipart upload — for File payloads. */
  async upload<T = unknown>(path: string, fields: Record<string, unknown>, files: Record<string, File>): Promise<T> {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      if (v != null) fd.append(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    for (const [k, file] of Object.entries(files)) {
      if (file) fd.append(k, file, file.name);
    }
    const res = await fetch(urlFor(path), { method: 'POST', body: fd });
    return this.handle<T>(res);
  }

  private async handle<T>(res: Response): Promise<T> {
    if (res.ok) {
      const text = await res.text();
      if (!text) return undefined as T;
      try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
    }
    const code = mapStatus(res.status);
    let details: unknown;
    let message = res.statusText || 'Request failed';
    try {
      const body = await res.json();
      details = body;
      message = (body && (body.message || body.error)) || message;
    } catch { /* non-json */ }
    throw new AppmintError(code, typeof message === 'string' ? message : 'Request failed', { status: res.status, details });
  }
}
