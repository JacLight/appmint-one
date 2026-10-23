"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { bankSecurityReviewAction, bankSecurityVerifyAction } from "../actions/banking";
import { StepUpDialog } from "./step-up";
import type { StepUpChallenge } from "../api/types";
type Confirm = (operation: string, request: Record<string, unknown>, previewId?: string) => Promise<string | undefined>;
const Context = createContext<{ confirm: Confirm; keyFor: (intent: string) => Promise<string> } | null>(null);
async function digest(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), b => b.toString(16).padStart(2, "0")).join(""); }
export function BankVerificationProvider({ scope, children }: { scope: string; children: React.ReactNode }) {
  const [pending, setPending] = useState<{ challenge: StepUpChallenge; body: string; storageKey: string; resolve: (proof: string) => void; reject: (error: Error) => void } | null>(null);
  const active = useRef(false), generation = useRef(scope);
  generation.current = scope;
  useEffect(() => () => { generation.current = "closed"; }, []);
  const keyFor = async (intent: string) => {
    const key = `banking-intent:${await digest(JSON.stringify([scope, intent]))}`;
    const value = sessionStorage.getItem(key) || crypto.randomUUID();
    sessionStorage.setItem(key, value); // Failure prevents an unrecoverable money instruction.
    return value;
  };
  const confirm: Confirm = async (operation, request, previewId) => {
    if (active.current) throw new Error("Finish the current confirmation first.");
    active.current = true;
    const started = scope;
    try {
      const storageKey = `banking-proof:${await digest(JSON.stringify([scope, operation, request.idempotencyKey, previewId || null]))}`;
      const existing = sessionStorage.getItem(storageKey);
      const review = await bankSecurityReviewAction(operation, { ...request, ...(existing ? { bankingProof: existing } : {}) }, previewId);
      if (generation.current !== started) throw new Error("Your session changed. Start again.");
      if (!review.ok) throw new Error(review.error);
      if (!review.data.required) return undefined;
      if (review.data.proof) return review.data.proof;
      return await new Promise<string>((resolve, reject) => setPending({ storageKey, resolve, reject, body: [review.data.summary?.amount != null ? `${review.data.summary.currency || "USD"} ${(review.data.summary.amount / 100).toFixed(2)}` : "", review.data.summary?.source, review.data.summary?.destination, review.data.summary?.startsOn ? `Starts ${review.data.summary.startsOn}` : ""].filter(Boolean).join(" · "), challenge: { ...review.data, method: "totp", length: 6 } }));
    } finally { active.current = false; }
  };
  return <Context.Provider value={{ confirm, keyFor }}>{children}{pending && <StepUpDialog action="transfer" initialChallenge={pending.challenge} title="Confirm your banking instruction" body={pending.body || "Use the authenticator approved by your bank."} onCancel={() => { pending.reject(new Error("Confirmation cancelled. No new instruction was sent.")); setPending(null); }} onConfirm={async ({ code }) => {
    const result = await bankSecurityVerifyAction(pending.challenge.challengeId, code);
    if (!result.ok) return result;
    if (generation.current !== scope) return { ok: false, error: "Your session changed.", code: "UNAUTHENTICATED" };
    try { sessionStorage.setItem(pending.storageKey, result.data.proof); }
    catch { return { ok: false, error: "Confirmation could not be saved. No money instruction was sent.", code: "UNAVAILABLE" }; }
    pending.resolve(result.data.proof); setPending(null); return { ok: true, data: null };
  }} />}</Context.Provider>;
}
export function useBankVerification() {
  const context = useContext(Context);
  if (!context) throw new Error("Banking confirmation is unavailable.");
  return context;
}
