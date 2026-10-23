"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startStepUpAction, type Result } from "../actions/banking";
import type { StepUpAction, StepUpChallenge, StepUpProof } from "../api/types";
import { Icon } from "./icons";

/**
 * "Confirm it's you" — the security code step before money moves or sensitive data
 * shows. The UI asks; the bank's API is what actually enforces it.
 */
export function StepUpDialog({
  action, title, body, initialChallenge, confirmLabel = "Confirm", sample, onCancel, onConfirm,
}: {
  action: StepUpAction;
  initialChallenge?: StepUpChallenge;
  title: string;
  body?: string;
  confirmLabel?: string;
  sample?: boolean;
  onCancel: () => void;
  /** Called with the proof. Return the action's result: step-up errors stay in the dialog. */
  onConfirm: (proof: StepUpProof) => Promise<Result<unknown>>;
}) {
  const [challenge, setChallenge] = useState<StepUpChallenge | null>(null);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(30);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const start = useCallback(async () => {
    setErr(null);
    if (initialChallenge) { setChallenge(initialChallenge); return; }
    setChallenge(null);
    const r = await startStepUpAction(action);
    if (r.ok) { setChallenge(r.data); setWait(30); setTimeout(() => inputs.current[0]?.focus(), 30); }
    else setErr(r.error);
  }, [action, initialChallenge]);

  useEffect(() => { start(); }, [start]);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const submit = async (code: string) => {
    if (!challenge || busy) return;
    setBusy(true);
    setErr(null);
    const r = await onConfirm({ challengeId: challenge.challengeId, code });
    setBusy(false);
    if (r.ok) return;
    if (r.code === "STEP_UP_EXPIRED") { await start(); setErr(r.error); }
    else if (r.code === "STEP_UP_INVALID" || r.code === "STEP_UP_REQUIRED") setErr(r.error);
    else { onCancel(); return; }
    setDigits(["", "", "", "", "", ""]);
    setTimeout(() => inputs.current[0]?.focus(), 30);
  };

  const set = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      // Pasted the whole code.
      const next = clean.slice(0, 6).split("");
      while (next.length < 6) next.push("");
      setDigits(next);
      inputs.current[Math.min(5, clean.length)]?.focus();
      if (clean.length >= 6) submit(clean.slice(0, 6));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) inputs.current[i + 1]?.focus();
    if (next.every((d) => d)) submit(next.join(""));
  };

  return (
    <div className="mn-dialog-bg" role="presentation" onClick={() => !busy && onCancel()}>
      <div className="mn-dialog" role="dialog" aria-modal="true" aria-labelledby="mn-su-t" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="mn-x" aria-label="Cancel" onClick={onCancel} disabled={busy}><Icon name="x" size={16} /></button>
        <span className="mn-dialog-ic"><Icon name="shieldOk" size={24} /></span>
        <h2 id="mn-su-t">{title}</h2>
        <p>
          {body ? `${body} ` : ""}
          {challenge ? <>{challenge.method === "totp" ? "Enter the 6-digit code from " : "Enter the 6-digit code we sent to "}<b style={{ color: "var(--text)" }}>{challenge.destination}</b>.</> : "Preparing verification…"}
        </p>
        {sample && <div className="mn-otp-hint">Sample mode: no text is sent. Enter any 6 digits.</div>}
        <form onSubmit={(e) => { e.preventDefault(); if (digits.every((d) => d)) submit(digits.join("")); }}>
          <div className="mn-otp">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                value={d}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`Digit ${i + 1}`}
                maxLength={6}
                disabled={!challenge || busy}
                onChange={(e) => set(i, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus(); }}
              />
            ))}
          </div>
          {err && <div className="mn-formerr" role="alert"><Icon name="alert" size={16} />{err}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 6 }}>
            <button hidden={challenge?.method === "totp"} type="button" className="mn-resend" disabled={wait > 0 || busy} onClick={start}>
              {challenge?.method === "totp" ? <span>Use the current code in your authenticator app.</span> : wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
            </button>
            <button type="submit" className="btn clay sm" disabled={busy || !digits.every((d) => d)}>{busy ? "Checking…" : confirmLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
