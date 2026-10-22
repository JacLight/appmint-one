"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { messageHostAction, reviewAction } from "./actions";
import { I } from "./icons";


export function ReviewForm({ listingId, bookingId, hostFirst }: { listingId: string; bookingId: string; hostFirst: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (done) return <p className="mk-ok">Thanks — your review is live on the listing.</p>;
  return (
    <div className="mk-form">
      <div className="mk-stars-in" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} className={n <= rating ? "on" : ""} onClick={() => setRating(n)}>{I.star}</button>
        ))}
      </div>
      <label>Headline <input className="mk-in" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Sum it up in a few words" /></label>
      <label>Your review <textarea className="mk-ta" value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} placeholder={`What was great? What should the next guest know? ${hostFirst} sees this too.`} /></label>
      {err && <p className="mk-err">{err}</p>}
      <div><button type="button" className="mk-btn" disabled={busy} onClick={async () => {
        setBusy(true); setErr(null);
        const r = await reviewAction(listingId, { rating, title, message }, bookingId);
        setBusy(false);
        if (!r.ok) { setErr(r.error || "Could not post."); return; }
        setDone(true); router.refresh();
      }}>{busy ? "Posting…" : "Post review"}</button></div>
    </div>
  );
}

/** Quick message to the host from the trip page; the full thread lives in Messages. */
export function MessageHost({ bookingId, hostFirst, threadHref }: { bookingId: string; hostFirst: string; threadHref?: string | null }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mk-form" style={{ gap: 10 }}>
      <textarea className="mk-ta" style={{ minHeight: 90 }} value={text} onChange={(e) => { setText(e.target.value); if (state === "sent") setState("idle"); }} placeholder={`Message ${hostFirst}…`} />
      {err && <p className="mk-err">{err}</p>}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="mk-btn" disabled={!text.trim() || state === "busy"} onClick={async () => {
          setState("busy"); setErr(null);
          const r = await messageHostAction(bookingId, text.trim());
          if (!r.ok) { setErr(r.error || "Not sent."); setState("idle"); return; }
          setText(""); setState("sent");
        }}>{state === "busy" ? "Sending…" : "Send"}</button>
        {state === "sent" && <span className="mk-muted" style={{ fontSize: 14 }}>Sent. {threadHref ? <a className="mk-link" href={threadHref}>Open the conversation</a> : null}</span>}
        {state !== "sent" && threadHref && <a className="mk-link" href={threadHref}>See all messages</a>}
      </div>
    </div>
  );
}
