"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { messageAction } from "@/modules/logistics/actions/customer";

/** Start or continue a conversation about a job — sent through the app's shared
 *  messages, then opens that thread. */
export function MessageBox({ to, toName, jobId, jobNumber, label, threadBase = "/account/messages", placeholder }: { to: string; toName: string; jobId: string; jobNumber?: string; label: string; threadBase?: string; placeholder?: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="lg-dialog" onSubmit={(e) => {
      e.preventDefault();
      setErr(null);
      start(async () => {
        const r = await messageAction(to, text, { jobId, jobNumber, label });
        if (r.ok) router.push(`${threadBase}/${encodeURIComponent(r.thread)}`);
        else setErr(r.error);
      });
    }}>
      <textarea className="lg-input" style={{ minHeight: 64 }} placeholder={placeholder || `Message ${toName}`} value={text} onChange={(e) => setText(e.target.value)} />
      {err && <div className="lg-err">{err}</div>}
      <button type="submit" className="btn ink sm" disabled={pending || !text.trim()}>{pending ? "Sending…" : "Send"}</button>
    </form>
  );
}
