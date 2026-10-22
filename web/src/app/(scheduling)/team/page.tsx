import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { bookingTypes } from "@/modules/scheduling/lib/data";
import { bookablesOf, reasonSlug, teamOf } from "@/modules/scheduling/lib/catalog";
import { clock, daysLine, zoneName } from "@/modules/scheduling/lib/format";
import { Empty, Ic, Img } from "@/modules/scheduling/components/bits";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getSetup()).scheduling?.words.team || "Team" };
}

/** The people: coaches from the class teams; clinicians and attorneys from their own booking
 *  definitions (each is the host of theirs, with its own zone, hours and services). */
export default async function TeamPage() {
  const setup = await getSetup();
  const cfg = setup.scheduling!;
  const types = (await bookingTypes()).filter((t) => !t.hidden && t.kind !== "meeting");
  const studio = cfg.style === "studio";
  const people = studio
    ? teamOf(types).map((m) => ({ member: m, type: undefined }))
    : bookablesOf(types.filter((t) => t.kind !== "class")).map((b) => ({ member: b.member, type: b.type }));
  const cls = cfg.style === "studio" ? "sc-studio" : cfg.style === "clinic" ? "sc-clinic" : "sc-firm";
  return (
    <>
      <SiteHeader />
      <main className={`scm ${cls}`}>
        <section className="bk-band"><div className="wrap bk-band-in"><div><p className="eyebrow">{setup.brand.name}</p><h1>{cfg.words.team}</h1></div></div></section>
        <section className="wrap bk-body">
          {people.length === 0 ? (
            <Empty title={`${cfg.words.team} profiles are on their way`}>{cfg.place.phone ? `Call ${cfg.place.phone} to book in the meantime.` : ""}</Empty>
          ) : (
            <div className="tm-list">
              {people.map(({ member: m, type: own }) => {
                const theirs = types.filter((t) => t.hosts.includes(m.email));
                const hours = own ? [zoneName(own.timezone), daysLine(own.workDays), own.hours ? `${clock(own.hours.start)} – ${clock(own.hours.end)}` : ""].filter(Boolean).join(" · ") : "";
                const specialty = m.specialties?.join(", ") || own?.specialty;
                return (
                  <article key={`${own?.id || ""}:${m.email}`} className="tm-row">
                    <span className={`tm-ph ${cfg.style === "studio" ? "round" : ""}`}><Img src={m.photo} alt={m.name} w={600} /></span>
                    <div className="tm-b">
                      <h2>{m.name}</h2>
                      <p className="tm-t">{[m.title, m.practice].filter(Boolean).join(" · ")}</p>
                      {m.credentials && <p className="tm-c">{m.credentials}</p>}
                      {specialty && <p className="tm-c">{specialty}</p>}
                      {m.languages?.length ? <p className="tm-c">Speaks {m.languages.join(", ")}</p> : null}
                      {hours && <p className="tm-c">{hours}</p>}
                      {(m.bio || (own && !m.email ? own.description : "")) && <p className="tm-bio">{m.bio || own?.description}</p>}
                      {own && (
                        <div className="tm-book">
                          {own.services.slice(0, 6).map((s) => (
                            <Link key={s.name} className="btn sm ghost" href={`/book?type=${own.slug}${s.implicit ? "" : `&reason=${reasonSlug(s.name)}`}${m.email ? `&with=${encodeURIComponent(m.email)}` : ""}`}>Book {s.implicit ? "a time" : s.name.toLowerCase()} <Ic n="arrow" size={14} /></Link>
                          ))}
                        </div>
                      )}
                      {!own && theirs.length > 0 && (
                        <div className="tm-book">
                          {theirs.slice(0, 4).map((t) => (
                            <Link key={t.id} className="btn sm ghost" href={t.kind === "class" ? `/book?type=${t.slug}` : `/book/${t.slug}?with=${encodeURIComponent(m.email)}`}>{t.kind === "class" ? t.title : `Book ${cfg.style === "firm" ? "a consultation" : t.kind === "private" ? "a private" : t.title.toLowerCase()}`} <Ic n="arrow" size={14} /></Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
