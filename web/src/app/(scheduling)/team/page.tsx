import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { bookingTypes } from "@/modules/scheduling/lib/data";
import { teamOf } from "@/modules/scheduling/lib/catalog";
import { Empty, Ic, Img } from "@/modules/scheduling/components/bits";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getSetup()).scheduling?.words.team || "Team" };
}

/** The people: coaches, clinicians or attorneys, from the booking types' teams. */
export default async function TeamPage() {
  const setup = await getSetup();
  const cfg = setup.scheduling!;
  const types = (await bookingTypes()).filter((t) => !t.hidden && t.kind !== "meeting");
  const people = teamOf(types);
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
              {people.map((m) => {
                const theirs = types.filter((t) => t.hosts.includes(m.email));
                return (
                  <article key={m.email} className="tm-row">
                    <span className={`tm-ph ${cfg.style === "studio" ? "round" : ""}`}><Img src={m.photo} alt={m.name} w={600} /></span>
                    <div className="tm-b">
                      <h2>{m.name}</h2>
                      <p className="tm-t">{[m.title, m.practice].filter(Boolean).join(" · ")}</p>
                      {m.credentials && <p className="tm-c">{m.credentials}</p>}
                      {m.languages?.length ? <p className="tm-c">Speaks {m.languages.join(", ")}</p> : null}
                      {m.bio && <p className="tm-bio">{m.bio}</p>}
                      {theirs.length > 0 && (
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
