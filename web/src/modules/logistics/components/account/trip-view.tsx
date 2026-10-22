import Link from "next/link";
import { getMapsKey } from "@/modules/rentals/lib/maps";
import { getDeliveryJob, trackDelivery } from "@/api/logistics";
import { jobKind } from "@/modules/logistics/lib/services";
import {
  CANCEL_REFUND, ACTIVE_STATUSES, UNPAID_STATUSES, activityText, canCancel, canRate, customerLabel, isLive, pickupOf, dropoffOf, stopAddress, shortAddress, whenOf, whatOf, type Words,
} from "@/modules/logistics/lib/status";
import type { JobStop, ProofFile } from "@/modules/logistics/lib/types";
import { CustomerSteps, fmtTime, money } from "@/modules/logistics/components/shared/bits";
import { DriverCard } from "@/modules/logistics/components/shared/driver-card";
import { LiveRefresh } from "@/modules/logistics/components/shared/live-refresh";
import { MessageBox } from "@/modules/logistics/components/shared/message-box";
import { Icon } from "@/modules/logistics/components/shared/icons";
import { RouteMap } from "@/modules/logistics/components/map/route-map";
import { CancelDelivery } from "./cancel-delivery";
import { RateDelivery } from "./rate-delivery";
import { ReportIssue } from "./report-issue";
import { FinishPayment } from "./finish-payment";
import { ShareTrip } from "./share-trip";

const pt = (st?: JobStop) => (st?.location?.lat != null && st?.location?.lng != null ? { lat: Number(st.location.lat), lng: Number(st.location.lng) } : null);

/**
 * The live trip: a full-width map with the route and the driver, and the trip card —
 * status, steps, driver + car + plate, message / call / share / cancel, proof photos,
 * the receipt, rating and help. Re-reads the job every 10 s while it is moving.
 */
export async function TripView({ id, words: w, backHref, booked }: { id: string; words: Words; backHref: string; booked?: boolean }) {
  const [env, track, apiKey] = await Promise.all([
    getDeliveryJob(id).catch(() => null),
    trackDelivery(id).catch(() => null),
    getMapsKey().catch(() => null),
  ]);
  const j = env?.data;
  if (!env || !j) {
    return (
      <div className="mv-trip-missing">
        <h1>This {w.job.toLowerCase()} isn’t here</h1>
        <p>It may have been removed, or it isn’t one of yours.</p>
        <Link className="mv-btn inline" href={backHref}>Your {w.jobs.toLowerCase()}</Link>
      </div>
    );
  }

  const status = j.status;
  const kind = jobKind(j as any);
  const pu = pickupOf(j), dr = dropoffOf(j);
  const live = isLive(status);
  const unpaid = UNPAID_STATUSES.includes(status);
  const cur = j.payment?.currency || j.pricing?.currency || "USD";
  const amount = j.payment?.amount ?? j.pricing?.total ?? 0;
  const paid = j.payment?.status === "paid" || !!j.payment?.paidAt;
  const refunded = j.cancellation?.refundAmount ?? j.payment?.refund?.amount ?? 0;
  const agent = track?.agent || null;
  const driverName = agent?.name || j.assignment?.agentName || "";
  const driverId = j.assignment?.agent || "";
  const driverPhone = agent?.phone || j.assignment?.agentPhone;
  const vehicle = agent?.vehicle;
  const point = ACTIVE_STATUSES.includes(status) ? (track?.tracking?.currentLocation || agent?.currentLocation || j.tracking?.liveLocation || null) : null;
  const when = whenOf(j);
  const what = whatOf(j);
  const proof: (ProofFile & { label: string })[] = [
    ...j.stops.flatMap((s) => [...(s.proof?.photos ?? []), ...(s.proof?.images ?? [])].map((p) => ({ ...p, label: s.type === "pickup" ? "At pickup" : "At drop-off" }))),
    ...(j.images ?? []).filter((i) => ["pickup", "dropoff", "proof"].includes(String(i.category))).map((i) => ({ ...i, label: i.category === "pickup" ? "At pickup" : "At drop-off" })),
  ].filter((p, i, arr) => p.url && arr.findIndex((q) => q.url === p.url) === i);
  const timeline = [...(j.timeline ?? [])]
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .map((e) => ({ at: e.timestamp, text: activityText(e, "customer", w) }))
    .filter((e): e is { at: string; text: string } => !!e.text);
  const label = `${w.job} #${j.jobNumber}`;
  const headline = customerLabel(status, w, kind);
  const matching = status === "pending" || status === "broadcasting";
  const car = vehicle ? [vehicle.color, vehicle.make, vehicle.model].filter(Boolean).join(" ") : "";
  const shareText = [
    kind === "ride" ? `I’m on a ${label.toLowerCase()} to ${shortAddress(dr)}.` : `${label} to ${shortAddress(dr)}.`,
    `Status: ${headline}.`,
    driverName ? `${w.provider}: ${driverName}${car ? `, ${car}` : ""}${vehicle?.licensePlate ? ` (${vehicle.licensePlate})` : ""}.` : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="mv-trip">
      <LiveRefresh active={live} seconds={10} />
      <div className="mv-trip-map">
        <RouteMap apiKey={apiKey} pickup={pt(pu)} dropoff={pt(dr)} driver={point} padding={{ left: 470, top: 80, bottom: 60, right: 60 }} fromLabel={stopAddress(pu)} toLabel={stopAddress(dr)} />
        <Link className="mv-trip-back" href={backHref}><Icon name="back" size={16} />{w.jobs}</Link>
        {point && <span className="mv-trip-livetag"><i />Live{track?.tracking?.lastUpdate ? ` · ${fmtTime(track.tracking.lastUpdate)}` : ""}</span>}
      </div>

      <aside className="mv-trip-panel">
        {booked && !unpaid && status !== "cancelled" && (
          <div className="mv-booked"><Icon name="check" size={16} />Booked · {money(amount, cur)} charged{j.jobNumber ? ` · #${j.jobNumber}` : ""}</div>
        )}
        <div className="mv-trip-hd">
          <p className="mv-trip-kind"><Icon name={kind === "ride" ? "car" : "box"} size={15} />{kind === "ride" ? "Ride" : "Delivery"} · #{j.jobNumber}</p>
          <h1>{headline}</h1>
          <p className="mv-trip-sub">{[what, when ? `Scheduled ${fmtTime(when)}` : env.createdate ? `Booked ${fmtTime(env.createdate)}` : ""].filter(Boolean).join(" · ")}</p>
        </div>

        {unpaid && (
          <div className="mv-banner warn">
            <p>This {w.job.toLowerCase()} isn’t booked yet — the payment wasn’t finished.</p>
            <FinishPayment jobId={env.sk} amount={amount} currency={cur} jobWord={w.job} />
          </div>
        )}
        {status === "cancelled" && (
          <div className="mv-banner off">
            Cancelled{j.cancellation?.cancelledAt ? ` ${fmtTime(j.cancellation.cancelledAt)}` : ""}.
            {refunded ? ` ${money(refunded, cur)} refunded to your card.` : paid ? " Any refund goes back to your card." : " You weren’t charged."}
          </div>
        )}
        {status === "failed" && (
          <div className="mv-banner off">This {w.job.toLowerCase()} couldn’t be completed{j.failure?.reason ? ` (${j.failure.reason.replace(/_/g, " ")})` : ""}. We’ll be in touch in your messages.</div>
        )}

        {!unpaid && status !== "cancelled" && status !== "failed" && <div className="mv-trip-steps"><CustomerSteps env={env} words={w} kind={kind} /></div>}

        {!unpaid && status !== "cancelled" && (
          <div className="mv-trip-sec">
            {driverName ? (
              <DriverCard name={driverName} photo={agent?.photo} rating={agent?.rating} vehicle={vehicle} note={live ? `Your ${w.provider.toLowerCase()}` : undefined} />
            ) : matching ? (
              <div className="mv-matching"><span className="mv-radar" aria-hidden /><div><b>Matching you with a {w.provider.toLowerCase()}</b><small>You’ll see who’s coming, their car and plate here.</small></div></div>
            ) : null}
            <div className="mv-acts">
              {driverId && <a className="mv-act" href="#message"><span><Icon name="chat" size={19} /></span>Message</a>}
              {driverPhone && live && <a className="mv-act" href={`tel:${driverPhone.replace(/[^0-9+]/g, "")}`}><span><Icon name="phone" size={19} /></span>Call</a>}
              {live && <ShareTrip text={shareText} />}
              {canCancel(status) && <a className="mv-act" href="#cancel"><span><Icon name="x" size={19} /></span>Cancel</a>}
              <Link className="mv-act" href="/account/support"><span><Icon name="shield" size={19} /></span>Help</Link>
            </div>
          </div>
        )}

        <div className="mv-trip-sec">
          <div className="mv-trip-route">
            <div><i className="mv-pin pu" /><span><small>Pickup{pu?.completedAt ? ` · ${fmtTime(pu.completedAt)}` : ""}</small>{stopAddress(pu) || "—"}{pu?.contact?.name ? <em>{[pu.contact.name, pu.contact.phone].filter(Boolean).join(" · ")}</em> : null}</span></div>
            <div><i className="mv-pin dr" /><span><small>Drop-off{dr?.completedAt ? ` · ${fmtTime(dr.completedAt)}` : ""}</small>{stopAddress(dr) || "—"}{dr?.contact?.name ? <em>{[dr.contact.name, dr.contact.phone].filter(Boolean).join(" · ")}</em> : null}</span></div>
          </div>
          {j.notes && <p className="mv-trip-note">“{j.notes}”</p>}
        </div>

        {proof.length > 0 && (
          <div className="mv-trip-sec">
            <h2>Proof</h2>
            <div className="mv-proof">
              {proof.map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noreferrer" title={p.label}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.label} />
                  <small>{p.label}</small>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="mv-trip-sec">
          <h2>Receipt</h2>
          <dl className="mv-receipt">
            <div><dt>{what || w.job}</dt><dd>{money(amount, cur)}</dd></div>
            {refunded ? <div><dt>Refunded</dt><dd>−{money(refunded, cur)}</dd></div> : null}
            <div className="tot"><dt>{refunded ? "You paid" : "Total"}</dt><dd>{money(Math.max(0, amount - (refunded || 0)), cur)}</dd></div>
          </dl>
          <p className="mv-trip-sub">{refunded ? (refunded >= amount - 0.004 ? "Refunded to your card" : "Partly refunded to your card") : paid ? `Paid by card${j.payment?.paidAt ? ` · ${fmtTime(j.payment.paidAt)}` : ""}` : unpaid ? "Not paid" : ""}</p>
        </div>

        {driverId && !unpaid && status !== "cancelled" && (
          <div className="mv-trip-sec" id="message">
            <h2>Message {driverName.split(" ")[0] || w.provider.toLowerCase()}</h2>
            <MessageBox to={driverId} toName={driverName.split(" ")[0] || w.provider} jobId={env.sk} jobNumber={j.jobNumber} label={label} placeholder={kind === "ride" ? "I’m by the main entrance…" : undefined} />
          </div>
        )}

        {canRate(status) && (
          <div className="mv-trip-sec">
            <h2>{j.rating ? "Your rating" : `How was your ${w.job.toLowerCase()}?`}</h2>
            <RateDelivery jobId={env.sk} providerWord={w.provider} rated={j.rating} />
          </div>
        )}

        {!unpaid && status !== "cancelled" && (
          <div className="mv-trip-sec">
            <h2>Something wrong?</h2>
            <ReportIssue jobId={env.sk} issues={j.issues ?? []} />
          </div>
        )}

        {timeline.length > 0 && (
          <details className="mv-trip-sec mv-activity">
            <summary>Activity</summary>
            <ul className="lg-act">
              {timeline.map((e, i) => <li key={i}><i aria-hidden /><span>{e.text}</span><time>{fmtTime(e.at)}</time></li>)}
            </ul>
          </details>
        )}

        {canCancel(status) && (
          <div className="mv-trip-sec" id="cancel">
            <CancelDelivery jobId={env.sk} jobWord={w.job} refundPercent={CANCEL_REFUND[status] ?? 0} paid={paid} />
          </div>
        )}
      </aside>
    </div>
  );
}
