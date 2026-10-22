import { SiteHeader } from "@/components/site-header";
import { EmptyState } from "@/components/empty-state";
import { pickupPassAction } from "@/modules/rentals/actions/pickup";
import type { PickupPass, PickupReceipt } from "@/api/rentals";
import { routes } from "@/lib/nav";

export const metadata = { title: "Pickup pass" };
export const dynamic = "force-dynamic";

/** The collector's side of a delegated pickup.
 *
 *  Someone stored something and handed its pickup to the person holding this link.
 *  No sign-in: the link IS the pass. It shows the QR to present at the counter, where
 *  to go and until when, and what to bring. After collection it turns into the receipt. */
export default async function PickupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const token = sp.t || sp.token;

  if (!token) {
    return (
      <>
        <SiteHeader />
        <main className="pay-wrap">
          <EmptyState title="No pass here" note="This pickup link is missing its pass. Open the link from the text message or email you were sent." ctaLabel="Go home" ctaHref="/" />
        </main>
      </>
    );
  }

  const res = await pickupPassAction(token);
  if (!res.ok) {
    const missing = /not valid|not found|404/i.test(res.error);
    return (
      <>
        <SiteHeader />
        <main className="pay-wrap">
          <EmptyState
            title={missing ? "This pass isn’t valid" : "We couldn’t open that pass"}
            note={missing ? "It may have been revoked or replaced with a new one. Ask whoever sent it for a fresh link." : res.error}
            ctaLabel="Go home"
            ctaHref="/"
          />
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="pay-wrap">
        {res.pass.state === "completed" && res.receipt ? <Receipt r={res.receipt} /> : <Pass p={res.pass} />}
        <GetStowbo collected={res.pass.state === "completed"} />
      </main>
    </>
  );
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null);

/** A QR for the code, rendered without shipping a QR library (same as the pay QR). */
function Qr({ data }: { data: string }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(data)}`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="pk-qr" src={src} alt="Show this QR at the counter" width={260} height={260} />;
}

function Pass({ p }: { p: PickupPass }) {
  // Named things by name; unnamed ones by count, so the heading never reads "item".
  const named = p.items.map((i) => i.label || i.identifier || (i.unit ? `Bay ${i.unit}` : "")).filter(Boolean);
  const what = named.length === p.items.length && named.length ? named.join(", ") : `${p.items.length} item${p.items.length === 1 ? "" : "s"} at ${p.place.title}`;
  if (p.state !== "active") {
    return (
      <div className="pay-card pay-done">
        <p className="eyebrow">Pickup pass</p>
        <h1>{p.state === "revoked" ? "This pass was revoked" : p.state === "expired" ? "This pass has expired" : "Already collected"}</h1>
        <p className="pay-lead">
          {p.state === "revoked" && "The sender revoked it, so it is no longer valid. If you were expecting something, please contact them."}
          {p.state === "expired" && `It was valid until ${fmt(p.validUntil)}. Ask the sender to send a new one.`}
          {p.state === "completed" && "Everything on this pass has been picked up."}
        </p>
      </div>
    );
  }
  return (
    <div className="pay-card pk-pass">
      <p className="eyebrow">Pickup pass</p>
      <h1>{what}</h1>
      <p className="pay-lead">{p.collector ? <>For <b>{p.collector}</b>. </> : null}Show this at the counter to collect it.{p.bringId ? <> <b>Bring photo ID.</b></> : p.verify === "qr_name" ? <> Give your name at the counter.</> : null}</p>

      {p.qr && <div className="pk-qrwrap"><Qr data={p.qr} /><div className="pk-code">{p.code?.split("").join(" ")}</div><p className="pay-small">Or read the code out.</p></div>}

      <div className="pay-lines">
        <div className="pay-line"><span>Where</span><b>{p.place.title}</b></div>
        {p.place.address && <div className="pay-line"><span>Address</span><b>{p.place.address}</b></div>}
        {p.place.accessHours && <div className="pay-line"><span>Hours</span><b>{p.place.accessHours}</b></div>}
        {p.validUntil && <div className="pay-line"><span>Collect by</span><b>{fmt(p.validUntil)}</b></div>}
        <div className="pay-line"><span>Check at counter</span><b>{p.verifyLabel}</b></div>
      </div>

      {(p.note || p.photo) && (
        <div className="pk-note">
          <p className="eyebrow">From the sender</p>
          {p.note && <p>{p.note}</p>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.photo && <img className="pk-photo" src={p.photo} alt="From the sender" />}
        </div>
      )}
      {p.place.instructions && <p className="pay-note">{p.place.instructions}</p>}
      {p.place.address && (
        <a className="btn clay" style={{ marginTop: 6 }} href={`https://maps.google.com/?q=${encodeURIComponent(p.place.address)}`} target="_blank" rel="noreferrer">Open in Maps</a>
      )}
      <p className="pay-small">Questions about the item? Contact the person who sent you this pass. Reference #{p.reference}</p>
    </div>
  );
}

/** The collector has no account and no app — this link is all they hold. Once they've
 *  seen how a pickup works, invite them in: the app if there is a store link, else sign-up. */
function GetStowbo({ collected }: { collected: boolean }) {
  // The App Store / store listing, when one is configured. Runtime env, so it can be
  // changed without rebuilding. (NEXT_PUBLIC_APP_URL is the web app itself, not the app.)
  const appUrl = process.env.APP_STORE_URL || process.env.NEXT_PUBLIC_APP_STORE_URL;
  return (
    <section className="pk-cta">
      <p className="eyebrow">New to Stowbo?</p>
      <h2>{collected ? "That’s how easy a pickup is." : "Store, park and hand off pickups yourself."}</h2>
      <p>Stowbo finds you storage and parking near you, keeps your things Stowbo-protected while they’re stored, and lets you send a pass like this one to anyone who’s collecting for you.</p>
      <div className="pk-cta-row">
        <a className="btn clay" href={appUrl || routes.signup}>{appUrl ? "Get the app" : "Create a free account"}</a>
        {appUrl && <a className="btn ghost" href={routes.signup}>Or sign up on the web</a>}
        {!appUrl && <a className="btn ghost" href={routes.howItWorks ?? "/how-it-works"}>How it works</a>}
      </div>
    </section>
  );
}

function Receipt({ r }: { r: PickupReceipt }) {
  return (
    <div className="pay-card pay-done">
      <div className="pay-tick" aria-hidden>✓</div>
      <h1>Collected</h1>
      <p className="pay-lead">{r.collector ? <><b>{r.collector}</b> picked up </> : "Picked up "}{r.items.map((i) => i.label).join(", ")} at <b>{r.place.title}</b>{r.completedAt ? <> on {fmt(r.completedAt)}</> : null}.</p>
      <div className="pay-lines" style={{ textAlign: "left" }}>
        {r.items.map((i, k) => (
          <div key={k} className="pay-line"><span>{i.label}</span><b>{i.verified.length ? `checked: ${i.verified.map((v) => (v === "id" ? "photo ID" : v)).join(", ")}` : "handed over"}</b></div>
        ))}
        {r.place.address && <div className="pay-line"><span>Where</span><b>{r.place.address}</b></div>}
      </div>
      {r.items.some((i) => i.photos?.length) && (
        <div className="pk-photos">
          {r.items.flatMap((i) => i.photos || []).slice(0, 4).map((f: any, k) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={k} className="pk-photo" src={f.url || f.signedUrl} alt="Handover photo" />
          ))}
        </div>
      )}
      <p className="pay-ref">Reference <b>#{r.reference}</b></p>
      <p className="pay-small">Keep this page as your receipt.</p>
    </div>
  );
}
