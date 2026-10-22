// from base-app/src/modules/reservation-system/booking.css.ts (themed: the .bk-root tokens point at the setup's tokens, appended at the end)
/**
 * The booking skin — the public booking page and every screen it leads to (choose, date and
 * time, details, pay, confirmed, manage, cancel, change, check-in, walk-in, queue).
 *
 * The same family as the invoice checkout (`ledger.css.ts`) and the paid receipt
 * (`settled.css.ts`): one scoped stylesheet under `.bk-root`, so it cannot reach the site
 * template around it. Two columns while booking — the step on the left, a tinted
 * "Your reservation" summary on the right — and one column for the screens that stand alone.
 */
export const BOOKING_CSS = `
.bk-root { --bk-ink:#182b2a; --bk-muted:#6b7774; --bk-line:#dfe7e3; --bk-accent:#176c57; --bk-accent-ink:#ffffff; --bk-wash:#edf4ef; --bk-danger:#a3362a; --bk-danger-wash:#fbefec;
  color:var(--bk-ink); background:#f6f7f4; min-height:100vh; min-height:100svh; padding:40px 0 64px; font-size:15px; line-height:1.55; }
.bk-root *, .bk-root *::before, .bk-root *::after { box-sizing:border-box; }
.bk-root button { font:inherit; cursor:pointer; }
.bk-root button:disabled { cursor:not-allowed; opacity:.45; }
.bk-root button:focus-visible, .bk-root a:focus-visible, .bk-root input:focus-visible, .bk-root select:focus-visible, .bk-root textarea:focus-visible { outline:3px solid #5dac95; outline-offset:2px; }
.bk-mono { font-family:'Courier New', monospace; letter-spacing:.02em; }

.bk-topbar { max-width:1120px; margin:-16px auto 28px; padding:0 24px; display:flex; justify-content:space-between; align-items:center; gap:20px; }
.bk-merchant { display:flex; align-items:center; gap:12px; font-size:15px; font-weight:600; letter-spacing:-.02em; }
.bk-merchant-mark { width:32px; height:32px; background:#173e31; color:#fff; display:grid; place-items:center; border-radius:9px; font-size:18px; text-transform:uppercase; }
.bk-merchant-logo { height:32px; width:auto; max-width:160px; object-fit:contain; display:block; }
.bk-topbar-label { font-size:12px; color:#7b8581; }
.bk-wrap { max-width:1120px; margin:0 auto; padding:0 24px; }
.bk-eyebrow { color:var(--bk-accent); font-size:11px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; margin:0; }
.bk-title { font-size:39px; line-height:1.12; letter-spacing:-.045em; font-weight:600; margin:12px 0 8px; }
.bk-sub { color:var(--bk-muted); margin:0; max-width:620px; }
.bk-h2 { font-size:22px; letter-spacing:-.02em; font-weight:600; margin:0 0 6px; }
.bk-h3 { font-size:16px; font-weight:600; margin:0 0 4px; }
.bk-small { font-size:12px; color:var(--bk-muted); }
.bk-root p { margin:6px 0; }

.bk-steps { display:flex; flex-wrap:wrap; gap:22px; margin:26px 0 28px; padding:0; list-style:none; }
.bk-step { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--bk-muted); background:none; border:0; padding:0; }
.bk-step[aria-current="step"] { color:var(--bk-accent); font-weight:700; }
.bk-step-num { width:24px; height:24px; display:grid; place-items:center; border-radius:50%; border:1px solid var(--bk-line); background:var(--surface, #fff); font-size:11px; }
.bk-step[aria-current="step"] .bk-step-num { background:var(--bk-accent); border-color:var(--bk-accent); color:#fff; }
.bk-step.bk-done .bk-step-num { background:var(--bk-wash); border-color:#cfe1d5; color:var(--bk-accent); }

.bk-layout { display:grid; grid-template-columns:minmax(0,1.12fr) minmax(300px,.8fr); border:1px solid #dfe5e1; border-radius:18px; overflow:hidden; box-shadow:0 18px 60px #16312406; background:var(--surface, #fff); }
.bk-layout > .bk-panel { border:0; border-radius:0; box-shadow:none; padding:42px 42px 34px; }
.bk-single { max-width:760px; }
/* A screen that stands alone (confirmed, manage, check-in…): the heading and its card centred together. */
.bk-wrap:has(> .bk-single) { max-width:808px; }
.bk-panel { background:var(--surface, #fff); border:1px solid var(--bk-line); border-radius:20px; padding:30px; box-shadow:0 8px 28px #263e2e06; min-width:0; }
.bk-summary { background:#f1f4ef; border-left:1px solid #e3e8e4; padding:42px 38px; }
.bk-summary-inner { position:sticky; top:24px; }
.bk-summary .bk-art { height:84px; background:#e6ebe5; border-radius:12px; margin-bottom:20px; display:flex; align-items:center; justify-content:center; color:var(--bk-accent); }
.bk-row { display:flex; justify-content:space-between; gap:14px; }
.bk-detail { padding:12px 0; border-bottom:1px solid #e1e6e1; font-size:13px; }
.bk-detail > span:first-child { color:var(--bk-muted); }
.bk-detail > strong { text-align:right; font-weight:600; }
.bk-price { font-size:26px; font-weight:700; letter-spacing:-.02em; }

.bk-choices { display:grid; gap:12px; margin-top:20px; }
.bk-choices.bk-cols { grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); }
.bk-choice { width:100%; border:1px solid var(--bk-line); background:var(--surface, #fff); border-radius:12px; padding:17px; text-align:left; color:var(--bk-ink); display:flex; align-items:center; gap:15px; transition:border-color .15s, background .15s; }
.bk-choice:hover { border-color:var(--bk-accent); background:#f7faf7; }
.bk-choice[aria-pressed="true"] { border-color:var(--bk-accent); box-shadow:inset 0 0 0 1px var(--bk-accent); background:#f1f7f2; }
.bk-choice-icon { flex-shrink:0; width:44px; height:44px; display:grid; place-items:center; border-radius:10px; background:var(--bk-wash); color:var(--bk-accent); overflow:hidden; }
.bk-choice-icon img { width:100%; height:100%; object-fit:cover; }
.bk-choice-copy { flex:1; min-width:0; }
.bk-choice-copy strong { display:block; font-weight:600; }
.bk-choice-copy .bk-small { display:block; margin-top:2px; }
.bk-choice-end { flex-shrink:0; color:var(--bk-accent); font-weight:600; text-align:right; }

.bk-footer { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-top:26px; padding-top:20px; border-top:1px solid var(--bk-line); }
.bk-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; border-radius:10px; padding:12px 20px; font-size:14px; font-weight:600; border:1px solid transparent; text-decoration:none; }
.bk-btn-primary { background:var(--bk-accent); color:var(--bk-accent-ink); }
.bk-btn-primary:hover:not(:disabled) { background:#125a48; }
.bk-btn-secondary { background:var(--surface, #fff); border-color:var(--bk-line); color:var(--bk-ink); }
.bk-btn-secondary:hover:not(:disabled) { background:#f6f8f5; }
.bk-btn-danger { background:var(--bk-danger); color:#fff; }
.bk-btn-block { width:100%; }
.bk-link { color:var(--bk-accent); background:none; border:0; padding:0; text-decoration:underline; text-underline-offset:3px; font-size:13px; }

.bk-calendar-layout { display:grid; grid-template-columns:1.05fr 1fr; gap:26px; margin-top:20px; }
.bk-cal-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.bk-cal-nav { display:flex; gap:6px; }
.bk-cal-nav button { width:32px; height:32px; border-radius:8px; border:1px solid var(--bk-line); background:var(--surface, #fff); color:var(--bk-ink); }
.bk-calendar { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; margin-top:14px; }
.bk-dow { font-size:10px; color:var(--bk-muted); text-align:center; padding:4px 0; }
.bk-day { border:0; background:none; border-radius:8px; padding:9px 0; text-align:center; font-size:13px; color:var(--bk-ink); position:relative; }
.bk-day:hover:not(:disabled) { background:var(--bk-wash); }
.bk-day[aria-pressed="true"], .bk-day[aria-pressed="true"]:hover:not(:disabled) { background:var(--bk-accent); color:#fff; }
.bk-day.bk-today { font-weight:700; }
.bk-day.bk-available::after { content:''; display:block; width:4px; height:4px; background:#539e70; border-radius:50%; margin:3px auto -7px; }
.bk-day[aria-pressed="true"].bk-available::after { background:var(--surface, #fff); }
.bk-day:disabled { color:#aab5ae; }
.bk-slots { display:grid; grid-template-columns:repeat(auto-fill,minmax(96px,1fr)); gap:9px; margin-top:15px; }
.bk-slot { background:var(--surface, #fff); border:1px solid var(--bk-line); border-radius:8px; padding:11px 3px; font-size:12px; line-height:1.2; color:var(--bk-ink); white-space:nowrap; }
.bk-slot:hover:not(:disabled) { border-color:var(--bk-accent); }
.bk-slot[aria-pressed="true"], .bk-slot[aria-pressed="true"]:hover:not(:disabled) { background:var(--bk-accent); color:#fff; border-color:var(--bk-accent); }
.bk-slot:disabled { text-decoration:line-through; }

.bk-field { display:block; margin:18px 0 0; }
.bk-field > span { display:block; font-size:12px; font-weight:700; margin-bottom:7px; }
.bk-field > span em { font-style:normal; font-weight:400; color:var(--bk-muted); }
.bk-input, .bk-root .bk-field input, .bk-root .bk-field select, .bk-root .bk-field textarea { width:100%; border:1px solid #d7e1da; border-radius:9px; padding:12px; color:var(--bk-ink); background:#fcfdfb; font:inherit; }
.bk-root .bk-field textarea { resize:vertical; min-height:90px; }
.bk-field-error { color:var(--bk-danger); font-size:12px; margin-top:5px; }
.bk-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 16px; }

.bk-policy { padding:16px; border-radius:10px; background:#f5f7f3; font-size:13px; margin-top:22px; color:var(--bk-muted); }
.bk-policy strong { color:var(--bk-ink); }
.bk-banner { display:flex; gap:10px; align-items:flex-start; padding:13px 15px; border-radius:10px; font-size:13px; margin:0 0 18px; }
.bk-banner-error { background:var(--bk-danger-wash); color:var(--bk-danger); border:1px solid #f0d3cd; }
.bk-banner-info { background:var(--bk-wash); color:#2c5446; border:1px solid #d3e4d9; }
.bk-banner button { margin-left:auto; background:none; border:0; color:inherit; font-size:16px; line-height:1; padding:0 2px; }

.bk-success { width:52px; height:52px; background:#ddf1e4; color:var(--bk-accent); border-radius:50%; display:grid; place-items:center; margin-bottom:18px; }
.bk-success.bk-warn { background:#fbefec; color:var(--bk-danger); }
.bk-ticket { margin:24px 0; border:1px solid var(--bk-line); border-radius:14px; overflow:hidden; }
.bk-ticket-head { padding:22px; background:var(--bk-wash); }
.bk-ticket-body { padding:18px 22px; }
.bk-ticket-body .bk-row { padding:7px 0; font-size:14px; }
.bk-ticket-body .bk-row > span:first-child { color:var(--bk-muted); }
.bk-actions { display:flex; gap:10px; flex-wrap:wrap; }
.bk-pill { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; background:var(--bk-wash); color:var(--bk-accent); }
.bk-pill-muted { background:#eef0ec; color:#5d6a62; }
.bk-pill-danger { background:var(--bk-danger-wash); color:var(--bk-danger); }
.bk-list { display:grid; gap:12px; }
.bk-card { border:1px solid var(--bk-line); border-radius:14px; padding:18px; background:var(--surface, #fff); }
.bk-loading { display:flex; align-items:center; justify-content:center; gap:10px; min-height:220px; color:var(--bk-muted); }
.bk-spinner { width:22px; height:22px; border:2px solid #cfe1d5; border-top-color:var(--bk-accent); border-radius:50%; animation:bk-spin .8s linear infinite; }
@keyframes bk-spin { to { transform:rotate(360deg); } }

@media (max-width:860px) {
  .bk-root { padding:24px 0 48px; }
  .bk-layout { grid-template-columns:1fr; }
  .bk-summary { order:-1; border-left:0; border-bottom:1px solid #e3e8e4; padding:26px 22px; }
  .bk-layout > .bk-panel { padding:26px 22px; }
  .bk-summary .bk-art { display:none; }
  .bk-calendar-layout { grid-template-columns:1fr; }
  .bk-panel { padding:22px; }
  .bk-title { font-size:31px; }
  .bk-form-grid { grid-template-columns:1fr; }
  .bk-steps { gap:12px; }
}
@media (max-width:420px) { .bk-wrap, .bk-topbar { padding:0 14px; } .bk-panel { padding:18px; } .bk-step { font-size:11px; } }
@media print {
  .bk-root { background:var(--surface, #fff); padding:0; }
  .bk-steps, .bk-footer, .bk-actions, .bk-summary .bk-art { display:none !important; }
  .bk-panel, .bk-summary { box-shadow:none; }
}

/* appmint-one: the setup's tokens */
.bk-root { --bk-ink:var(--text); --bk-muted:var(--muted); --bk-line:var(--border); --bk-accent:var(--primary); --bk-accent-ink:var(--primary-ink, #fff); --bk-wash:var(--primary-soft); font-family:var(--font-body, inherit); }
.bk-root .bk-title, .bk-root .bk-h2 { font-family:var(--font-display, inherit); }
`;
