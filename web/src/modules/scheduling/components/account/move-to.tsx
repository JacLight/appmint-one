"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rescheduleAction } from "../../actions/booking";

/** Confirm a move to the time the page picked. The engine re-checks the time. */
export function MoveTo({ who, startTime, label, done }: { who: { id: string } | { email: string; number: string }; startTime: string; label: string; done: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="bk-cta">
      {err && <p className="bk-err">{err}</p>}
      <button type="button" className="btn clay lg bk-wide" disabled={pending} onClick={() => start(async () => {
        setErr(null);
        const r = await rescheduleAction({ ...who, startTime });
        if (!r.ok) { setErr(r.error); return; }
        router.push(done);
        router.refresh();
      })}>{pending ? "Moving…" : label}</button>
    </div>
  );
}
