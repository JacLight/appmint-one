// from base-app/src/components/content-player/content-player.ts — ported verbatim; only the exit labels take the setup's words (ctx.exitLabel / ctx.mineTitle).
/**
 * The Content Player — courses, applications, trainings, any multi-page post —
 * rendered as plain HTML on the server from what client/content-studio returns, so
 * the links and the page are there the moment it arrives. The runtime
 * (`contentPlayer.*`, runtime/content-player-contract.ts) only carries the actions: Start,
 * Mark complete, a page's form, "I've read it", watched %.
 *
 * Nothing here is worked out: which items are open, why one is locked, counts,
 * step numbers, % complete, what comes next and what waits for review all
 * arrive from the server and are shown as they came.
 *
 * Where the steps sit is the post's `course.navigation`: `sidebar` (beside the
 * page, sections collapsible), `top` (a numbered stepper) or `none` (progress
 * only). A site restyles it through the `--cp-*` variables and `cp-*` classes.
 *
 * Addresses, under the Content Player page (`content-player` unless Site
 * Features picks another):
 *   /<page>                        my programs
 *   /<page>/<post>                 the post: outline, progress, the way in
 *   /<page>/<post>/<item>          one page
 * `?code=` rides along on every link so an invitation keeps working.
 */

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

// ── Icons (Lucide-style strokes, inline so the page needs nothing else) ──────
const svg = (d: string, size = 16) =>
  `<svg class="cp-i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON: Record<string, string> = {
  video: '<polygon points="6 3 20 12 6 21 6 3"/>',
  audio: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  pdf: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 13H8M16 17H8M16 13h-2"/>',
  text: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  quiz: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  form: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
  assignment: '<path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M3 15h6M6 12v6"/>',
  gallery: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  alert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (name: string, size?: number) => svg(ICON[name] || ICON.text, size);
const typeIcon = (type?: string) => icon(type && ICON[type] ? type : 'text', 14);

const STYLE = `
<style>
.cp{--cp-accent:#4f46e5;--cp-accent-soft:#eef2ff;--cp-text:#0f172a;--cp-muted:#64748b;--cp-line:#e2e8f0;--cp-bg:#f8fafc;--cp-surface:#fff;--cp-ok:#16a34a;--cp-warn:#d97706;--cp-radius:12px;
  color:var(--cp-text);background:var(--cp-bg);font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Inter,Roboto,sans-serif;min-height:80vh;display:flex;flex-direction:column}
.cp *{box-sizing:border-box}
.cp a{color:inherit;text-decoration:none}
.cp-i{flex:none;display:block}
/* header */
.cp-bar{position:sticky;top:0;z-index:5;background:var(--cp-surface);border-bottom:1px solid var(--cp-line)}
.cp-bar-in{display:flex;align-items:center;gap:16px;height:60px;padding:0 20px}
.cp-exit{display:inline-flex;align-items:center;gap:6px;color:var(--cp-muted);font-size:14px;font-weight:500;padding:6px 10px;border-radius:8px}
.cp-exit:hover{background:var(--cp-bg);color:var(--cp-text)}
.cp-titles{flex:1;min-width:0;text-align:center}
.cp-titles b{display:block;font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-titles small{display:block;font-size:12px;color:var(--cp-muted)}
.cp-pct{font-size:13px;font-weight:600;color:var(--cp-muted);min-width:44px;text-align:right}
.cp-langs{display:flex;flex-wrap:wrap;gap:4px}
.cp-langs a{font-size:12px;font-weight:500;line-height:1;padding:6px 8px;border-radius:6px;border:1px solid var(--cp-line);color:var(--cp-muted)}
.cp-langs a:hover{background:var(--cp-bg);color:var(--cp-text)}
.cp-langs a.is-on{background:var(--cp-accent-soft);border-color:#c7d2fe;color:var(--cp-accent)}
.cp-progress{height:3px;background:var(--cp-line)}
.cp-progress span{display:block;height:100%;background:var(--cp-accent);transition:width .4s}
.cp-preview{background:#fffbeb;color:#92400e;font-size:13px;display:flex;gap:8px;align-items:center;justify-content:center;padding:8px}
/* body */
.cp-body{flex:1;display:flex;min-height:0}
.cp-nav{width:320px;flex:none;background:var(--cp-surface);border-right:1px solid var(--cp-line);overflow:auto;max-height:calc(100vh - 64px);position:sticky;top:64px}
.cp[data-nav=top] .cp-nav,.cp[data-nav=none] .cp-nav,.cp[data-single] .cp-nav{display:none}
.cp-nav-head{padding:20px 20px 12px}
.cp-nav-head b{display:block;font-size:16px;font-weight:600;line-height:1.3}
.cp-nav-head small{color:var(--cp-muted);font-size:12px}
.cp-sec{border-top:1px solid var(--cp-line)}
.cp-sec>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:14px 20px;font-weight:600;font-size:14px}
.cp-sec>summary::-webkit-details-marker{display:none}
.cp-sec>summary:hover{background:var(--cp-bg)}
.cp-sec>summary .cp-sec-t{flex:1;min-width:0}
.cp-sec>summary small{display:block;font-weight:400;color:var(--cp-muted);font-size:12px}
.cp-sec>summary .cp-count{font-size:12px;color:var(--cp-muted);font-weight:500}
.cp-sec>summary .cp-chev{color:var(--cp-muted);transition:transform .2s}
.cp-sec[open]>summary .cp-chev{transform:rotate(180deg)}
.cp-sec.is-locked>summary{color:var(--cp-muted)}
.cp-list{list-style:none;margin:0;padding:0 0 8px}
.cp-item>a,.cp-item>span{display:flex;gap:12px;align-items:flex-start;padding:10px 20px 10px 22px;font-size:14px;line-height:1.35;border-left:3px solid transparent}
.cp-item>a:hover{background:var(--cp-bg)}
.cp-item.is-current>a{background:var(--cp-accent-soft);border-left-color:var(--cp-accent);font-weight:600}
.cp-item.is-locked>span{color:var(--cp-muted);cursor:not-allowed}
.cp-dot{flex:none;width:20px;height:20px;border-radius:50%;border:2px solid var(--cp-line);display:grid;place-items:center;margin-top:1px;color:#fff;background:var(--cp-surface)}
.cp-item.is-done .cp-dot{background:var(--cp-ok);border-color:var(--cp-ok)}
.cp-item.is-pending-review .cp-dot{border-color:var(--cp-warn);color:var(--cp-warn);background:#fffbeb}
.cp-item.is-changes .cp-dot{border-color:var(--cp-warn);background:var(--cp-warn)}
.cp-item.is-locked .cp-dot{border:0;background:transparent;color:var(--cp-muted)}
.cp-name{flex:1;min-width:0}
.cp-meta{display:flex;align-items:center;gap:6px;margin-top:3px;font-size:12px;color:var(--cp-muted);font-weight:400}
/* stepper (navigation: top) */
.cp-stepper{display:none;background:var(--cp-surface);border-bottom:1px solid var(--cp-line);padding:18px 20px 14px;overflow-x:auto}
.cp[data-nav=top]:not([data-single]) .cp-stepper{display:block}
.cp-steps{list-style:none;margin:0 auto;padding:0;display:flex;align-items:flex-start;max-width:960px;min-width:max-content}
.cp-step{flex:1;min-width:64px;display:flex;flex-direction:column;align-items:center;position:relative;text-align:center}
.cp-step:not(:first-child)::before{content:'';position:absolute;top:15px;right:50%;width:100%;height:2px;background:var(--cp-line);z-index:0}
.cp-step.is-done:not(:first-child)::before,.cp-step.is-current:not(:first-child)::before{background:var(--cp-accent)}
.cp-step>a,.cp-step>span{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:6px}
.cp-num{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:600;background:var(--cp-surface);border:2px solid var(--cp-line);color:var(--cp-muted)}
.cp-step.is-done .cp-num{background:var(--cp-accent);border-color:var(--cp-accent);color:#fff}
.cp-step.is-current .cp-num{border-color:var(--cp-accent);color:var(--cp-accent);box-shadow:0 0 0 4px var(--cp-accent-soft)}
.cp-step.is-locked .cp-num{background:var(--cp-bg)}
.cp-step-label{font-size:12px;color:var(--cp-muted);max-width:120px;line-height:1.3}
.cp-step.is-current .cp-step-label{color:var(--cp-text);font-weight:600}
@media (max-width:900px){.cp-step:not(.is-current) .cp-step-label{display:none}}
/* main */
.cp-main{flex:1;min-width:0;display:flex;flex-direction:column}
.cp-page{flex:1;width:100%;max-width:820px;margin:0 auto;padding:40px 24px 120px}
.cp-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--cp-accent);margin-bottom:10px}
.cp-page>h1{font-size:30px;line-height:1.2;font-weight:700;letter-spacing:-.02em;margin:0 0 24px}
.cp-note{display:flex;gap:10px;align-items:flex-start;padding:14px 16px;border-radius:var(--cp-radius);margin:0 0 20px;font-size:14px;background:var(--cp-surface);border:1px solid var(--cp-line)}
.cp-note.is-warn{background:#fffbeb;border-color:#fde68a;color:#92400e}
.cp-note.is-ok{background:#f0fdf4;border-color:#bbf7d0;color:#166534}
.cp-note.is-info{background:var(--cp-accent-soft);border-color:#c7d2fe;color:#3730a3}
/* authored content */
.cp-content{font-size:16px;line-height:1.75}
.cp-content h2{font-size:22px;line-height:1.3;font-weight:650;margin:32px 0 12px}
.cp-content h2:first-child{margin-top:0}
.cp-content h3{font-size:18px;font-weight:600;margin:24px 0 8px}
.cp-content p{margin:0 0 16px}
.cp-content ul,.cp-content ol{padding-left:22px;margin:0 0 16px}
.cp-content blockquote{margin:24px 0;padding:4px 0 4px 18px;border-left:3px solid var(--cp-accent);color:var(--cp-muted);font-style:italic}
.cp-content img,.cp-content video,.cp-content iframe{max-width:100%;border-radius:var(--cp-radius)}
.cp-content figure{margin:24px 0}
.cp-content iframe[src*="youtube"],.cp-content iframe[src*="vimeo"]{width:100%;aspect-ratio:16/9;height:auto;border:0}
.cp-content video{width:100%;background:#000}
.cp-content audio{width:100%}
.cp-content a{color:var(--cp-accent);text-decoration:underline;text-underline-offset:2px}
/* forms inside a page */
.cp-content form{background:var(--cp-surface);border:1px solid var(--cp-line);border-radius:16px;padding:28px;margin:24px 0;display:grid;gap:20px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.cp-content form>*{margin:0}
.cp-content label{font-size:14px;font-weight:500}
.cp-content label.block,.cp-content .space-y-1>label,.cp-content .space-y-2>label{display:block;margin-bottom:6px}
.cp-content input:not([type=checkbox]):not([type=radio]):not([type=file]),.cp-content select,.cp-content textarea{width:100%;height:44px;padding:0 14px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;font:inherit;font-size:15px;color:var(--cp-text);transition:border-color .15s,box-shadow .15s}
.cp-content textarea{height:auto;min-height:112px;padding:12px 14px;line-height:1.5}
.cp-content input:focus,.cp-content select:focus,.cp-content textarea:focus{outline:0;border-color:var(--cp-accent);box-shadow:0 0 0 3px var(--cp-accent-soft)}
.cp-content fieldset{border:0;padding:0;margin:0;display:grid;gap:8px}
.cp-content legend{font-weight:600;font-size:15px;margin-bottom:8px;padding:0}
.cp-content fieldset label{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--cp-line);border-radius:10px;cursor:pointer;font-weight:400;transition:border-color .15s,background .15s}
.cp-content fieldset label:hover{border-color:#cbd5e1;background:var(--cp-bg)}
.cp-content fieldset label:has(input:checked){border-color:var(--cp-accent);background:var(--cp-accent-soft)}
.cp-content input[type=radio],.cp-content input[type=checkbox]{width:18px;height:18px;accent-color:var(--cp-accent);margin:0}
.cp-content label.flex:has(input[type=checkbox]){display:flex;gap:10px;align-items:flex-start;font-weight:400}
.cp-content .border-dashed,.cp-content .cp-drop{border:1.5px dashed #cbd5e1;border-radius:12px;padding:16px;background:var(--cp-bg)}
.cp-content input[type=file]{font-size:14px;color:var(--cp-muted)}
.cp-content input[type=file]::file-selector-button{margin-right:12px;padding:8px 14px;border:1px solid var(--cp-line);border-radius:8px;background:#fff;color:var(--cp-text);font:inherit;font-weight:500;cursor:pointer}
.cp-content .text-sm{font-size:13px}
.cp-content .text-gray-500{color:var(--cp-muted)}
.cp-content form button[type=submit],.cp-content button[data-program-progress]{justify-self:start;display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 20px;border:0;border-radius:10px;background:var(--cp-accent);color:#fff;font:inherit;font-weight:600;cursor:pointer}
.cp-content form button[type=submit]:hover,.cp-content button[data-program-progress]:hover{filter:brightness(1.08)}
.cp-content .grid{display:grid;gap:16px}
.cp-content .cp-benefit{display:grid;gap:20px}
.cp-content section.cp-benefit{background:var(--cp-surface);border:1px solid var(--cp-line);border-radius:16px;padding:28px;margin:24px 0}
.cp-content .cp-benefit h2{margin:0 0 6px}
.cp-content .cp-benefit .cp-note{margin:0}
.cp-content .cp-agreement{max-height:260px;overflow:auto;padding:14px 16px;border:1px solid var(--cp-line);border-radius:10px;background:var(--cp-bg);font-size:14px}
.cp-content .cp-agreement p{margin:0 0 10px}
.cp-content [hidden]{display:none!important}
.cp-content .cp-field{display:grid;gap:6px}
.cp-content .cp-repeat{display:grid;gap:12px}
.cp-content .cp-repeat-head{font-weight:600;font-size:15px}
.cp-content .cp-rows{display:grid;gap:12px}
.cp-content .cp-row{display:grid;gap:14px;padding:16px;border:1px solid var(--cp-line);border-radius:12px;background:var(--cp-bg)}
.cp-content .cp-row-add,.cp-content .cp-row-remove{justify-self:start;display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border:1px solid var(--cp-line);border-radius:8px;background:var(--cp-surface);color:var(--cp-text);font:inherit;font-size:14px;font-weight:500;cursor:pointer}
.cp-content .cp-row-remove{color:#b91c1c}
.cp-content .cp-row-add:hover,.cp-content .cp-row-remove:hover{background:var(--cp-bg)}
.cp-result{margin:8px 0 0}
.cp-content iframe:not([src*="youtube"]):not([src*="vimeo"]){height:58vh!important;max-height:640px}
form[data-readonly] [type=submit],form[data-readonly] .cp-row-add,form[data-readonly] input[type=file]{display:none!important}form[data-readonly]{opacity:.85}
.cp-marks{margin:12px 0 18px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:12px;background:#fff}.cp-marks p{margin:0 0 8px}.cp-marks ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}.cp-marks li{display:flex;gap:8px;align-items:flex-start}.cp-marks li svg{flex:none;width:18px;height:18px;margin-top:2px}.cp-marks li.is-right svg{color:#16a34a}.cp-marks li.is-wrong svg{color:#dc2626}
@media (min-width:720px){.cp-content .md\\:grid-cols-2{grid-template-columns:1fr 1fr}.cp-content .md\\:grid-cols-3{grid-template-columns:repeat(3,1fr)}}
/* buttons + footer */
.cp-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;padding:0 20px;border-radius:10px;border:1px solid var(--cp-accent);background:var(--cp-accent);color:#fff!important;font:inherit;font-size:15px;font-weight:600;cursor:pointer;transition:filter .15s}
.cp-btn:hover{filter:brightness(1.08)}
.cp-btn.is-ghost{background:var(--cp-surface);color:var(--cp-text)!important;border-color:var(--cp-line)}
.cp-btn.is-ghost:hover{filter:none;background:var(--cp-bg)}
.cp-btn[data-loading]{opacity:.6;pointer-events:none}
.cp-foot{position:sticky;bottom:0;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);border-top:1px solid var(--cp-line)}
.cp-foot-in{max-width:820px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;gap:12px}
.cp-foot-in .cp-grow{flex:1}
/* overview */
.cp-hero{width:100%;aspect-ratio:21/9;object-fit:cover;border-radius:16px;margin:0 0 28px;display:block}
.cp-lead{font-size:18px;line-height:1.6;color:#334155}
.cp-facts{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0 28px}
.cp-chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;background:var(--cp-surface);border:1px solid var(--cp-line);font-size:13px;color:var(--cp-muted)}
.cp-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px}
.cp-inside{margin-top:40px;background:var(--cp-surface);border:1px solid var(--cp-line);border-radius:16px;overflow:hidden}
.cp-inside h2{font-size:16px;margin:0;padding:16px 20px}
/* my programs */
.cp-cards{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}
.cp-card{background:var(--cp-surface);border:1px solid var(--cp-line);border-radius:16px;overflow:hidden;transition:box-shadow .2s,transform .2s}
.cp-card:hover{box-shadow:0 12px 32px -12px rgba(15,23,42,.18);transform:translateY(-2px)}
.cp-card img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}
.cp-card-in{padding:18px}
.cp-card h3{margin:0 0 12px;font-size:16px;font-weight:600}
.cp-card .cp-progress{border-radius:3px;overflow:hidden}
.cp-card small{display:block;margin-top:8px;color:var(--cp-muted);font-size:13px}
@media (max-width:900px){.cp-body{flex-direction:column}.cp-nav{width:auto;position:static;max-height:none;border-right:0;border-bottom:1px solid var(--cp-line)}.cp[data-nav=sidebar] .cp-nav{display:none}.cp-page{padding:28px 18px 120px}.cp-page>h1{font-size:24px}}
</style>`;

/**
 * The page's own title is drawn above its body. A body that opens with a heading saying the
 * same thing (the "Heading and text" starter) would print it twice, so that heading is dropped.
 */
const withoutLeadingTitle = (html: string, title?: string): string => {
  if (!title) return html;
  const m = html.match(/^\s*(?:<(?:section|div)\b[^>]*>\s*)?<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/i);
  if (!m) return html;
  const text = m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().toLowerCase();
  if (text !== String(title).trim().toLowerCase()) return html;
  // Keep a wrapping section/div that the heading opened: remove the heading only.
  const h = m[0].match(/<h[12]\b[^>]*>[\s\S]*?<\/h[12]>/i)![0];
  return html.replace(h, '');
};

export type PlayerContext = {
  /** The Content Player page — the first segment of every address. */
  page: string;
  /** Query kept on every link (`code`, or the preview's token). */
  query: string;
  /** Set when nobody is signed in: Start becomes the way to sign in and come back. */
  signInHref?: string;
  /** Preview: every page open, nothing recorded. */
  preview?: boolean;
  /** Why the page asked for could not open (locked), shown on the post's page. */
  notice?: string;
  /** The language the post is shown in ('' = as written; see `pickLanguage`). */
  lang?: string;
  /** Languages the post has up-to-date translations in — a switch shows when there are any. */
  languages?: string[];
  /** The query without the language, for the switch's links. */
  baseQuery?: string;
  /** What "as written" is called on the switch (the site's language when it has one). */
  originalLabel?: string;
  /** appmint-one: the overview's way out (default "My programs") and the mine page's title (default "My programs"). */
  exitLabel?: string;
  mineTitle?: string;
};

// ── Languages ────────────────────────────────────────────────────────────────
// A page's translations arrive from the server only when they were made from what the
// page says now (a page changed since reads as written). A translated quiz keeps the
// original's fields and option values, so its answers are marked against the same key.

/** `?lang=original`: read as written even when the profile or site names a language the post has. */
export const ORIGINAL_LANG = 'original';

/**
 * The language to show the post in: the one picked in the player, else the reader's
 * profile language, else the site's — whichever the post has (a regional code matches
 * its language: es-MX → es). '' = as written.
 */
export function pickLanguage(available: string[], picked?: string, profile?: string | null, site?: string | null): string {
  if (picked === ORIGINAL_LANG) return '';
  const match = (l?: string | null) => {
    const v = String(l || '').trim().toLowerCase();
    if (!v) return '';
    return available.find((a) => a.toLowerCase() === v) || available.find((a) => a.toLowerCase() === v.split(/[-_]/)[0]) || '';
  };
  return match(picked) || match(profile) || match(site);
}

/** The page in this language when it has an up-to-date translation in it; otherwise the page as written. */
export function inLanguage<T extends { title?: string; summary?: string; content?: string; translations?: Record<string, any> }>(page: T, lang?: string): T {
  const t = lang ? page?.translations?.[lang] : null;
  if (!page || !t?.content) return page;
  return { ...page, title: t.title || page.title, summary: t.summary || page.summary, content: t.content };
}

/** A language's own name for itself (Español), or its code. */
export const languageName = (code: string): string => {
  try {
    const name = new Intl.DisplayNames([code], { type: 'language' }).of(code);
    return name ? name.charAt(0).toLocaleUpperCase(code) + name.slice(1) : code;
  } catch {
    return code;
  }
};

/** `?code=…&lang=…` — the query every link keeps, with the language picked (none: left out). */
export const withLang = (query: string, lang?: string): string => [query, lang ? `lang=${encodeURIComponent(lang)}` : ''].filter(Boolean).join('&');

/** An outline item's title in the language shown (from its page's translation), else as written. */
const titleOf = (i: any, ctx: PlayerContext) => (ctx.lang && i?.titles?.[ctx.lang]) || i?.title;

// The page may be more than one segment (`__preview/post`); each is encoded on its own.
// A `{{…}}` item is a runtime placeholder (filled from an action's result): left as written.
const hrefOf = (ctx: PlayerContext, course: string, item?: string) =>
  `/${ctx.page.split('/').map(encodeURIComponent).join('/')}/${encodeURIComponent(course)}${
    item ? `/${/^\{\{\w+\}\}$/.test(item) ? item : encodeURIComponent(item)}` : ''
  }${ctx.query ? `?${ctx.query}` : ''}`;

const courseRef = (view: any) => String(view?.course?.slug || view?.course?.id || '');
const pagesOf = (view: any) => (view?.items || []).filter((i: any) => i.kind === 'page');

const date = (v: any) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
};

/** The dot beside a page in the outline: its state, at a glance. */
const dot = (status: string) =>
  `<span class="cp-dot">${
    status === 'done' ? icon('check', 12) : status === 'locked' ? icon('lock', 14) : status === 'pending-review' ? icon('clock', 12) : status === 'changes' ? icon('alert', 12) : ''
  }</span>`;

/** "▶ Video · 3 min" — the page's own type and duration, as the author set them. */
const meta = (i: any) =>
  i.type || i.duration ? `<span class="cp-meta">${typeIcon(i.type)}${esc(i.type || '')}${i.type && i.duration ? ' · ' : ''}${esc(i.duration || '')}</span>` : '';

/** One page in the outline. A link only when it can be opened now. */
const navItem = (i: any, ctx: PlayerContext, course: string, current: string) => {
  const cls = `cp-item is-${esc(i.status)}${i.id === current ? ' is-current' : ''}`;
  const inner = `${dot(i.status)}<span class="cp-name">${esc(titleOf(i, ctx))}${meta(i)}</span>`;
  if (i.status !== 'locked') return `<li class="${cls}"><a href="${esc(hrefOf(ctx, course, i.id))}">${inner}</a></li>`;
  return `<li class="${cls}"${i.lockReason ? ` title="${esc(i.lockReason)}"` : ''}><span>${inner}</span></li>`;
};

/** The outline: sections as collapsible groups (open while there is work in them), pages inside. */
const outline = (view: any, ctx: PlayerContext, current: string) => {
  const course = courseRef(view);
  const groups: { head: any; items: any[] }[] = [];
  for (const i of view?.items || []) {
    if (i.kind === 'chapter') groups.push({ head: i, items: [] });
    else if (groups.length && Number(i.depth) > 0) groups[groups.length - 1].items.push(i);
    else groups.push({ head: null, items: [i] });
  }
  return groups
    .map(({ head, items }) => {
      const list = `<ul class="cp-list">${items.map((i) => navItem(i, ctx, course, current)).join('')}</ul>`;
      if (!head) return list;
      const open = head.status !== 'done' || items.some((i) => i.id === current);
      return `<details class="cp-sec is-${esc(head.status)}"${open ? ' open' : ''}><summary>
        <span class="cp-sec-t">${esc(head.title)}${head.lockReason ? `<small>${esc(head.lockReason)}</small>` : ''}</span>
        ${head.total !== undefined ? `<span class="cp-count">${Number(head.done) || 0}/${Number(head.total) || 0}</span>` : ''}
        <span class="cp-chev">${icon('chevron')}</span></summary>${list}</details>`;
    })
    .join('');
};

/** The numbered stepper (navigation: top): only the current step says its name on small screens. */
const stepper = (view: any, ctx: PlayerContext, current: string) => {
  const course = courseRef(view);
  const steps = pagesOf(view)
    .map((i: any) => {
      const cls = `cp-step is-${esc(i.status)}${i.id === current ? ' is-current' : ''}`;
      const num = `<span class="cp-num">${i.status === 'done' ? icon('check', 14) : i.status === 'locked' ? icon('lock', 13) : esc(i.step ?? '')}</span>`;
      const label = `<span class="cp-step-label">${esc(titleOf(i, ctx))}</span>`;
      return i.status === 'locked'
        ? `<li class="${cls}" title="${esc(i.lockReason || 'Not open yet')}"><span>${num}${label}</span></li>`
        : `<li class="${cls}"><a href="${esc(hrefOf(ctx, course, i.id))}">${num}${label}</a></li>`;
    })
    .join('');
  return `<nav class="cp-stepper" aria-label="Steps"><ol class="cp-steps">${steps}</ol></nav>`;
};

/** The language switch: as written, then each language the post has. Links keep the place and the code. */
const languageSwitch = (view: any, ctx: PlayerContext, current: string) => {
  const langs = ctx.languages || [];
  if (!langs.length) return '';
  const course = courseRef(view);
  const link = (code: string, label: string, on: boolean) =>
    `<a href="${esc(hrefOf({ ...ctx, query: withLang(ctx.baseQuery ?? ctx.query, code) }, course, current || undefined))}"${code === ORIGINAL_LANG ? '' : ` hreflang="${esc(code)}"`}${on ? ' class="is-on" aria-current="true"' : ''}>${esc(label)}</a>`;
  return `<nav class="cp-langs" aria-label="Language">${link(ORIGINAL_LANG, ctx.originalLabel || 'Original', !ctx.lang)}${langs.map((l) => link(l, languageName(l), ctx.lang === l)).join('')}</nav>`;
};

/** Header (exit, title, where I am, progress) and the outline around the page. */
const shell = (view: any, ctx: PlayerContext, current: string, exit: { href: string; label: string }, main: string) => {
  const e = view?.enrollment;
  const pct = Number(e?.percent) || 0;
  const count = Number(view?.course?.steps) || pagesOf(view).length;
  const at = pagesOf(view).find((i: any) => i.id === current);
  const where = ctx.preview ? 'Preview' : at?.step && count > 1 ? `Step ${at.step} of ${count}` : e ? (e.status === 'completed' ? 'Completed' : `${pct}% complete`) : '';
  const single = count <= 1;
  return `${STYLE}
<div class="cp" data-nav="${esc(view?.course?.navigation || 'sidebar')}"${single ? ' data-single' : ''}${ctx.lang ? ` lang="${esc(ctx.lang)}"` : ''}>
  ${ctx.preview ? `<div class="cp-preview">${icon('eye', 14)} Preview — every page is open and nothing you do here is saved.</div>` : ''}
  <header class="cp-bar">
    <div class="cp-bar-in">
      <a class="cp-exit" href="${esc(exit.href)}">${icon('back')}${esc(exit.label)}</a>
      <div class="cp-titles"><b>${esc(view?.course?.title)}</b>${where ? `<small>${esc(where)}</small>` : ''}</div>
      ${languageSwitch(view, ctx, current)}
      <span class="cp-pct">${e && !ctx.preview ? `${pct}%` : ''}</span>
    </div>
    ${!single && (e || ctx.preview) ? `<div class="cp-progress"><span style="width:${ctx.preview ? 0 : pct}%"></span></div>` : ''}
  </header>
  ${single ? '' : stepper(view, ctx, current)}
  <div class="cp-body">
    ${single ? '' : `<aside class="cp-nav"><div class="cp-nav-head"><b>${esc(view?.course?.title)}</b><small>${e ? (e.status === 'completed' ? 'Completed' : `${pct}% complete`) : `${count} ${count === 1 ? 'page' : 'pages'}`}</small></div>${outline(view, ctx, current)}</aside>`}
    <main class="cp-main">${main}</main>
  </div>
</div>`;
};

/** The post: what it is, where I am, and the way in (Start / sign in) or on (Continue). */
export function playerOverviewHtml(view: any, ctx: PlayerContext) {
  const course = courseRef(view);
  const e = view?.enrollment;
  const nextHref = view?.next ? hrefOf(ctx, course, view.next) : '';
  const first = ctx.preview ? view?.first : view?.next;
  const start = ctx.preview
    ? first ? `<a class="cp-btn" href="${esc(hrefOf(ctx, course, first))}">Start ${icon('next')}</a>` : ''
    : ctx.signInHref
      ? `<a class="cp-btn" href="${esc(ctx.signInHref)}">Sign in to start</a>${nextHref ? `<a class="cp-btn is-ghost" href="${esc(nextHref)}">Look inside</a>` : ''}`
      : !e
        ? `<button class="cp-btn" data-action="contentPlayer.enroll" data-on-success="navigate:${esc(hrefOf(ctx, course, '{{next}}'))}">Start ${icon('next')}</button>${nextHref ? `<a class="cp-btn is-ghost" href="${esc(nextHref)}">Look inside</a>` : ''}`
        : nextHref
          ? `<a class="cp-btn" href="${esc(nextHref)}">Continue ${icon('next')}</a>`
          : '';
  const count = Number(view?.course?.steps) || pagesOf(view).length;
  const facts = [
    `${icon('text', 14)}${count} ${view?.course?.navigation === 'top' ? (count === 1 ? 'step' : 'steps') : count === 1 ? 'page' : 'pages'}`,
    e?.dueAt && e?.status !== 'completed' ? `${icon('clock', 14)}Due ${esc(date(e.dueAt))}` : '',
    e ? `${icon('check', 14)}${e.status === 'completed' ? `Completed ${esc(date(e.completedAt))}` : `${Number(e.percent) || 0}% complete`}` : '',
  ]
    .filter(Boolean)
    .map((f) => `<span class="cp-chip">${f}</span>`)
    .join('');
  const main = `<div class="cp-page">
      ${view?.course?.coverImage ? `<img class="cp-hero" src="${esc(view.course.coverImage)}" alt="">` : ''}
      <h1>${esc(view?.course?.title)}</h1>
      ${ctx.notice ? `<div class="cp-note is-warn">${icon('lock')}<span>${esc(ctx.notice)}</span></div>` : ''}
      <div class="cp-content cp-lead">${view?.course?.summary || ''}</div>
      <div class="cp-facts">${facts}</div>
      <div class="cp-cta">${start}</div>
      ${view?.course?.navigation !== 'sidebar' ? `<section class="cp-inside"><h2>What's inside</h2>${outline(view, ctx, '')}</section>` : ''}
    </div>`;
  return shell(view, ctx, '', { href: `/${ctx.page}`, label: ctx.exitLabel || 'My programs' }, main);
}

/** Pages that finish themselves — they carry a form or an "I've read it" — get no Mark complete. */
const finishesItself = (content: string) => /data-program-answer|data-program-benefit|data-program-progress=["']done["']/.test(content || '');

// ── Benefit applications ─────────────────────────────────────────────────────
// The studio writes `<wm-form data-benefit="…">`; the route reads each benefit's
// application from client-data/benefits/:name/application and this draws it:
// the benefit, its application form's fields, its agreement — or, once this
// person has applied, where the application stands. Sending it is
// runtime/content-player-contract.ts (`form[data-program-benefit]`). Every drawn
// block carries `data-program-benefit`, so the page still finishes itself (no
// Mark complete) whichever state it shows.

const BENEFIT_TAG = /<wm-form\b([^>]*\bdata-benefit="([^"]*)"[^>]*)>(?:\s*<\/wm-form>)?/gi;
const unesc = (v: string) => v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** The benefits a page's content asks for, by name. */
export const benefitsIn = (content: string): string[] => [...new Set([...String(content || '').matchAll(BENEFIT_TAG)].map((m) => unesc(m[2])).filter(Boolean))];

/** What the route found for one benefit: its application, or why it could not be read. */
export type BenefitLookup = { app?: any; status?: number; message?: string };

const SYSTEM_FIELDS = new Set(['id', 'sk', 'pk', 'datatype', 'author', 'createdate', 'modifydate', 'version', 'state', 'search', 'status', 'availability', 'workflow', 'owner', 'assignedto']);
/** Record keeping the staff fill in or the system stamps — when, by whom, internal notes. */
const STAFF_NAME = /^(internal|admin|staff)[A-Z_]|^(created|updated|modified|deleted|approved|rejected|reviewed)(At|By|Date|On)?$|^last[A-Z]\w*(At|Date)$|(Updated|Modified)(At|Date)?$/;
/**
 * A question the applicant answers: not hidden, read-only or disabled, not kept
 * out of forms (`hideIn` form/create, `x-hidden`, admin/staff-only, group
 * `internal`), not a system or staff record-keeping field, and not a pick from
 * another collection (the applicant cannot read those records). A required
 * field is always asked.
 */
/** A file upload (one file, or a list of uploaded files the designer describes as objects). */
const isFileProp = (prop: any): boolean =>
  ['file', 'image', 'signature'].includes(String(prop?.['x-control'] || '').toLowerCase()) || ['file', 'image'].includes(String(prop?.items?.['x-control'] || '').toLowerCase());
const asksApplicant = (key: string, prop: any, required: boolean): boolean => {
  if (!prop || 'const' in prop) return false;
  if (required) return true;
  const hideIn = Array.isArray(prop.hideIn) ? prop.hideIn.map((x: any) => String(x).toLowerCase()) : [];
  // A file field is marked read-only by the collection designer (its stored path is not typed in): it is still asked.
  if (prop.hidden || prop['x-hidden'] || ((prop.readOnly || prop.readonly) && !isFileProp(prop)) || prop.disabled) return false;
  if (hideIn.includes('form') || hideIn.includes('create')) return false;
  if (prop.adminOnly || prop.staffOnly || prop.internal || String(prop.group || '').toLowerCase() === 'internal') return false;
  if (SYSTEM_FIELDS.has(key.toLowerCase()) || STAFF_NAME.test(key) || /^(created|updated|modified)/i.test(key)) return false;
  if (prop.dataSource?.source === 'collection' || prop.items?.dataSource?.source === 'collection') return false;
  return true;
};
const titleCase = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const typeOf = (prop: any): string => {
  const t = prop?.type;
  return Array.isArray(t) ? t.find((x: string) => x !== 'null') || 'string' : t || 'string';
};
const optionsOf = (prop: any): { value: string; label: string }[] => {
  const raw = prop?.enum || prop?.items?.enum || prop?.options || prop?.items?.options;
  if (!Array.isArray(raw)) return [];
  const names = prop?.enumNames || prop?.items?.enumNames;
  return raw.map((o: any, i: number) =>
    o && typeof o === 'object'
      ? { value: String(o.value ?? o.key ?? o.label), label: String(o.label ?? o.title ?? o.value) }
      : { value: String(o), label: String(names?.[i] ?? titleCase(String(o))) },
  );
};

/**
 * A field's show/hide rules (`rules: [{ operation, valueA, valueB, action }]`,
 * the same ones the admin forms run) ride on its wrapper; the runtime
 * (content-player-contract.ts) runs them as the form is filled.
 */
const RULE_ACTIONS = ['hide', 'show', 'disabled', 'readOnly'];
const wrap = (path: string, prop: any, inner: string, cls = 'cp-field') => {
  const rules = Array.isArray(prop?.rules) ? prop.rules.filter((r: any) => r && r.operation && RULE_ACTIONS.includes(r.action)) : [];
  return `<div class="${cls}" data-field="${esc(path)}"${rules.length ? ` data-rules="${esc(JSON.stringify(rules))}"` : ''}>${inner}</div>`;
};

/** One question of a form drawn from a collection's schema, as plain HTML the page's styles already cover. */
const fieldHtml = (path: string, key: string, prop: any, required: boolean): string => {
  const type = typeOf(prop);
  const control = String(prop?.['x-control'] || '').toLowerCase();
  const variant = String(prop?.['x-control-variant'] || '').toLowerCase();
  const format = String(prop?.format || '').toLowerCase();
  const label = esc(prop?.title || prop?.label || titleCase(key));
  const help = prop?.description ? `<p class="text-sm text-gray-500">${esc(prop.description)}</p>` : '';
  const req = required ? ' required' : '';
  const name = esc(path);
  const id = `bf-${name.replace(/[^\w-]/g, '_')}`;
  const options = optionsOf(prop);
  const placeholder = prop?.placeholder ? ` placeholder="${esc(prop.placeholder)}"` : '';

  if (type === 'array' && options.length) {
    return wrap(path, prop, `<fieldset><legend>${label}</legend>${options.map((o) => `<label><input type="checkbox" name="${name}" value="${esc(o.value)}" data-type="array" /> ${esc(o.label)}</label>`).join('')}${help}</fieldset>`);
  }
  if (options.length) {
    return wrap(path, prop, `<div class="space-y-1"><label for="${id}">${label}</label><select id="${id}" name="${name}" data-type="${type}"${req}><option value="">Choose…</option>${options
      .map((o) => `<option value="${esc(o.value)}"${prop?.default !== undefined && String(prop.default) === o.value ? ' selected' : ''}>${esc(o.label)}</option>`)
      .join('')}</select>${help}</div>`);
  }
  if (type === 'boolean') {
    return wrap(path, prop, `<label class="flex"><input type="checkbox" name="${name}" value="true" data-type="boolean"${prop?.default === true ? ' checked' : ''}${req} /> <span>${label}</span></label>${help}`);
  }
  const itemControl = String(prop?.items?.['x-control'] || '').toLowerCase();
  const file = ['file', 'image', 'signature'].includes(control) || ['file', 'image'].includes(itemControl) || format === 'binary' || format === 'data-url';
  if (file) {
    return wrap(path, prop, `<div class="space-y-1"><label for="${id}">${label}</label><input id="${id}" type="file" name="${name}" data-type="file"${type === 'array' ? ' multiple' : type === 'string' ? ' data-store="url"' : ''}${req} />${help}</div>`);
  }
  // A list of words or lines (tags, references): one per line.
  if (type === 'array') {
    return wrap(path, prop, `<div class="space-y-1"><label for="${id}">${label}</label><textarea id="${id}" name="${name}" data-type="lines" rows="3"${placeholder}${req}>${esc(Array.isArray(prop?.default) ? prop.default.join('\n') : '')}</textarea><p class="text-sm text-gray-500">One per line.</p>${help}</div>`);
  }
  const long = ['textarea', 'richtext', 'markdown'].includes(control) || variant === 'textarea' || (prop?.maxLength ?? 0) > 180;
  if (long) return wrap(path, prop, `<div class="space-y-1"><label for="${id}">${label}</label><textarea id="${id}" name="${name}" data-type="string"${placeholder}${req}>${esc(prop?.default ?? '')}</textarea>${help}</div>`);
  const is = (...names: string[]) => names.includes(format) || names.includes(control) || names.includes(variant);
  const inputType =
    type === 'number' || type === 'integer'
      ? 'number'
      : is('date')
        ? 'date'
        : is('date-time', 'datetime', 'datetimepicker')
          ? 'datetime-local'
          : is('time')
            ? 'time'
            : is('email')
              ? 'email'
              : is('tel', 'phone')
                ? 'tel'
                : is('uri', 'url')
                  ? 'url'
                  : 'text';
  const bounds = [
    prop?.minimum !== undefined ? ` min="${esc(prop.minimum)}"` : '',
    prop?.maximum !== undefined ? ` max="${esc(prop.maximum)}"` : '',
    type === 'number' ? ' step="any"' : '',
    prop?.minLength ? ` minlength="${esc(prop.minLength)}"` : '',
    prop?.maxLength ? ` maxlength="${esc(prop.maxLength)}"` : '',
    // The schema's pattern is checked as it is typed; the description says what it wants.
    prop?.pattern && inputType === 'text' ? ` pattern="${esc(prop.pattern)}"${prop?.description ? ` title="${esc(prop.description)}"` : ''}` : '',
  ].join('');
  return wrap(path, prop, `<div class="space-y-1"><label for="${id}">${label}</label><input id="${id}" type="${inputType}" name="${name}" data-type="${esc(type)}" value="${esc(prop?.default ?? '')}"${placeholder}${bounds}${req} />${help}</div>`);
};

/**
 * A list of things, each with its own fields (owners, locations): one box per
 * row, Add / Remove. The row's fields are named `<list>.<n>.<field>`; the
 * runtime adds rows from the template and folds the names back into a list.
 */
const repeatHtml = (path: string, key: string, prop: any, required: boolean, depth: number): string => {
  const label = esc(prop?.title || prop?.label || titleCase(key));
  const help = prop?.description ? `<p class="text-sm text-gray-500">${esc(prop.description)}</p>` : '';
  const one = esc(prop?.items?.title || 'another');
  const row = (i: string) =>
    `<div class="cp-row" data-row>${fieldsHtml(prop.items, `${path}.${i}`, depth + 1)}<button type="button" class="cp-row-remove" data-remove-row>Remove</button></div>`;
  const start = Math.max(Number(prop?.minItems || 0), required ? 1 : 0);
  return wrap(
    path,
    prop,
    `<div class="cp-repeat-head">${label}</div>${help}<div class="cp-rows" data-rows>${Array.from({ length: start }, (_, i) => row(String(i))).join('')}</div><template data-row-template>${row('__i__')}</template><button type="button" class="cp-row-add" data-add-row>+ Add ${one}</button>`,
    'cp-field cp-repeat',
  );
};

/** A form's questions; a nested object's fields ask under dotted names, a list of objects as rows. */
const fieldsHtml = (schema: any, prefix = '', depth = 0): string =>
  Object.entries(schema?.properties || {})
    .map(([key, prop]: [string, any]) => {
      const required = (schema?.required || []).includes(key) || prop?.inputRequired === true;
      if (!asksApplicant(key, prop, required)) return '';
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeOf(prop) === 'object' && prop.properties && depth < 3) return fieldsHtml(prop, path, depth + 1);
      if (typeOf(prop) === 'object') return '';
      if (isFileProp(prop)) return fieldHtml(path, key, prop, required);
      if (typeOf(prop) === 'array' && typeOf(prop.items) === 'object' && prop.items?.properties) {
        // A list inside a list's row is more than a page form asks for.
        return depth < 2 && !/\.__i__\b|\.\d+\./.test(`${path}.`) ? repeatHtml(path, key, prop, required, depth) : '';
      }
      return fieldHtml(path, key, prop, required);
    })
    .join('');

/** Text an author typed without markup: blank lines make paragraphs, single line breaks stay. HTML is used as written. */
const paragraphs = (text: string): string =>
  /<\/?[a-z][\s\S]*?>/i.test(text)
    ? text
    : String(text)
        .replace(/\r\n?/g, '\n')
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
        .join('');

const STANDING: Record<string, { tone: string; icon: string; text: string }> = {
  pending: { tone: 'is-info', icon: 'clock', text: 'Application sent — waiting for review.' },
  in_progress: { tone: 'is-info', icon: 'clock', text: 'Application sent — being reviewed.' },
  under_review: { tone: 'is-info', icon: 'clock', text: 'Application sent — being reviewed.' },
  approved: { tone: 'is-ok', icon: 'check', text: 'Approved.' },
  active: { tone: 'is-ok', icon: 'check', text: 'Approved — you have this benefit.' },
  rejected: { tone: 'is-warn', icon: 'alert', text: 'Your last application was not approved.' },
  expired: { tone: 'is-warn', icon: 'alert', text: 'Your benefit has expired.' },
  cancelled: { tone: 'is-warn', icon: 'alert', text: 'Your application was cancelled.' },
};

/** One benefit's application: its form, or where this person's application stands. */
const benefitHtml = (name: string, attrs: string, found: BenefitLookup | undefined, step: { done?: boolean; preview?: boolean; signInHref: string }): string => {
  const app = found?.app;
  if (!app?.benefit) {
    if (found?.status === 401 || found?.status === 403)
      return `<div class="cp-note is-info" data-program-benefit="${esc(name)}">${icon('lock')}<span>Sign in to apply for ${esc(name)}. <a href="${esc(step.signInHref)}">Sign in</a></span></div>`;
    return `<div class="cp-note is-warn" data-program-benefit="${esc(name)}">${icon('alert')}<span>This benefit application isn't available — ${esc(found?.message || `no benefit named “${name}”`)}.</span></div>`;
  }
  const b = app.benefit;
  // The program's details show in every state — applied, approved, closed or signed out — not only on the form.
  const head = `<div><h2>${esc(b.title || b.name)}</h2>${b.description ? `<p>${esc(b.description)}</p>` : ''}</div>${b.information ? `<div class="cp-benefit-info">${b.information}</div>` : ''}`;
  const e = app.enrollment;
  // Held without an application (given directly or through a group): say how, never "Approved".
  const held = e?.holds
    ? { tone: 'is-ok', icon: 'check', text: e.via === 'group' && e.group ? `You already have this benefit through your ${e.group} membership.` : ['approved', 'active'].includes(String(e.status)) ? `Approved — you're in ${b.title || b.name}.` : 'You already have this benefit.' }
    : null;
  const standing = held || (e?.status ? STANDING[e.status] || { tone: 'is-info', icon: 'clock', text: `Application status: ${titleCase(String(e.status))}.` } : null);
  const note = standing
    ? `<div class="cp-note ${standing.tone}">${icon(standing.icon)}<span>${esc(standing.text)}${e.status === 'rejected' && e.rejectionReason ? ` ${esc(e.rejectionReason)}` : ''}${e.number ? ` <small>Application ${esc(e.number)}</small>` : ''}</span></div>`
    : '';
  // Applied (and not turned down): the status, and a way on when the step isn't finished yet.
  if (standing && !['rejected', 'expired', 'cancelled'].includes(e.status)) {
    const on = !step.done && !step.preview ? `<button type="button" data-program-progress="done">Continue</button>` : '';
    return `<section class="cp-benefit" data-program-benefit="${esc(b.name)}">${head}${note}${on}</section>`;
  }
  if (!b.open) return `<section class="cp-benefit" data-program-benefit="${esc(b.name)}">${head}<div class="cp-note is-warn">${icon('lock')}<span>This benefit isn't taking applications right now.</span></div></section>`;
  if (!app.signedIn && !step.preview)
    return `<section class="cp-benefit" data-program-benefit="${esc(b.name)}">${head}<div class="cp-note is-info">${icon('lock')}<span>Sign in to apply. <a href="${esc(step.signInHref)}">Sign in</a></span></div></section>`;
  const submit = attrs.match(/data-submit-label="([^"]*)"/)?.[1];
  const agreement = b.legalAgreement
    ? `<div class="cp-agreement">${paragraphs(b.legalAgreement)}</div><label class="flex"><input type="checkbox" name="__agreementAccepted" value="true" required /> <span>I have read and accept this agreement</span></label>`
    : '';
  return `<form class="cp-benefit" data-program-benefit="${esc(b.name)}">
    ${head}${note}
    ${app.form?.schema ? fieldsHtml(app.form.schema) : ''}
    ${agreement}
    <button type="submit">${submit ? submit : 'Apply'}</button>
  </form>`;
};

/**
 * The page's content with each benefit placeholder drawn. `found` is keyed by
 * benefit name; the page is otherwise untouched.
 */
export function withBenefits(content: string, found: Record<string, BenefitLookup>, step: { done?: boolean; preview?: boolean; signInHref: string }): string {
  return String(content || '').replace(BENEFIT_TAG, (_m, attrs: string, name: string) => benefitHtml(unesc(name), attrs, found[unesc(name)], step));
}

// ── Forms from a collection ──────────────────────────────────────────────────
// The studio writes `<wm-form data-collection="…" data-program-answer>`; the
// server sends the collection's schema with the page (`forms`, read for the
// visitor because a site cannot read collections) and this draws it with the
// same fields as a benefit application. Sent, it is the page's answer
// (`form[data-program-answer][data-program-typed]` in content-player-contract.ts).

const COLLECTION_TAG = /<wm-form\b([^>]*\bdata-collection="([^"]*)"[^>]*)>(?:\s*<\/wm-form>)?/gi;

export type CollectionForm = { name: string; title?: string; schema: any };

/** The page's content with each collection form drawn. `forms` is keyed by collection name. */
export function withCollectionForms(content: string, forms: Record<string, CollectionForm> | undefined): string {
  return String(content || '').replace(COLLECTION_TAG, (_m, attrs: string, raw: string) => {
    const name = unesc(raw);
    const form = forms?.[name];
    if (!form?.schema) return `<div class="cp-note is-warn">${icon('alert')}<span>This form isn't available — no form named “${esc(name)}”.</span></div>`;
    const submit = attrs.match(/data-submit-label="([^"]*)"/)?.[1];
    return `<form class="cp-collection-form" data-program-answer data-program-typed data-collection="${esc(name)}">
    ${fieldsHtml(form.schema)}
    <button type="submit">${submit || 'Submit'}</button>
  </form>`;
  });
}

/** A page's forms that send answers, taken out once its answers are locked. */
const ANSWER_FORM = /<form\b[^>]*\bdata-program-answer\b[\s\S]*?<\/form>/gi;

/** The words of a question on the page, by its field name (the fieldset's legend, or the field's label). */
function questionText(content: string, name: string): string {
  const html = String(content || '');
  const strip = (x: string) => x.replace(/<span\b[^>]*>\(select all that apply\)<\/span>/gi, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  for (const m of html.matchAll(/<fieldset\b[\s\S]*?<\/fieldset>/gi)) {
    if (m[0].includes(`name="${name}"`)) { const lg = m[0].match(/<legend\b[^>]*>([\s\S]*?)<\/legend>/i); if (lg) return strip(lg[1]); }
  }
  const lb = html.match(new RegExp(`<label\\b[^>]*for="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([\\s\\S]*?)<\\/label>`, 'i'));
  return lb ? strip(lb[1]) : name;
}

/** How each marked question went, after sending: right or not (never the right answer itself). */
function marksHtml(content: string, marks: Record<string, boolean> | undefined): string {
  const names = Object.keys(marks || {});
  if (!names.length) return '';
  const right = names.filter((n) => marks![n]).length;
  return `<div class="cp-marks"><p><strong>${right} of ${names.length}</strong> right</p><ul>${names
    .map((n) => `<li class="${marks![n] ? 'is-right' : 'is-wrong'}">${icon(marks![n] ? 'check' : 'alert')}<span>${esc(questionText(content, n))}</span></li>`)
    .join('')}</ul></div>`;
}

/** The page's answer forms, shown filled in but not sendable. */
const readOnlyForms = (content: string) =>
  String(content || '').replace(/<form\b([^>]*\bdata-program-answer\b[^>]*)>/gi, '<form$1 data-readonly inert>');

/** One page, with Back / Mark complete / Continue under it. */
export function playerItemHtml(view: any, opened: any, ctx: PlayerContext) {
  const course = courseRef(view);
  const item = opened?.item || {};
  const page = opened?.page || {};
  const progress = opened?.progress || {};
  const review = progress.review || {};
  const result = opened?.result;
  const single = pagesOf(view).length <= 1;
  const notes = [
    review.status === 'changes' ? `<div class="cp-note is-warn">${icon('alert')}<span><strong>Changes requested.</strong> ${esc(review.note || '')}</span></div>` : '',
    review.status === 'pending' ? `<div class="cp-note is-info">${icon('clock')}<span>Sent in — waiting for review.</span></div>` : '',
    review.status === 'approved' ? `<div class="cp-note is-ok">${icon('check')}<span>Approved${review.note ? ` — ${esc(review.note)}` : ''}</span></div>` : '',
    // A page whose score opens a later step says what it decided; a plain quiz keeps its score.
    result
      ? `<div class="cp-note ${result.passed ? 'is-ok' : 'is-warn'}">${icon(result.passed ? 'check' : 'alert')}<span><strong>${esc(result.message)}</strong>${
          result.passed && result.next?.id && !ctx.preview ? `<p class="cp-result"><a class="cp-btn" href="${esc(hrefOf(ctx, course, result.next.id))}">Continue to ${esc(result.next.title)} ${icon('next')}</a></p>` : ''
        }</span></div>`
      : progress.score !== undefined && progress.score !== null
        ? `<div class="cp-note is-info">${icon('quiz')}<span>Your score: <strong>${esc(progress.score)}</strong></span></div>`
        : '',
    marksHtml(page.content, progress.marks),
    // a form page with nothing to mark or review: the sender is told it arrived
    !result && !review.status && progress.done && opened?.answer && (progress.score === undefined || progress.score === null) && !/data-benefit=|data-program-benefit/.test(String(page.content || ''))
      ? `<div class="cp-note is-ok">${icon('check')}<span><strong>Sent — thank you.</strong> Your answers are saved; you can change them and send again.</span></div>`
      : '',
    ctx.preview && page.reviewers?.length ? `<div class="cp-note is-info">${icon('eye')}<span>Sent in, this waits for review by ${esc(page.reviewers.join(', '))}.</span></div>` : '',
  ].join('');
  // A next step that is still shut (a qualifier not passed) is not offered as the way on: back to the overview instead.
  const nextShut = !ctx.preview && pagesOf(view).find((i: any) => i.id === item.next)?.status === 'locked';
  const nextHref = item.next && !nextShut ? hrefOf(ctx, course, item.next) : hrefOf(ctx, course);
  const foot = single
    ? ''
    : `<footer class="cp-foot"><div class="cp-foot-in">
        ${item.prev ? `<a class="cp-btn is-ghost" href="${esc(hrefOf(ctx, course, item.prev))}">${icon('back')}Back</a>` : ''}
        <span class="cp-grow"></span>
        ${
          !ctx.preview && !progress.done && !review.status && !finishesItself(page.content)
            ? `<button class="cp-btn" data-action="contentPlayer.complete" data-on-success="navigate:${esc(hrefOf(ctx, course, '{{next}}'))}">Mark complete ${icon('check')}</button>`
            : ''
        }
        ${ctx.preview || progress.done ? `<a class="cp-btn${nextShut ? ' is-ghost' : ''}" href="${esc(nextHref)}">${nextShut ? 'Overview' : item.next ? 'Continue' : 'Finish'} ${icon('next')}</a>` : ''}
      </div></footer>`;
  // What this person already sent, so a form opens filled in (runtime/content-player-contract.ts fills it).
  const saved = opened?.answer ? `<script type="application/json" data-program-saved>${JSON.stringify(opened.answer).replace(/</g, '\\u003c')}</script>` : '';
  const main = `<div class="cp-page">
      ${page.type ? `<div class="cp-kicker">${typeIcon(page.type)}${esc(page.type)}${page.duration ? ` · ${esc(page.duration)}` : ''}</div>` : ''}
      <h1>${esc(page.title || item.title)}</h1>
      ${notes}
      <article class="cp-content">${withoutLeadingTitle(
        result?.locked
          ? String(page.content || '').replace(ANSWER_FORM, '')
          : // sent in for review, or approved: what was sent stays on show, but can't be sent again
            review.status === 'pending' || review.status === 'approved'
            ? readOnlyForms(page.content || '')
            : page.content || '',
        page.title,
      )}</article>
      ${result?.locked ? '' : saved}
    </div>${foot}`;
  return shell(view, ctx, item.id, single ? { href: '/', label: 'Home' } : { href: hrefOf(ctx, course), label: 'Overview' }, main);
}

/** Everything I am taking. */
export function playerMineHtml(rows: any[], ctx: PlayerContext) {
  const cards = (rows || [])
    .map((r) => {
      const course = String(r?.course?.slug || r?.course?.id || '');
      const pct = Number(r.percent) || 0;
      return `<li class="cp-card"><a href="${esc(hrefOf(ctx, course, r.next || undefined))}">
        ${r?.course?.coverImage ? `<img src="${esc(r.course.coverImage)}" alt="">` : ''}
        <div class="cp-card-in"><h3>${esc(r?.course?.title)}</h3>
        <div class="cp-progress"><span style="width:${pct}%"></span></div>
        <small>${pct}% · ${esc(r.status)}${r.dueAt ? ` · due ${esc(date(r.dueAt))}` : ''}</small></div>
      </a></li>`;
    })
    .join('');
  return `${STYLE}
<div class="cp" data-single>
  <div class="cp-page" style="max-width:1100px">
    <h1>${esc(ctx.mineTitle || 'My programs')}</h1>
    ${cards ? `<ul class="cp-cards">${cards}</ul>` : '<div class="cp-note">Nothing started yet.</div>'}
  </div>
</div>`;
}

/**
 * The author's preview from `content-studio/:post/preview` (staff only): the same
 * pages, every one open, nothing recorded. Items carry `opensWhen` — the
 * condition a learner would wait on — shown on hover in the outline.
 */
export function playerPreviewHtml(view: any, itemId: string, ctx: PlayerContext) {
  const items = (view?.items || []).map((i: any) => ({ ...i, ...(i.opensWhen ? { lockReason: `Learners: ${i.opensWhen}` } : {}) }));
  const shaped = { ...view, items };
  const current = items.find((i: any) => i.id === itemId);
  if (!current?.pageId) return playerOverviewHtml(shaped, { ...ctx, preview: true });
  const page = view?.pages?.[current.pageId] || {};
  return playerItemHtml(shaped, { item: { id: current.id, title: current.title, prev: current.prev, next: current.next }, page }, { ...ctx, preview: true });
}
