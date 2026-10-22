// from base-app/src/components/storefront/order-receipt.css.ts — ported verbatim; only import paths rewired.
/**
 * Order confirmation.
 *
 * One card on a tinted page: a header that states the outcome, a progress rail,
 * then items and delivery on the left with the payment summary on its own
 * panel to the right. Everything is said once — the billing address reads
 * "same as shipping" rather than repeating it, and the gateway is named in the
 * summary rather than beside every figure.
 *
 * It carries its own surface and text colours, so it reads the same whatever
 * background the site template puts behind it.
 */
export const ORDER_RECEIPT_CSS = `
.or-root { --or-ink:#101418; --or-muted:#6b7280; --or-line:#e8eaee; --or-panel:#f7f8fa; --or-green:#16803c;
  background:#eef1f5; color:var(--or-ink); padding:28px 20px 44px; min-height:100vh; }
.or-sent-note { margin:0; padding:22px 36px 26px; font-size:14px; color:var(--or-muted); }
.or-root *, .or-root *::before, .or-root *::after { box-sizing:border-box; }
.or-shell { max-width:1160px; margin:0 auto; }

.or-topbar { display:flex; justify-content:flex-end; align-items:center; gap:20px; padding:0 4px 18px; }
.or-toplink { display:inline-flex; align-items:center; gap:8px; font-size:14px; color:var(--or-ink); background:none; border:0; cursor:pointer; }
.or-toplink:hover { opacity:.7; }

.or-card { background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 1px 2px #10141808, 0 12px 34px #1014180f; }

/* ── header ───────────────────────────────────────────────────────────── */
.or-head { display:flex; gap:20px; align-items:flex-start; padding:34px 36px 0; }
.or-tick { width:46px; height:46px; border-radius:50%; background:#1a7f3c; color:#fff; display:grid; place-items:center; flex-shrink:0; }
.or-head h1 { font-size:30px; font-weight:700; letter-spacing:-.02em; margin:0 0 6px; }
.or-head p { font-size:15px; color:#4b5563; margin:0 0 14px; }
.or-meta { display:flex; flex-wrap:wrap; align-items:center; gap:10px; font-size:13px; color:var(--or-muted); }
.or-dot { color:#c3c7cf; }
.or-pill { display:inline-flex; align-items:center; border-radius:999px; padding:4px 11px; font-size:12px; font-weight:500; background:#e7f6ec; color:var(--or-green); }
.or-download { margin-left:auto; display:inline-flex; align-items:center; gap:9px; border:1px solid #d7dae1; border-radius:10px; background:#fff;
  padding:13px 20px; font-size:14px; font-weight:500; color:var(--or-ink); cursor:pointer; white-space:nowrap; flex-shrink:0; }
.or-download:hover { background:#f7f8fa; }

/* ── progress rail ────────────────────────────────────────────────────── */
.or-rail { display:flex; align-items:flex-start; gap:0; padding:26px 36px 28px; }
.or-step { display:flex; align-items:flex-start; gap:12px; flex-shrink:0; }
.or-step-dot { width:30px; height:30px; border-radius:50%; display:grid; place-items:center; background:#d5d8de; color:#fff; flex-shrink:0; }
.or-step.is-done .or-step-dot { background:#1a7f3c; }
.or-step strong { display:block; font-size:14px; font-weight:600; }
.or-step span { display:block; font-size:13px; color:var(--or-muted); margin-top:2px; }
.or-rail-line { flex:1; height:1px; background:var(--or-line); margin:15px 18px 0; min-width:24px; }

/* ── body ─────────────────────────────────────────────────────────────── */
.or-body { display:grid; grid-template-columns:minmax(0,1fr) 420px; border-top:1px solid var(--or-line); }
.or-main { padding:28px 36px 32px; min-width:0; }
.or-aside { background:var(--or-panel); border-left:1px solid var(--or-line); padding:28px 32px 32px; display:flex; flex-direction:column; }

.or-title { display:flex; align-items:center; gap:12px; font-size:19px; font-weight:700; letter-spacing:-.01em; margin:0 0 6px; }
.or-count { font-size:12px; font-weight:500; color:#4b5563; background:#eef0f4; border-radius:999px; padding:5px 12px; }

.or-line { display:flex; align-items:center; gap:16px; padding:14px 0; border-bottom:1px solid #f0f1f4; }
.or-thumb { width:64px; height:64px; border-radius:10px; object-fit:cover; background:#f1f2f5; flex-shrink:0; }
.or-line-copy { flex:1; min-width:0; }
.or-line-copy strong { display:block; font-size:14px; font-weight:500; }
.or-line-copy span { display:block; font-size:13px; color:var(--or-muted); margin-top:3px; }
.or-line-amt { font-size:15px; font-weight:600; white-space:nowrap; font-variant-numeric:tabular-nums; }

.or-delivery { margin-top:30px; padding-top:26px; border-top:1px solid var(--or-line); }
.or-delivery h2 { font-size:19px; font-weight:700; letter-spacing:-.01em; margin:0 0 16px; }
.or-addresses { display:grid; grid-template-columns:1fr 1fr; gap:28px; }
.or-addresses > * + * { border-left:1px solid var(--or-line); padding-left:28px; }
.or-addresses h3 { font-size:14px; font-weight:600; margin:0 0 8px; }
.or-addresses p { font-size:14px; color:var(--or-muted); line-height:1.65; margin:0; }

/* ── summary ──────────────────────────────────────────────────────────── */
.or-aside h2 { font-size:19px; font-weight:700; letter-spacing:-.01em; margin:0 0 20px; }
.or-sum { display:flex; justify-content:space-between; gap:18px; font-size:14px; padding:7px 0; font-variant-numeric:tabular-nums; }
.or-sum dt { color:#4b5563; }
.or-sum dd { margin:0; font-weight:500; }
.or-strike { color:#9aa0ab; text-decoration:line-through; margin-right:10px; font-weight:400; }
.or-free { color:var(--or-green); font-weight:600; }
.or-note-free { font-size:13px; color:var(--or-green); margin:2px 0 0; }
.or-rule { border-top:1px solid #e3e5ea; margin:18px 0; }
.or-grand { display:flex; justify-content:space-between; align-items:baseline; gap:18px; }
.or-grand dt { font-size:18px; font-weight:700; }
.or-grand dd { margin:0; font-size:28px; font-weight:700; letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
.or-grand dd small { font-size:13px; font-weight:500; color:var(--or-muted); margin-left:7px; }
.or-kv { display:flex; justify-content:space-between; align-items:center; gap:18px; font-size:14px; color:#4b5563; padding:5px 0; }
.or-kv svg { height:20px; width:auto; }
.or-cta { margin-top:auto; padding-top:26px; }
.or-cta button { width:100%; display:inline-flex; align-items:center; justify-content:center; gap:10px; border:0; border-radius:10px;
  background:#0d1117; color:#fff; font-size:15px; font-weight:500; padding:17px 20px; cursor:pointer; transition:background .18s; }
.or-cta button:hover { background:#232a33; }

/* ── foot ─────────────────────────────────────────────────────────────── */
.or-foot { display:flex; justify-content:space-between; align-items:center; gap:20px; border-top:1px solid var(--or-line); padding:22px 36px; }
.or-foot strong { display:block; font-size:14px; font-weight:600; }
.or-foot span { display:block; font-size:13px; color:var(--or-muted); margin-top:2px; }
.or-foot button { display:inline-flex; align-items:center; gap:8px; background:none; border:0; font-size:14px; color:var(--or-ink); cursor:pointer; }
.or-foot button:hover { opacity:.7; }

/* ── states ───────────────────────────────────────────────────────────── */
.or-state { padding:56px 36px; text-align:center; }
.or-state-tick { width:46px; height:46px; border-radius:50%; display:grid; place-items:center; margin:0 auto 18px; background:#fdf6ea; color:#b8791f; }
.or-state h1 { font-size:22px; font-weight:600; margin:0 0 8px; }
.or-state p { font-size:14px; color:var(--or-muted); margin:0 auto 22px; max-width:420px; line-height:1.7; }
.or-skeleton { background:#eef0f4; border-radius:8px; animation:or-pulse 1.4s ease-in-out infinite; }
@keyframes or-pulse { 0%,100% { opacity:1; } 50% { opacity:.55; } }

@media (max-width:980px) {
  .or-body { grid-template-columns:1fr; }
  .or-aside { border-left:0; border-top:1px solid var(--or-line); }
  .or-rail { flex-direction:column; gap:18px; }
  .or-rail-line { display:none; }
}
@media (max-width:640px) {
  .or-head { flex-wrap:wrap; padding:26px 22px 0; }
  .or-download { margin-left:0; width:100%; justify-content:center; }
  .or-rail, .or-main, .or-foot { padding-left:22px; padding-right:22px; }
  .or-aside { padding:24px 22px 28px; }
  .or-head h1 { font-size:25px; }
  .or-addresses { grid-template-columns:1fr; gap:18px; }
  .or-addresses > * + * { border-left:0; padding-left:0; border-top:1px solid var(--or-line); padding-top:18px; }
}
@media print {
  .or-root { background:#fff; padding:0; }
  .or-topbar, .or-download, .or-cta, .or-foot button { display:none !important; }
  .or-card { box-shadow:none; border:1px solid #ccc; }
}
`;
