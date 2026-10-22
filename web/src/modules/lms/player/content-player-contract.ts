// from base-app/src/runtime/content-player-contract.ts — ported verbatim.
/**
 * The attributes the content studio writes into Content Player pages, made to work.
 *
 * The studio's blocks (content-blocks.ts in the admin) mark what a page reports
 * rather than calling actions, so an author never writes runtime code:
 *
 *   <form data-program-answer>…</form>          send the answers in
 *   <form data-program-benefit="…">             apply for a benefit (the player draws it from the
 *                                               studio's <wm-form data-benefit>), then answer the step
 *   <button data-program-progress="done">       finish the item ("I've read it")
 *   <video|audio|iframe data-program-progress="watched">   report how much was watched
 *
 * Wired by delegation on the document, so HTML the player injects later works
 * without a rescan. Every call goes through the `contentPlayer` namespace, which
 * takes the course and item from the address; the server decides what is done,
 * what waits for review and what comes next — this only reports and moves on.
 */
type Player = {
  answer: (input: any) => Promise<any>;
  complete: (input?: any) => Promise<any>;
  progress: (input: any) => Promise<any>;
  applyBenefit: (input: any) => Promise<any>;
};

const here = () => {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return { page: parts[0] || '', course: parts[1] || '', item: parts[2] || '' };
};

/**
 * After a report: on to what the server says is next, or stay to show the new
 * state. A page whose score opens a later step stays, to show what it decided.
 */
const moveOn = (view: any) => {
  const { page, course, item } = here();
  const next = view?.next;
  const query = window.location.search;
  if (next && next !== item && !view?.result) window.location.href = `/${page}/${course}/${encodeURIComponent(next)}${query}`;
  else window.location.reload();
};

/** The server's own words for a refusal (flat, or under `error` as the exception filter writes it). */
const reasonOf = (err: any): string => {
  const d = err?.details;
  const nested = d && typeof d.error === 'object' && d.error ? d.error : d;
  const pickText = (...v: any[]) => v.find((x) => typeof x === 'string' && x.trim());
  return pickText(nested?.message, typeof nested?.error === 'string' ? nested.error : undefined, d?.message, typeof d?.error === 'string' ? d.error : undefined, err?.message) || 'That could not be saved.';
};

/**
 * A refusal is said where it happened — beside the form or button that was
 * used — as well as to any toast listener the site has.
 */
const notifyError = (err: any, at?: Element | null) => {
  const message = reasonOf(err);
  window.dispatchEvent(new CustomEvent('appmint:notify', { detail: { message, kind: 'error' } }));
  if (!at) return;
  const host = at.closest('form') || at;
  let note = host.querySelector<HTMLElement>(':scope > [data-player-error]') || (host.previousElementSibling?.matches('[data-player-error]') ? (host.previousElementSibling as HTMLElement) : null);
  if (!note) {
    note = document.createElement('div');
    note.className = 'cp-note is-warn';
    note.setAttribute('data-player-error', '');
    note.setAttribute('role', 'alert');
    if (host.tagName === 'FORM') host.insertBefore(note, host.querySelector('[type=submit]'));
    else host.insertAdjacentElement('beforebegin', note);
  }
  note.textContent = message;
};

const serialize = (form: HTMLFormElement) => {
  const out: Record<string, unknown> = {};
  new FormData(form).forEach((v, k) => {
    if (k in out) out[k] = ([] as unknown[]).concat(out[k], v);
    else out[k] = v;
  });
  return out;
};

/**
 * A benefit application's answers, typed by the `data-type` the player wrote on
 * each field — the form's collection checks types, and FormData is all strings.
 */
const serializeBenefit = (form: HTMLFormElement) => {
  const values: Record<string, unknown> = {};
  let agreementAccepted = false;
  for (const el of Array.from(form.elements) as HTMLInputElement[]) {
    const name = el.name;
    if (!name || el.disabled) continue;
    if (name === '__agreementAccepted') {
      agreementAccepted = el.checked;
      continue;
    }
    // A row still in its template, or a question its rules hide, is not answered.
    if (el.closest('template') || el.closest('[hidden]')) continue;
    const type = el.dataset.type || 'string';
    if (type === 'lines') {
      const lines = el.value.split('\n').map((v) => v.trim()).filter(Boolean);
      if (lines.length) values[name] = lines;
      continue;
    }
    if (type === 'array') {
      const list = (values[name] as unknown[]) || [];
      if (el.checked) list.push(el.value);
      values[name] = list;
    } else if (type === 'boolean') values[name] = el.checked;
    else if (type === 'file') {
      const files = Array.from(el.files || []);
      // A field the collection keeps as text (`type: string`) stores where the file landed, not the file record.
      if (el.dataset.store === 'url') files.forEach((f) => ((f as any).asUrl = true));
      if (files.length) values[name] = el.multiple ? files : files[0];
      else if (el.dataset.savedFiles) {
        // nothing new chosen: what was already uploaded stays with the answer ("choose again to replace")
        try {
          const kept = JSON.parse(el.dataset.savedFiles);
          if (Array.isArray(kept) && kept.length) values[name] = el.multiple ? kept : kept[0];
        } catch {
          /* no saved files */
        }
      }
    } else if (el.value === '') continue;
    else if (type === 'number' || type === 'integer') values[name] = Number(el.value);
    else if (type === 'list') values[name] = el.value.split(',').map((v) => v.trim()).filter(Boolean);
    else values[name] = el.value;
  }
  for (const [k, v] of Object.entries(values)) if (Array.isArray(v) && !v.length) delete values[k];
  return { values, agreementAccepted };
};

/**
 * Dotted names back into the shape the collection stores: `a.b` an object,
 * `list.0.name` a list of rows (gaps from removed rows closed up).
 */
const fold = (flat: Record<string, unknown>) => {
  const out: Record<string, any> = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split('.');
    let cur: any = out;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) cur[part] = value;
      else cur = cur[part] = cur[part] ?? (/^\d+$/.test(parts[i + 1]) ? [] : {});
    });
  }
  const close = (v: any): any =>
    Array.isArray(v) ? v.filter((x) => x !== undefined).map(close) : v && typeof v === 'object' && !(typeof File !== 'undefined' && v instanceof File) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, close(x)])) : v;
  return close(out);
};

/** The other way: a saved answer as the dotted names its fields carry. */
const flatten = (value: any, prefix = '', out: Record<string, any> = {}) => {
  // An uploaded file (it has a url or path) and a list of plain values are one answer each.
  const leaf = (v: any) => !v || typeof v !== 'object' || 'url' in v || 'path' in v;
  for (const [k, v] of Object.entries(value || {})) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (leaf(v) || (Array.isArray(v) && v.every(leaf))) out[path] = v;
    else flatten(v, path, out);
  }
  return out;
};

// ── Show / hide rules ────────────────────────────────────────────────────
// The checks a field's `rules` use — the same names and meaning as the admin
// forms' rule runner (appmint-form value-validator), so a rule an author set
// once behaves the same on the site. `fn` (code in the schema) is not run here.
const num = (v: any) => (typeof v !== 'boolean' && v !== '' && v !== null && !isNaN(v) ? parseFloat(v) : v);
const has = (a: any, b: any) =>
  typeof b === 'string' && typeof a === 'string' ? a.includes(b) : Array.isArray(b) && Array.isArray(a) ? b.every((v) => a.includes(v)) : Array.isArray(a) ? a.includes(b) : Array.isArray(b) ? b.includes(a) : a && typeof a === 'object' ? !!a[b] : false;
const within = (a: any, b: any) =>
  typeof b === 'string' && typeof a === 'string' ? b.includes(a) : Array.isArray(b) && Array.isArray(a) ? a.every((v) => b.includes(v)) : Array.isArray(a) ? a.includes(b) : Array.isArray(b) ? b.includes(a) : b && typeof b === 'object' ? !!b[a] : false;
const test = (re: any, v: any) => {
  try {
    return new RegExp(re).test(v);
  } catch {
    return false;
  }
};
const CHECKS: Record<string, (a: any, b?: any) => boolean> = {
  required: (a) => !!a,
  equal: (a, b) => num(a) === num(b),
  notEqual: (a, b) => num(a) !== num(b),
  greaterThan: (a, b) => num(a) > num(b),
  lessThan: (a, b) => num(a) < num(b),
  greaterThanOrEqual: (a, b) => num(a) >= num(b),
  lessThanOrEqual: (a, b) => num(a) <= num(b),
  contains: has,
  notContains: (a, b) => !has(a, b),
  in: within,
  notIn: (a, b) => !within(a, b),
  startsWith: (a, b) => typeof a === 'string' && a.startsWith(b),
  endsWith: (a, b) => typeof a === 'string' && a.endsWith(b),
  match: (a, b) => test(b, a),
  notMatch: (a, b) => !test(b, a),
  isAlpha: (a) => /^[a-zA-Z]+$/.test(a),
  isNumeric: (a) => /^[0-9]+$/.test(a),
  isAlphaNumeric: (a) => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(a),
  isEmpty: (a) => a === null || a === undefined || a === '',
  isNotEmpty: (a) => a !== null && a !== undefined && a !== '',
  isTruthy: (a) => !!a,
  isFalsy: (a) => !a,
  isEmail: (a) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(a),
  isDate: (a) => !isNaN(new Date(a).getTime()),
};
const pick = (data: any, path: string) => path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), data);
/** `{{field}}` is read from the answers (a row's own fields first); anything else is a value. */
const operand = (v: any, data: any) => {
  const first = Array.isArray(v) ? v[0] : v;
  return typeof first === 'string' && first.startsWith('{{') && first.endsWith('}}') && !first.startsWith('{{fn:') ? pick(data, first.slice(2, -2).trim()) : v;
};

/** Run every field's rules in a form against what is filled in now. */
const runRules = (form: HTMLFormElement) => {
  const boxes = Array.from(form.querySelectorAll<HTMLElement>('[data-rules]')).filter((b) => !b.closest('template'));
  if (!boxes.length) return;
  const data = fold(serializeBenefit(form).values);
  for (const box of boxes) {
    let rules: any[] = [];
    try {
      rules = JSON.parse(box.dataset.rules || '[]');
    } catch {
      continue;
    }
    // Inside a row, the row's own fields answer `{{field}}` first.
    const row = box.parentElement?.closest('[data-row]');
    const rowPath = row?.querySelector<HTMLElement>('[data-field]')?.dataset.field?.match(/^(.*\.\d+)\./)?.[1];
    const scope = rowPath ? { ...data, ...(pick(data, rowPath) || {}) } : data;
    const fired: Record<string, boolean> = {};
    for (const r of rules) {
      const check = CHECKS[r.operation];
      if (check && check(operand(r.valueA, scope), operand(r.valueB, scope))) fired[r.action] = true;
    }
    const hide = !!fired.hide || (rules.some((r) => r.action === 'show') && !fired.show);
    if (box.hidden !== hide) box.hidden = hide;
    for (const el of Array.from(box.querySelectorAll<HTMLInputElement>('input,select,textarea'))) {
      if (fired.readOnly) el.readOnly = true;
      el.disabled = hide || !!fired.disabled; // hidden or switched off: not asked, not sent
    }
  }
};

// ── Rows (a list of objects) ─────────────────────────────────────────────
/** Number a list's rows 0…n again after one is removed, so the names stay in order. */
const renumber = (box: HTMLElement) => {
  const list = box.dataset.field || '';
  const rows = Array.from(box.querySelector('[data-rows]')?.children || []);
  const literal = list.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
  const at = new RegExp('^' + literal + '\\.\\d+\\.');
  rows.forEach((row, i) =>
    row.querySelectorAll<HTMLElement>('[name],[data-field]').forEach((el) => {
      const n = el.getAttribute('name');
      if (n) el.setAttribute('name', n.replace(at, `${list}.${i}.`));
      const f = el.dataset.field;
      if (f) el.dataset.field = f.replace(at, `${list}.${i}.`);
    }),
  );
};
const addRow = (box: HTMLElement) => {
  const tpl = box.querySelector<HTMLTemplateElement>(':scope > template[data-row-template]');
  const rows = box.querySelector<HTMLElement>(':scope > [data-rows]');
  if (!tpl || !rows) return null;
  const wrap = document.createElement('div');
  wrap.innerHTML = tpl.innerHTML.replace(/__i__/g, String(rows.children.length));
  const row = wrap.firstElementChild as HTMLElement | null;
  if (row) rows.appendChild(row);
  return row;
};

/** Preview pages are read-only: nothing is reported. */
const inPreview = () => new URLSearchParams(window.location.search).get('preview') === 'true';

/**
 * Put back what this person already sent, so a step reopens filled in. The
 * player writes the saved answer into the page as JSON; files cannot be put
 * back into a file input, so an uploaded field says what is already there.
 */
const fillSaved = () => {
  const data = document.querySelector('script[data-program-saved]');
  const form = document.querySelector<HTMLFormElement>('form[data-program-answer]');
  if (!data || !form || form.dataset.playerFilled) return;
  form.dataset.playerFilled = '1';
  let saved: Record<string, any> = {};
  try {
    saved = JSON.parse(data.textContent || '{}') || {};
  } catch {
    return;
  }
  // A form drawn from a collection saved its answer in the collection's shape: back to field names, rows added first.
  if (form.hasAttribute('data-program-typed')) {
    saved = flatten(saved);
    for (const path of Object.keys(saved)) {
      const m = path.match(/^(.*)\.(\d+)\./);
      if (!m) continue;
      const box = form.querySelector<HTMLElement>(`.cp-repeat[data-field="${CSS.escape(m[1])}"]`);
      while (box && (box.querySelector('[data-rows]')?.children.length || 0) <= Number(m[2])) if (!addRow(box)) break;
    }
  }
  for (const [name, value] of Object.entries(saved)) {
    const fields = Array.from(form.querySelectorAll<HTMLInputElement>(`[name="${CSS.escape(name)}"]`));
    const values = ([] as any[]).concat(value).map((v) => (v && typeof v === 'object' ? v : String(v)));
    for (const f of fields) {
      if (f.type === 'file') {
        const files = values.filter((v) => v && typeof v === 'object');
        if (files.length) {
          f.removeAttribute('required'); // already sent; choose again only to replace it
          f.dataset.savedFiles = JSON.stringify(files);
          const note = document.createElement('p');
          note.className = 'text-sm text-gray-500';
          const names = files.map((v: any) => v.name || String(v.path || v.url || '').split('/').pop()).join(', ');
          note.textContent = form.hasAttribute('data-readonly') ? `Uploaded: ${names}` : `Already uploaded: ${names} — choose again to replace.`;
          f.insertAdjacentElement('afterend', note);
        }
      } else if (f.type === 'checkbox' || f.type === 'radio') f.checked = values.includes(f.value);
      else if (f.dataset.type === 'lines') (f as any).value = values.join('\n');
      else (f as any).value = values[0] ?? '';
    }
  }
  runRules(form);
};

export function installContentPlayerContract(player: Player): void {
  if (typeof document === 'undefined' || (window as any).__appmintContentPlayerContract) return;
  (window as any).__appmintContentPlayerContract = true;
  // Rules set attributes only, so running them on each added node cannot feed itself.
  const ruled = () => document.querySelectorAll<HTMLFormElement>('form[data-program-typed], form[data-program-benefit]').forEach(runRules);
  fillSaved();
  ruled();
  new MutationObserver(() => {
    fillSaved();
    ruled();
  }).observe(document.body, { childList: true, subtree: true });

  // ── Rules run as the form is filled ─────────────────────────────
  const onEdit = (e: Event) => {
    const form = (e.target as Element)?.closest?.('form[data-program-typed], form[data-program-benefit]') as HTMLFormElement | null;
    if (form) runRules(form);
  };
  document.addEventListener('input', onEdit);
  document.addEventListener('change', onEdit);

  // ── Rows: Add / Remove ──────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const target = e.target as Element;
    const add = target?.closest?.('[data-add-row]');
    const remove = target?.closest?.('[data-remove-row]');
    if (!add && !remove) return;
    e.preventDefault();
    const box = (add || remove)!.closest<HTMLElement>('.cp-repeat');
    if (!box) return;
    if (add) addRow(box)?.querySelector<HTMLElement>('input,select,textarea')?.focus();
    else {
      remove!.closest('[data-row]')?.remove();
      renumber(box);
    }
    const form = box.closest('form');
    if (form) runRules(form as HTMLFormElement);
  });

  // ── Answers ──────────────────────────────────────────────────────
  document.addEventListener('submit', async (e) => {
    const form = (e.target as Element)?.closest?.('form[data-program-answer]') as HTMLFormElement | null;
    if (!form) return;
    e.preventDefault();
    if (inPreview()) return;
    const button = form.querySelector<HTMLButtonElement>('[type=submit]');
    button?.setAttribute('disabled', '');
    try {
      // A form drawn from a collection sends typed answers in the collection's shape (rows as lists).
      const values = form.hasAttribute('data-program-typed') ? fold(serializeBenefit(form).values) : serialize(form);
      moveOn(await player.answer({ values }));
    } catch (err) {
      notifyError(err, form);
      button?.removeAttribute('disabled');
    }
  });

  // ── Benefit applications ─────────────────────────────────────────
  document.addEventListener('submit', async (e) => {
    const form = (e.target as Element)?.closest?.('form[data-program-benefit]') as HTMLFormElement | null;
    if (!form) return;
    e.preventDefault();
    if (inPreview()) return;
    const button = form.querySelector<HTMLButtonElement>('[type=submit]');
    button?.setAttribute('disabled', '');
    try {
      const { values, agreementAccepted } = serializeBenefit(form);
      moveOn(await player.applyBenefit({ benefit: form.dataset.programBenefit, values: fold(values), agreementAccepted }));
    } catch (err) {
      notifyError(err, form);
      button?.removeAttribute('disabled');
    }
  });

  // ── "I've read it" ───────────────────────────────────────────────
  document.addEventListener('click', async (e) => {
    const el = (e.target as Element)?.closest?.('[data-program-progress="done"]') as HTMLElement | null;
    if (!el || el.tagName === 'VIDEO' || el.tagName === 'AUDIO' || el.tagName === 'IFRAME') return;
    e.preventDefault();
    if (inPreview()) return;
    el.setAttribute('disabled', '');
    try {
      moveOn(await player.complete());
    } catch (err) {
      notifyError(err, el);
      el.removeAttribute('disabled');
    }
  });

  // ── Watched % ────────────────────────────────────────────────────
  // Reported in steps of 10 so a playing video sends a handful of calls, not one a second.
  const reported = new WeakMap<object, number>();
  const finished = new WeakSet<object>();
  // the view the server returned when watching finished the item: shown once the media has ended
  const doneView = new WeakMap<object, any>();
  const report = async (key: object, percent: number, ended = false) => {
    if (inPreview() || !Number.isFinite(percent)) return;
    const step = Math.min(100, Math.floor(percent / 10) * 10);
    if (step > (reported.get(key) ?? -1)) {
      reported.set(key, step);
      try {
        await player.progress({ percent: step });
        // Watched to the end finishes the item — unless the page also asks for answers,
        // which are what finishes it then.
        if (step >= 90 && !finished.has(key) && !document.querySelector('form[data-program-answer], form[data-program-benefit]')) {
          finished.add(key);
          doneView.set(key, await player.complete());
        }
      } catch {
        /* a missed progress report is not worth interrupting the video for */
      }
    }
    // the media has ended and that finished the item: show the new state (never mid-play)
    if (ended && doneView.has(key)) {
      const view = doneView.get(key);
      doneView.delete(key);
      moveOn(view);
    }
  };

  document.addEventListener(
    'timeupdate',
    (e) => {
      const media = e.target as HTMLMediaElement;
      if (!media?.matches?.('[data-program-progress="watched"]') || !media.duration) return;
      void report(media, (media.currentTime / media.duration) * 100);
    },
    true, // media events do not bubble; capture sees them
  );
  document.addEventListener(
    'ended',
    (e) => {
      const media = e.target as HTMLMediaElement;
      if (media?.matches?.('[data-program-progress="watched"]')) void report(media, 100, true);
    },
    true,
  );

  // YouTube (enablejsapi=1) and Vimeo iframes report through postMessage once asked.
  const frames = () => Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe[data-program-progress="watched"]'));
  const hello = (frame: HTMLIFrameElement) => {
    const src = frame.src || '';
    try {
      if (/youtube\.com|youtu\.be/.test(src)) frame.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'content-player', channel: 'widget' }), '*');
      else if (/vimeo\.com/.test(src)) frame.contentWindow?.postMessage(JSON.stringify({ method: 'addEventListener', value: 'timeupdate' }), '*');
    } catch {
      /* not ready yet */
    }
  };
  const greeted = new WeakSet<HTMLIFrameElement>();
  const greetAll = () =>
    frames().forEach((f) => {
      if (greeted.has(f)) return;
      greeted.add(f);
      f.addEventListener('load', () => hello(f));
      hello(f);
    });
  new MutationObserver(greetAll).observe(document.body, { childList: true, subtree: true });
  greetAll();

  window.addEventListener('message', (e) => {
    if (!/youtube\.com|vimeo\.com/.test(e.origin)) return;
    const frame = frames().find((f) => f.contentWindow === e.source);
    if (!frame) return;
    let data: any = e.data;
    try {
      if (typeof data === 'string') data = JSON.parse(data);
    } catch {
      return;
    }
    // YouTube: infoDelivery carries currentTime and duration.
    const info = data?.info;
    if (data?.event === 'infoDelivery' && info && Number(info.duration) > 0 && info.currentTime !== undefined) {
      void report(frame, (Number(info.currentTime) / Number(info.duration)) * 100);
    }
    // Vimeo: timeupdate carries percent (0–1).
    if (data?.event === 'timeupdate' && data?.data?.percent !== undefined) void report(frame, Number(data.data.percent) * 100);
    if (data?.event === 'ready' && /vimeo/.test(e.origin)) hello(frame);
  });
}
