"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitIntakeAction } from "../../actions/booking";

export interface Field { name: string; title: string; type: "text" | "email" | "date" | "textarea" | "select" | "checkbox"; options?: string[]; required?: boolean }

/** The booking type's intake form, rendered from the form's own schema. */
export function IntakeForm({ bookingId, form, fields, initial }: { bookingId: string; form: string; fields: Field[]; initial: Record<string, any> }) {
  const router = useRouter();
  const [v, setV] = useState<Record<string, any>>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: string, x: any) => setV((o) => ({ ...o, [k]: x }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const missing = fields.filter((f) => f.required && f.type !== "checkbox" && !String(v[f.name] ?? "").trim());
    if (missing.length) { setErr(`Please fill in: ${missing.map((f) => f.title).join(", ")}.`); return; }
    start(async () => {
      setErr(null);
      const r = await submitIntakeAction(bookingId, form, v);
      if (!r.ok) { setErr(r.error); return; }
      router.push(`/account/scheduling/${bookingId}?sent=1`);
      router.refresh();
    });
  };
  return (
    <form className="if" onSubmit={submit} noValidate>
      {fields.map((f) => (
        <div key={f.name} className={`if-f ${f.type === "textarea" ? "wide" : ""} ${f.type === "checkbox" ? "check wide" : ""}`}>
          {f.type === "checkbox" ? (
            <label><input type="checkbox" checked={!!v[f.name]} onChange={(e) => set(f.name, e.target.checked)} /> <span>{f.title}</span></label>
          ) : (
            <>
              <label className="bk-lbl" htmlFor={`if-${f.name}`}>{f.title}{f.required ? " *" : ""}</label>
              {f.type === "textarea" ? <textarea id={`if-${f.name}`} className="bk-in" rows={4} value={v[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} />
                : f.type === "select" ? (
                  <select id={`if-${f.name}`} className="bk-in" value={v[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)}>
                    <option value="">Choose…</option>
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : <input id={`if-${f.name}`} className="bk-in" type={f.type} value={v[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} readOnly={f.type === "email"} />}
            </>
          )}
        </div>
      ))}
      {err && <p className="bk-err wide">{err}</p>}
      <div className="wide"><button type="submit" className="btn clay lg" disabled={pending}>{pending ? "Sending…" : "Send"}</button></div>
    </form>
  );
}
