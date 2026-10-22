import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { getSession } from "@/lib/auth";
import { term } from "@/setups/modules";
import { listCourseProducts, listCourses } from "@/modules/lms/lib/catalog";
import { courseRef, fmtMinutes, plural } from "@/modules/lms/lib/shape";
import { CourseCard, CourseProductCard } from "@/modules/lms/components/course-card";
import { ContinueRow } from "@/modules/lms/components/continue-row";
import { Cover } from "@/modules/lms/components/cover";
import { Ic } from "@/modules/lms/components/icons";

/** The academy home: search and a featured course, my courses in progress, the shelf of
 *  published courses, the short ones as a quick list, then paid courses sold as
 *  storefront products. Every number is summed from the published course posts. */
export async function AcademyHome() {
  const [setup, session] = await Promise.all([getSetup(), getSession()]);
  const [courses, products] = await Promise.all([
    listCourses(setup, { signedIn: session.signedIn }).catch(() => null),
    listCourseProducts(setup).catch(() => []),
  ]);
  const list = courses ?? [];
  const word = term(setup, "course").toLowerCase();
  const inProgress = list.filter((c) => c.mine && c.mine.status === "active");
  const featured = list.find((c) => !c.mine && c.coverImage) || list.find((c) => !c.mine) || list[0];
  const lessons = list.reduce((t, c) => t + c.lessons, 0);
  const minutes = list.reduce((t, c) => t + c.minutes, 0);
  const videos = list.reduce((t, c) => t + c.videos, 0);
  const quizzes = list.reduce((t, c) => t + c.quizzes, 0);
  const quick = [...list].filter((c) => c.minutes > 0 && c.minutes < 60).sort((a, b) => a.minutes - b.minutes);

  return (
    <>
      <SiteHeader />
      <section className="lm-hero">
        <div className="wrap lm-hero-in">
          <div className="lm-hero-copy">
            <h1>{setup.brand.tagline}</h1>
            <p className="sub">{setup.brand.description}</p>
            <form className="lm-search" action="/learn" role="search">
              <Ic n="search" />
              <label className="lm-sr" htmlFor="lm-q">Search {word}s</label>
              <input id="lm-q" name="q" placeholder="What do you want to learn?" autoComplete="off" />
              <button type="submit">Search</button>
            </form>
            {list.length > 0 && (
              <ul className="lm-hero-stats">
                <li><b>{list.length}</b>{list.length === 1 ? word : `${word}s`}</li>
                <li><b>{lessons}</b>lessons</li>
                {minutes > 0 && <li><b>{fmtMinutes(minutes)}</b>of teaching</li>}
                {videos > 0 && <li><b>{videos}</b>{videos === 1 ? "video" : "videos"}</li>}
                {quizzes > 0 && <li><b>{quizzes}</b>{quizzes === 1 ? "quiz" : "quizzes"}</li>}
              </ul>
            )}
          </div>
          {featured && (
            <Link className="lm-spot" href={`/learn/${courseRef(featured)}`}>
              <Cover title={featured.title} src={featured.coverImage} kicker={plural(featured.lessons, "lesson")} eager />
              <div className="lm-spot-b">
                <span className="lm-spot-k">Featured {word}</span>
                <b>{featured.title}</b>
                <small>{plural(featured.lessons, "lesson")}{featured.minutes ? ` · ${fmtMinutes(featured.minutes)}` : ""}{featured.open ? " · Free" : ""}</small>
              </div>
              <span className="lm-spot-go" aria-hidden><Ic n="next" className="lm-ic-in" /></span>
            </Link>
          )}
        </div>
      </section>

      <main className="wrap lm-home">
        {session.signedIn && inProgress.length > 0 && (
          <section className="lm-sec">
            <div className="lm-sec-hd"><div><h2 className="lm-h2">Pick up where you left off</h2></div><Link className="lm-more" href="/account/learning">My learning →</Link></div>
            <div className="lm-continue">{inProgress.slice(0, 3).map((c) => <ContinueRow key={c.id} c={c} wide={inProgress.length === 1} />)}</div>
          </section>
        )}

        {courses === null ? (
          <section className="lm-sec"><div className="lm-empty"><h3>We couldn’t load the {word}s</h3><p>Refresh in a moment.</p></div></section>
        ) : list.length === 0 && products.length === 0 ? (
          <section className="lm-sec">
            <div className="lm-empty">
              <h3>No {word}s published yet</h3>
              <p>New {word}s appear here as soon as they’re published. Create an account and we’ll keep your place.</p>
              {!session.signedIn && <Link className="btn clay sm" href="/signup">Create an account</Link>}
            </div>
          </section>
        ) : (
          <>
            {list.length > 0 && (
              <section className="lm-sec">
                <div className="lm-sec-hd">
                  <div><h2 className="lm-h2">Start learning</h2><p>{plural(list.length, word)}{list.every((c) => c.open) ? " · each one free to start" : ""}</p></div>
                  <Link className="lm-more" href="/learn">Browse all →</Link>
                </div>
                <div className={`lm-grid${list.length === 3 ? " c3" : ""}`}>{list.slice(0, 8).map((c) => <CourseCard key={c.id} c={c} />)}</div>
              </section>
            )}
            {quick.length >= 2 && (
              <section className="lm-sec lm-quick">
                <div className="lm-quick-hd">
                  <h2 className="lm-h2">Got an hour?</h2>
                  <p>{plural(quick.length, word)} you can finish in one sitting.</p>
                  <Link className="lm-more" href="/learn?f=short">See them all →</Link>
                </div>
                <ol className="lm-quick-list">
                  {quick.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <Link href={`/learn/${courseRef(c)}`}>
                        <span className="lm-quick-t"><b>{c.title}</b><small>{plural(c.lessons, "lesson")}{c.quizzes ? ` · ${plural(c.quizzes, "quiz", "quizzes")}` : ""}</small></span>
                        <span className="lm-quick-m">{fmtMinutes(c.minutes)}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {products.length > 0 && (
              <section className="lm-sec">
                <div className="lm-sec-hd"><div><h2 className="lm-h2">Paid {word}s</h2><p>Bought through our shop.</p></div><Link className="lm-more" href="/learn">See all →</Link></div>
                <div className="lm-grid">{products.slice(0, 8).map((p) => <CourseProductCard key={p.sk} p={p} />)}</div>
              </section>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
