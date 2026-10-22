"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reportIssueAction } from "@/modules/logistics/actions/customer";

const TYPES = [
  { id: "damaged", label: "Damaged" },
  { id: "missing_item", label: "Something’s missing" },
  { id: "not_received", label: "Didn’t arrive" },
  { id: "wrong_address", label: "Wrong place" },
  { id: "late", label: "Very late" },
  { id: "other", label: "Something else" },
];

export function ReportIssue({ jobId, issues }: { jobId: string; issues: { id: string; type: string; status?: string; reportedAt?: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const label = (t: string) => TYPES.find((x) => x.id === t)?.label || t.replace(/_/g, " ");

  return (
    <div className="lg-dialog">
      {issues.length > 0 && (
        <ul className="lg-act">
          {issues.map((i) => <li key={i.id}><i aria-hidden /><span>{label(i.type)} · {i.status === "resolved" ? "Resolved" : "We’re on it"}</span><time /></li>)}
        </ul>
      )}
      {sent && <div className="lg-ok">Got it. We’ll look into it and reply in your messages.</div>}
      {!open ? (
        <button type="button" className="mv-btn ghost" onClick={() => { setOpen(true); setSent(false); }}>Report a problem</button>
      ) : (
        <>
          <div className="lg-chiprow">
            {TYPES.map((t) => <button key={t.id} type="button" className="lg-chip" aria-pressed={type === t.id} onClick={() => setType(t.id)}>{t.label}</button>)}
          </div>
          <textarea className="mv-input" placeholder="What happened?" value={desc} onChange={(e) => setDesc(e.target.value)} />
          {err && <div className="lg-err">{err}</div>}
          <div className="mv-cancel-acts">
            <button type="button" className="mv-btn" disabled={pending || !type} onClick={() => start(async () => {
              const r = await reportIssueAction(jobId, type, desc);
              if (r.ok) { setOpen(false); setType(""); setDesc(""); setSent(true); router.refresh(); } else setErr(r.error);
            })}>{pending ? "Sending…" : "Send report"}</button>
            <button type="button" className="mv-btn ghost" onClick={() => setOpen(false)} disabled={pending}>Close</button>
          </div>
        </>
      )}
    </div>
  );
}
