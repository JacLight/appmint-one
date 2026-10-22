// from base-app/src/runtime/namespaces.ts (createContentPlayerNamespace) — ported with its
// logic unchanged. Only the wiring differs: each engine call goes through a server action
// (actions/player.ts → src/api/content.ts) instead of base-app's Transport; a refusal comes
// back as a value and is re-thrown here in the transport's error shape, so `saving` works
// as before. Uploads stay on the /api proxy (allow-listed: client-data/files/upload).
import { playerAnswer, playerApplyBenefit, playerEnroll, playerProgress, type PlayerResult } from '../actions/player';
import { Transport, AppmintError } from './transport';

const unwrap = async <T>(p: Promise<PlayerResult<T>>): Promise<T> => {
  const r = await p;
  if (r.ok) return r.data;
  throw new AppmintError('request', r.message, { status: r.status, details: r.details });
};

/**
 * Content Player — courses, applications, trainings: a post taken page by page, with
 * the person's progress kept in a post_progress record on the server.
 * Backend: client/content-studio/* (content-studio-client.controller.ts).
 *
 * Every call takes one object. `course`, `item` and `code` default to the
 * player's address, `/<content-player page>/<course>/<item>?code=…`, so a page authored for a
 * course needs nothing but the action (the Content Player page is the first segment,
 * whatever Site Features named it):
 *
 *   <form data-action="contentPlayer.answer" data-payload="form">…</form>
 *   <button data-action="contentPlayer.complete">Mark complete</button>
 *
 * The server decides everything shown — what is open, why something is locked,
 * % complete, what comes next; these only carry it.
 */
export function createContentPlayerNamespace(t: Transport = new Transport()) {
  const here = () => {
    if (typeof window === 'undefined') return { course: '', item: '', code: '' };
    // /<content-player page>/<course>/<item> — the page is whatever Site Features picked.
    const parts = window.location.pathname.split('/').filter(Boolean);
    return {
      course: decodeURIComponent(parts[1] || ''),
      item: decodeURIComponent(parts[2] || ''),
      code: new URLSearchParams(window.location.search).get('code') || '',
    };
  };
  // An action with no data-payload is handed its element's data context — the
  // outline, whose `course` / `item` are objects — so only a string names one.
  const ctx = (input: any = {}) => {
    const h = here();
    const pick = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v : fallback);
    return { course: pick(input?.course, h.course), item: pick(input?.item, h.item), code: pick(input?.code, h.code) };
  };

  /**
   * Reading needs nobody, saving needs an enrollment: the first save a signed-in
   * person makes enrolls them, and someone signed out is sent to sign in and
   * brought back to the page they were on.
   */
  const saving = async <T>(course: string, code: string, call: () => Promise<T>): Promise<T> => {
    try {
      return await call();
    } catch (err: any) {
      const status = err?.details?.status ?? err?.status;
      if (status === 401 && typeof window !== 'undefined') {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return new Promise<T>(() => undefined); // leaving the page
      }
      // The reason may sit in the message or, from the proxy, in the body (`error`).
      const reason = `${err?.message || ''} ${JSON.stringify(err?.details ?? '')}`;
      if (status === 403 && /enroll/i.test(reason)) {
        await unwrap(playerEnroll(course, code));
        return call();
      }
      throw err;
    }
  };

  /** A form's files go up first — wherever they sit, rows of a list included; the answer keeps where they landed. */
  const isFile = (v: unknown): v is File => typeof File !== 'undefined' && v instanceof File;
  const uploadFiles = async (values: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values || {})) {
      const list = Array.isArray(value) ? value : [value];
      if (list.some(isFile)) {
        const files = list.filter((v): v is File => isFile(v) && v.size > 0);
        const saved = [];
        for (const file of files) {
          const up: any = await t.upload('/client-data/files/upload', { category: 'content-player' }, { file });
          const r = up?.data ?? up;
          // Marked by the player for a field stored as text: keep the address only.
          saved.push((file as any).asUrl ? (typeof r === 'string' ? r : r?.url || r?.path || r?.data?.url || '') : up);
        }
        out[key] = Array.isArray(value) ? saved : saved[0] ?? null;
      } else if (Array.isArray(value)) {
        out[key] = await Promise.all(value.map(async (v) => (v && typeof v === 'object' ? (await uploadFiles({ v })).v : v)));
      } else if (value && typeof value === 'object') {
        out[key] = await uploadFiles(value as Record<string, unknown>);
      } else out[key] = value;
    }
    return out;
  };

  const answer = async (input: any = {}, done: boolean) => {
    // `{ values, course?, item?, code? }` when called directly; a bare form
    // (data-payload="form") is nothing but answers — a field named "course" is
    // an answer, never an address.
    const explicit = input?.values && typeof input.values === 'object';
    const { course, item, code } = ctx(explicit ? input : {});
    const values = explicit ? input.values : { ...(input || {}) };
    return saving(course, code, async () => unwrap(playerAnswer(course, item, await uploadFiles(values), done, code)));
  };

  return {
    /** My courses, applications and trainings: status, % and the next item. */
    enroll: (input?: any) => {
      const { course, code } = ctx(input);
      return unwrap(playerEnroll(course, code));
    },
    /** Finish an item with nothing to send in (reading, a video). Content with reviewers waits for review instead. */
    complete: (input?: any) => {
      const { course, item, code } = ctx(input);
      return saving(course, code, () => unwrap(playerProgress(course, item, { done: true }, code)));
    },
    /** Watched %, or a score. */
    progress: (input: any = {}) => {
      const { course, item, code } = ctx(input);
      const body: Record<string, number> = {};
      if (input.percent !== undefined) body.percent = Number(input.percent);
      if (input.score !== undefined) body.score = Number(input.score);
      return saving(course, code, () => unwrap(playerProgress(course, item, body, code)));
    },
    /** Send in the item's form: saved, then done — or waiting for review when the page has reviewers. */
    answer: (input?: any) => answer(input, true),
    /**
     * Apply for a benefit from a page (`form[data-program-benefit]`): files go up,
     * the application goes to client-data/benefits/enroll — the server checks
     * the form and the agreement — and the step's answer records the outcome,
     * so the page is done the same way a form page is.
     */
    applyBenefit: async (input: any = {}) => {
      const { course, item, code } = ctx(input);
      const benefit = String(input?.benefit || '');
      const values = await uploadFiles(input?.values || {});
      // Dotted names (a nested object's fields) fold back into the shape the form's collection stores.
      const formData: Record<string, any> = {};
      for (const [path, value] of Object.entries(values)) {
        const parts = path.split('.');
        let cur = formData;
        parts.forEach((part, i) => {
          if (i === parts.length - 1) cur[part] = value;
          else cur = cur[part] = cur[part] || {};
        });
      }
      return saving(course, code, async () => {
        const res: any = await unwrap(playerApplyBenefit({
          benefit,
          ...(Object.keys(formData).length ? { formData } : {}),
          agreementAccepted: !!input?.agreementAccepted,
        }));
        const r = res?.data ?? res;
        // Already applied, or already holds it: the step is answered all the same.
        if (r?.success === false && !['ENROLLMENT_PENDING', 'ALREADY_HAS_BENEFIT'].includes(r?.error)) throw new Error(r?.message || 'The application could not be sent.');
        const status = r?.status || (r?.error === 'ALREADY_HAS_BENEFIT' ? 'active' : 'pending');
        return unwrap(playerAnswer(course, item, { benefit, status, ...(r?.enrollmentId ? { enrollment: r.enrollmentId } : {}) }, true, code));
      });
    },
    /** Keep the form as a draft without finishing the step. */
    saveDraft: (input?: any) => answer(input, false),
  };
}
