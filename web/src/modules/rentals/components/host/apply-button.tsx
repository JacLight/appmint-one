"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyHostAction } from "@/modules/rentals/actions/host";
import { Alert } from "@/components/alert";

export function ApplyHostButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      {error && <div style={{ maxWidth: 460, margin: "0 auto 14px" }}><Alert kind="error" onDismiss={() => setError(null)}>{error}</Alert></div>}
      <button
        className="btn lime lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await applyHostAction();
            if (!r.ok) { setError(r.error); return; }
            // Success: refresh so /host re-renders into the approved dashboard or the
            // "pending review" panel — the page itself is the feedback, no popup.
            router.refresh();
          })
        }
      >
        {pending ? "Submitting…" : "Apply to host — it's free"}
      </button>
    </div>
  );
}
