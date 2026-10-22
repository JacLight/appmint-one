"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rateAction } from "@/modules/logistics/actions/customer";
import { Icon } from "@/modules/logistics/components/shared/icons";

export function RateDelivery({ jobId, providerWord, rated }: { jobId: string; providerWord: string; rated?: { value: number; comment?: string } }) {
  const router = useRouter();
  const [stars, setStars] = useState(rated?.value ?? 0);
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (rated) {
    return (
      <div>
        <div className="lg-stars" aria-label={`Rated ${rated.value} of 5`}>
          {[1, 2, 3, 4, 5].map((n) => <span key={n} className="lg-star" aria-pressed={n <= rated.value}><Icon name="star" /></span>)}
        </div>
        {rated.comment ? <p className="lg-sub" style={{ marginTop: 10 }}>“{rated.comment}”</p> : <p className="lg-sub" style={{ marginTop: 10 }}>Thanks for rating.</p>}
      </div>
    );
  }
  return (
    <div className="lg-dialog">
      <div className="lg-stars" role="radiogroup" aria-label={`Rate your ${providerWord.toLowerCase()}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className="lg-star" aria-pressed={n <= stars} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setStars(n)}><Icon name="star" /></button>
        ))}
      </div>
      {stars > 0 && <textarea className="mv-input" placeholder="Anything to add? (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />}
      {err && <div className="lg-err">{err}</div>}
      {stars > 0 && (
        <button type="button" className="mv-btn" disabled={pending} onClick={() => start(async () => {
          const r = await rateAction(jobId, stars, comment);
          if (r.ok) router.refresh(); else setErr(r.error);
        })}>{pending ? "Saving…" : "Submit rating"}</button>
      )}
    </div>
  );
}
