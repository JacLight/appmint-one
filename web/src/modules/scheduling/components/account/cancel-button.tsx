"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelAction } from "../../actions/booking";

/** Cancel with a confirm step. Signed in it names the booking by id; a guest by the email
 *  and number on it. */
export function CancelButton({ who, note, label = "Cancel" }: { who: { id: string } | { email: string; number: string }; note: string; label?: string }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (msg) return <p className="ac-done" role="status">{msg}</p>;
  if (!ask) return <button type="button" className="btn ghost sm" onClick={() => setAsk(true)}>{label}</button>;
  return (
    <div className="ac-confirm">
      <p>{note}</p>
      {err && <p className="bk-err">{err}</p>}
      <div className="ac-confirm-a">
        <button type="button" className="btn sm ac-danger" disabled={pending} onClick={() => start(async () => {
          setErr(null);
          const r = await cancelAction(who);
          if (!r.ok) { setErr(r.error); return; }
          setMsg("Cancelled.");
          router.replace("id" in who ? `/account/scheduling/${who.id}?cancelled=1` : `/book/manage?email=${encodeURIComponent(who.email)}&n=${encodeURIComponent(who.number)}&cancelled=1`);
          router.refresh();
        })}>{pending ? "Cancelling…" : "Yes, cancel it"}</button>
        <button type="button" className="btn ghost sm" onClick={() => setAsk(false)}>Keep it</button>
      </div>
    </div>
  );
}
