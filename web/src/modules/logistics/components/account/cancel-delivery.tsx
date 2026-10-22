"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelAction } from "@/modules/logistics/actions/customer";

/** Cancel while the engine allows it, with the refund the engine's rules give. */
export function CancelDelivery({ jobId, jobWord, refundPercent, paid }: { jobId: string; jobWord: string; refundPercent: number; paid: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const refund = !paid ? "You haven’t been charged." : refundPercent >= 100 ? "You’ll get a full refund." : `You’ll get ${refundPercent}% back.`;

  if (!open) return <button type="button" className="mv-btn ghost" onClick={() => setOpen(true)}>Cancel {jobWord.toLowerCase()}</button>;
  return (
    <div className="mv-cancel">
      <b>Cancel this {jobWord.toLowerCase()}?</b>
      <span>{refund}</span>
      <input className="mv-input" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      {err && <div className="mv-err">{err}</div>}
      <div className="mv-cancel-acts">
        <button type="button" className="mv-btn" disabled={pending} onClick={() => start(async () => {
          const r = await cancelAction(jobId, reason);
          if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error);
        })}>{pending ? "Cancelling…" : "Yes, cancel"}</button>
        <button type="button" className="mv-btn ghost" onClick={() => setOpen(false)} disabled={pending}>Keep it</button>
      </div>
    </div>
  );
}
