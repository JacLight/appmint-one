import Link from "next/link";
import type { SchedulingConfig } from "@/setups/scheduling-config";
import { availability, loadBookingTypes } from "../../lib/data";
import { bookablesOf, reasonsOf } from "../../lib/catalog";
import { addDays, clock, dayKey, daysLine, duration, hourOf, initials, isKey, keyParts, money, relDay, time, todayKey, zoneName } from "../../lib/format";
import { Empty, Ic, Img } from "../bits";
import { BookFilters } from "./book-filters";
import { DayTimes, type DayTimesDay } from "./day-times";
import { PendingArea, PendingLink, PendingProvider } from "./pending";
import { PeopleSkeleton } from "./skeleton";

const DAYS = 7;

/** Times still ahead of now (the engine can return the start of the current slot). */
const ahead = (iso: string) => Date.parse(iso) > Date.now();

/**
 * Clinic and firm: a search row on top (what it's for, who with, which week), then everyone
 * who does it. Each doctor or attorney is the host of their own booking definition, so each
 * row shows their own time zone, days and hours, and every open time of the week.
 */
export async function FindTime({ cfg, type: typeSlug, reason: reasonQ, with: withEmail, from: fromQ }: { cfg: SchedulingConfig; type?: string; reason?: string; with?: string; from?: string }) {
  const firm = cfg.style === "firm";
  const noun = (n: number) => (firm ? (n === 1 ? "attorney" : "attorneys") : n === 1 ? "clinician" : "clinicians");
  const loaded = await loadBookingTypes();
  const types = loaded.types.filter((t) => !t.hidden && t.kind !== "meeting" && t.kind !== "class");

  const reasons = reasonsOf(types);
  const reason = reasons.find((r) => r.slug === reasonQ);
  const only = typeSlug ? types.find((t) => t.slug === typeSlug) : undefined;
  const email = withEmail?.toLowerCase();

  const everyone = bookablesOf(types);
  const offering = everyone.filter((b) => !reason || b.type.services.some((s) => s.name === reason.name));
  const shown = offering.filter((b) => (!only || b.type.id === only.id) && (!email || b.member.email === email));

  const today = todayKey(cfg.timezone);
  const from = isKey(fromQ) && fromQ >= today ? fromQ : today;
  const keys = Array.from({ length: DAYS }, (_, i) => addDays(from, i));
  const avail = await Promise.all(shown.map((b) => availability(b.type, { from, days: DAYS, host: b.member.email || undefined, service: reason?.name })));

  const link = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ reason: reason?.slug, type: only?.slug, with: email, from: from === today ? undefined : from, ...o })) if (v) p.set(k, v);
    const q = p.toString();
    return `/book${q ? `?${q}` : ""}`;
  };
  const priceLine = (price: number) => (firm ? (price ? `${money(price)} consultation` : "Free consultation") : price ? `from ${money(price)}` : "");
  const a = keyParts(keys[0]), z = keyParts(keys[DAYS - 1]);
  const week = a.mon === z.mon ? `${a.mon} ${a.d} – ${z.d}` : `${a.mon} ${a.d} – ${z.mon} ${z.d}`;
  const whoKey = only ? `${only.slug}|${email || ""}` : "";

  return (
    <PendingProvider>
      <div className={`scm ${firm ? "sc-firm" : "sc-clinic"}`}>
        <section className="bk-band bk-band-tight">
          <div className="wrap">
            <p className="eyebrow">{cfg.place.name}</p>
            <h1>{cfg.words.bookCta}</h1>
            {everyone.length > 0 && (
              <BookFilters
                reasonLabel={firm ? "Practice area" : "Reason for visit"}
                reasons={[{ value: "", label: firm ? "Any practice area" : "Any reason", href: link({ reason: undefined }) },
                  ...reasons.map((r) => ({ value: r.slug, label: `${r.name} · ${duration(r.duration)}`, href: link({ reason: r.slug, type: undefined, with: undefined }) }))]}
                whoLabel={firm ? "Attorney" : "Clinician"}
                people={[{ value: "", label: firm ? "Any attorney" : "Any clinician", href: link({ type: undefined, with: undefined }) },
                  ...offering.map((b) => ({ value: `${b.type.slug}|${b.member.email}`, label: b.member.name, href: link({ type: b.type.slug, with: b.member.email || undefined }) }))]}
                reason={reason?.slug || ""}
                who={whoKey}
                week={week}
                prev={from > today ? link({ from: addDays(from, -DAYS) <= today ? undefined : addDays(from, -DAYS) }) : undefined}
                next={link({ from: addDays(from, DAYS) })}
              />
            )}
          </div>
        </section>

        <section className="wrap bk-body bk-list">
          {!loaded.ok ? (
            <Empty title="We couldn’t load open times" action={<span style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}><PendingLink className="btn clay sm" href={link({})}>Try again</PendingLink>{cfg.place.phone && <a className="btn ghost sm" href={`tel:${cfg.place.phone.replace(/[^0-9+]/g, "")}`}><Ic n="phone" size={16} /> {cfg.place.phone}</a>}</span>}>
              Something went wrong on our side. Try again in a moment{cfg.place.phone ? ", or call and we’ll book it for you" : ""}.
            </Empty>
          ) : !everyone.length ? (
            <Empty title={firm ? "No attorneys take online bookings yet" : "No clinicians take online bookings yet"} action={cfg.place.phone ? <a className="btn clay sm" href={`tel:${cfg.place.phone.replace(/[^0-9+]/g, "")}`}><Ic n="phone" size={16} /> Call {cfg.place.phone}</a> : undefined}>
              {firm ? "Call the office and we’ll arrange a time with the right attorney." : "Call the front desk and we’ll find you a time."}
            </Empty>
          ) : (
            <>
              <p className="bk-count">
                <b>{shown.length} {noun(shown.length)}</b>
                {reason ? <> for {reason.name.toLowerCase()} · {duration(reason.duration)}{priceLine(reason.price) ? ` · ${priceLine(reason.price)}` : ""}</> : <> taking bookings</>}
                {(only || email) && <> · <PendingLink href={link({ type: undefined, with: undefined })}>see everyone</PendingLink></>}
              </p>
              <PendingArea fallback={<PeopleSkeleton count={Math.min(3, Math.max(1, shown.length))} />}>
                {!shown.length && <Empty title={firm ? "No attorney handles this online" : "No clinician offers this online"}>{cfg.place.phone ? `Call ${cfg.place.phone} and we’ll book it for you.` : "Please pick another reason."}</Empty>}
                {shown.map((b, i) => {
                  const { type: t, member: m } = b;
                  const tz = t.timezone || cfg.timezone;
                  const svc = reason ? t.services.find((s) => s.name === reason.name) : undefined;
                  const slots = (avail[i]?.days || []).flatMap((d) => d.slots || []).filter((s) => s.spotsAvailable > 0 && ahead(s.startTime));
                  const href = (iso: string) => {
                    const u = new URLSearchParams({ at: iso });
                    if (m.email) u.set("with", m.email);
                    if (svc && !svc.implicit) u.set("service", svc.name);
                    return `/book/${t.slug}?${u.toString()}`;
                  };
                  const days: DayTimesDay[] = keys.map((k) => {
                    const p = keyParts(k);
                    return { key: k, wd: k === today ? "Today" : p.wd, d: p.d, mon: p.mon, times: slots.filter((s) => dayKey(s.startTime, tz) === k).map((s) => ({ label: time(s.startTime, tz), href: href(s.startTime), hour: hourOf(s.startTime, tz) })) };
                  });
                  const specialty = m.specialties?.join(", ") || t.specialty || m.practice || t.area;
                  const role = [m.title, m.credentials].filter((x) => x && x !== m.name).join(", ");
                  const offers = t.services.filter((s) => !s.implicit);
                  const next = slots[0];
                  const hours = [daysLine(t.workDays), t.hours ? `${clock(t.hours.start)}–${clock(t.hours.end)}` : ""].filter(Boolean).join(", ");
                  return (
                    <article key={`${t.id}:${m.email}`} className="dr">
                      <div className="dr-who">
                        <span className="dr-ph">{m.photo ? <Img src={m.photo} alt={m.name} w={300} /> : <span className="dr-mono" aria-hidden>{initials(m.name)}</span>}</span>
                        <div className="dr-id">
                          <h3>{m.name}</h3>
                          {(role || specialty) && <p className="dr-spec">{[role, specialty].filter(Boolean).join(" · ")}</p>}
                          <dl className="dr-meta">
                            {hours && <div><dt><Ic n="cal" size={14} /></dt><dd>{hours}</dd></div>}
                            <div><dt><Ic n="clock" size={14} /></dt><dd>{zoneName(tz)}</dd></div>
                            {t.video && <div><dt><Ic n="video" size={14} /></dt><dd>In person or by video</dd></div>}
                            {m.languages?.length ? <div><dt><Ic n="chat" size={14} /></dt><dd>{m.languages.join(", ")}</dd></div> : null}
                            {!reason && offers.length > 1 && <div><dt><Ic n="doc" size={14} /></dt><dd>{offers.map((s) => s.name).join(", ")}</dd></div>}
                          </dl>
                          {next && <Link className="dr-next" href={href(next.startTime)}>Next available <b>{relDay(next.startTime, tz)}, {time(next.startTime, tz)}</b> <Ic n="arrow" size={14} /></Link>}
                        </div>
                      </div>
                      <DayTimes days={days} emptyNote={<>Nothing open this week. <PendingLink href={link({ from: addDays(from, DAYS) })}>See the next week</PendingLink></>} />
                    </article>
                  );
                })}
              </PendingArea>
              {cfg.policy && <p className="st-policy">{cfg.policy}</p>}
            </>
          )}
        </section>
      </div>
    </PendingProvider>
  );
}
