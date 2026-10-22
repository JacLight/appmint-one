"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bookAction } from "../../actions/booking";

export interface ConfirmProps {
  typeId: string;
  startTime: string;
  host?: string;
  style: "studio" | "clinic" | "firm";
  signedIn: boolean;
  loginHref: string;
  signupHref: string;
  insurance?: string[];
  area?: string;
  cta: string;
  backHref?: string;
}

/** The last step: who/when is shown by the page; this is the button and, for the clinic
 *  and firm, the few questions that go on the booking. Signed in, it books on the account;
 *  otherwise as a guest with a name and email. The engine re-checks the time. */
export function BookConfirm(p: ConfirmProps) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [taken, setTaken] = useState(false);
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [insurance, setInsurance] = useState("");
  const [other, setOther] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const submit = () => start(async () => {
    setErr(null);
    const intake: Record<string, string> =
      p.style === "clinic" ? { reason, insurance } : p.style === "firm" ? { reason, area: p.area || "", opposingParty: other } : {};
    const r = await bookAction({ typeId: p.typeId, startTime: p.startTime, host: p.host, intake, guest: p.signedIn ? undefined : { name, email, phone } });
    if (r.ok) {
      if (r.guest) router.push(`/book/manage?email=${encodeURIComponent(r.guest.email)}&n=${encodeURIComponent(r.number)}&booked=1`);
      else router.push(`/account/scheduling/${r.id}?booked=1`);
      return;
    }
    if (r.taken) setTaken(true);
    if (r.signIn) { router.push(p.loginHref); return; }
    setErr(r.error);
  });

  return (
    <div className="bk-cta">
      {!p.signedIn && (
        <>
          <p className="bk-cta-note">Have an account? <Link href={p.loginHref}>Sign in</Link> and it lands in your bookings. Or book with your details:</p>
          <label className="bk-lbl" htmlFor="bk-name">Full name</label>
          <input id="bk-name" className="bk-in" autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          <label className="bk-lbl" htmlFor="bk-email">Email</label>
          <input id="bk-email" className="bk-in" type="email" autoComplete="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="bk-lbl" htmlFor="bk-phone">Mobile <span className="bk-opt">(optional, for a text reminder)</span></label>
          <input id="bk-phone" className="bk-in" type="tel" autoComplete="tel" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </>
      )}
      {p.style === "clinic" && (
        <>
          <label className="bk-lbl" htmlFor="bk-reason">What&rsquo;s the visit for?</label>
          <textarea id="bk-reason" className="bk-in" rows={3} maxLength={600} placeholder="A few words for your clinician" value={reason} onChange={(e) => setReason(e.target.value)} />
          {p.insurance?.length ? (
            <>
              <label className="bk-lbl" htmlFor="bk-ins">Insurance</label>
              <select id="bk-ins" className="bk-in" value={insurance} onChange={(e) => setInsurance(e.target.value)}>
                <option value="">Choose your plan</option>
                {p.insurance.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </>
          ) : null}
        </>
      )}
      {p.style === "firm" && (
        <>
          <label className="bk-lbl" htmlFor="bk-reason">What do you need help with?</label>
          <textarea id="bk-reason" className="bk-in" rows={4} maxLength={1500} placeholder="A short summary: what happened, and what you’d like to achieve" value={reason} onChange={(e) => setReason(e.target.value)} />
          <label className="bk-lbl" htmlFor="bk-other">Other people or companies involved</label>
          <input id="bk-other" className="bk-in" maxLength={300} placeholder="For our conflict check" value={other} onChange={(e) => setOther(e.target.value)} />
          <p className="bk-fine">Booking a consultation doesn&rsquo;t create an attorney&ndash;client relationship. Everything you send is kept confidential.</p>
        </>
      )}
      {err && <div className="bk-err" role="alert">{err}{taken && <> <Link href={p.backHref || "?"}>Pick another time</Link></>}</div>}
      <button type="button" className="btn clay lg bk-wide" disabled={pending} onClick={submit}>{pending ? "Booking…" : p.cta}</button>
      {!p.signedIn && <p className="bk-fine">We&rsquo;ll email you the confirmation and your booking number. <Link href={p.signupHref}>Create an account</Link> to keep every booking in one place.</p>}
    </div>
  );
}
