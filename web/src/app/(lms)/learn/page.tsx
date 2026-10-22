import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { getSession } from "@/lib/auth";
import { moduleLabel, term } from "@/setups/modules";
import { listCourseProducts, listCourses } from "@/modules/lms/lib/catalog";
import type { CourseCard as Card } from "@/modules/lms/lib/types";
import { CourseCard, CourseProductCard } from "@/modules/lms/components/course-card";
import { Ic } from "@/modules/lms/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  const setup = await getSetup();
  return { title: `${moduleLabel(setup, "lms")} · ${setup.brand.name}`, description: setup.moduleCopy?.lms?.blurb };
}

/** Filters built only from what a course post says: its length, its quizzes, its
 *  reviewed assignments, and where I stand on it. */
const FILTERS: { id: string; label: string; test: (c: Card) => boolean; signedIn?: boolean }[] = [
  { id: "short", label: "Under 1 hour", test: (c) => c.minutes > 0 && c.minutes < 60 },
  { id: "long", label: "1 hour or more", test: (c) => c.minutes >= 60 },
  { id: "quizzes", label: "With quizzes", test: (c) => c.quizzes > 0 },
  { id: "reviewed", label: "Teacher-reviewed work", test: (c) => c.assignments > 0 },
  { id: "progress", label: "In progress", test: (c) => c.mine?.status === "active", signedIn: true },
  { id: "done", label: "Completed", test: (c) => c.mine?.status === "completed", signedIn: true },
];

/** The catalog: published Content Studio courses (enroll free), then the paid courses
 *  this setup sells as storefront products (bought through the Store's bag). */
export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const [setup, session, sp] = await Promise.all([getSetup(), getSession(), searchParams]);
  const q = (sp.q || "").trim();
  const [courses, products] = await Promise.all([
    listCourses(setup, { search: q || undefined, signedIn: session.signedIn }).catch(() => null),
    listCourseProducts(setup, { search: q || undefined }).catch(() => []),
  ]);
  const word = term(setup, "course").toLowerCase();
  const all = courses ?? [];
  // A filter that keeps nothing, or keeps everything, says nothing: it isn't offered.
  const pills = FILTERS.filter((f) => (!f.signedIn || session.signedIn) && all.some(f.test) && (f.signedIn || !all.every(f.test)));
  const active = pills.find((f) => f.id === sp.f);
  const shown = active ? all.filter(active.test) : all;
  const link = (f?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (f) p.set("f", f);
    const s = p.toString();
    return `/learn${s ? `?${s}` : ""}`;
  };
  const total = all.length + products.length;

  return (
    <>
      <SiteHeader />
      <header className="lm-cat-top">
        <div className="wrap lm-cat-top-in">
          <div>
            <p className="lm-eyebrow">{setup.brand.name} · {moduleLabel(setup, "lms")}</p>
            <h1>{q ? <>Results for “{q}”</> : `All ${word}s`}</h1>
            {!q && setup.moduleCopy?.lms?.blurb && <p className="lm-cat-sub">{setup.moduleCopy.lms.blurb}</p>}
          </div>
          <form className="lm-search" action="/learn" role="search">
            <Ic n="search" />
            <label className="lm-sr" htmlFor="lm-cq">Search {word}s</label>
            <input id="lm-cq" name="q" defaultValue={q} placeholder={`Search ${word}s`} autoComplete="off" />
            {active && <input type="hidden" name="f" value={active.id} />}
            <button type="submit">Search</button>
          </form>
        </div>
      </header>

      <main className="wrap lm-page">
        {courses === null ? (
          <div className="lm-empty"><h3>We couldn’t load the {word}s</h3><p>Refresh in a moment.</p></div>
        ) : total === 0 ? (
          q ? (
            <div className="lm-empty">
              <h3>No {word}s match “{q}”</h3>
              <p>Try a different word.</p>
              <Link className="btn ghost sm" href="/learn">Clear search</Link>
            </div>
          ) : (
            <div className="lm-empty">
              <h3>No {word}s published yet</h3>
              <p>New {word}s appear here as soon as they’re published.</p>
            </div>
          )
        ) : (
          <>
            {all.length > 0 && (
              <section>
                <div className="lm-filter">
                  <nav className="lm-pills" aria-label="Filter">
                    <Link className={`lm-pill${!active ? " on" : ""}`} href={link()} aria-current={!active ? "true" : undefined}>All <span>{all.length}</span></Link>
                    {pills.map((f) => (
                      <Link key={f.id} className={`lm-pill${active?.id === f.id ? " on" : ""}`} href={link(active?.id === f.id ? undefined : f.id)} aria-current={active?.id === f.id ? "true" : undefined}>
                        {f.label} <span>{all.filter(f.test).length}</span>
                      </Link>
                    ))}
                  </nav>
                  <p className="lm-count">{shown.length} {word}{shown.length === 1 ? "" : "s"}{active ? ` · ${active.label.toLowerCase()}` : ""}</p>
                </div>
                <div className={`lm-grid${shown.length === 3 ? " c3" : ""}`}>{shown.map((c) => <CourseCard key={c.id} c={c} />)}</div>
              </section>
            )}
            {products.length > 0 && (
              <section className="lm-sec">
                <div className="lm-sec-hd"><div><h2 className="lm-h2">Paid {word}s</h2><p>Bought through our shop.</p></div></div>
                <div className="lm-grid">{products.map((p) => <CourseProductCard key={p.sk} p={p} />)}</div>
              </section>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
