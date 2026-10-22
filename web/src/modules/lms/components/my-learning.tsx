import "server-only";
import Link from "next/link";
import { courseOutline, myCourses, type CourseOutline, type MyCourse } from "@/api/content";
import { getSetup } from "@/lib/setup";
import { listCourses } from "@/modules/lms/lib/catalog";
import { fmtMinutes, minutesOf, pagesOfOutline, plural, type OutlineItem } from "@/modules/lms/lib/shape";
import { Cover } from "./cover";
import { CourseCard } from "./course-card";
import { Ic } from "./icons";

type Row = {
  mine: MyCourse;
  ref: string;
  pages: OutlineItem[];
  done: number;
  left: number;
  next?: OutlineItem;
  enrolledAt?: string;
};

/**
 * My learning: what I'm taking (client/content-studio/mine), each with its outline read
 * so the card can say the next lesson by name, how many are done and the time left.
 * The most recent course in progress is the big "continue" card; tabs split the rest.
 */
export async function MyLearning({ tab }: { tab: "progress" | "completed" }) {
  const rows: MyCourse[] = ((await myCourses().catch(() => [])) || []).filter((r) => r.status !== "withdrawn");
  const full: Row[] = await Promise.all(
    rows.map(async (mine) => {
      const ref = String(mine.course?.slug || mine.course?.id || "");
      const o: CourseOutline | null = await courseOutline(ref).catch(() => null);
      const pages = pagesOfOutline((o?.items || []) as OutlineItem[]);
      const done = pages.filter((p) => p.status === "done").length;
      const left = Math.round(pages.filter((p) => p.status !== "done").reduce((t, p) => t + minutesOf(p.duration), 0));
      return { mine, ref, pages, done, left, next: pages.find((p) => p.id === (o?.next ?? mine.next)), enrolledAt: o?.enrollment?.enrolledAt };
    }),
  );
  const active = full.filter((r) => r.mine.status !== "completed").sort((a, b) => String(b.enrolledAt || "").localeCompare(String(a.enrolledAt || "")));
  const completed = full.filter((r) => r.mine.status === "completed");
  const hero = tab === "progress" ? active[0] : undefined;
  const rest = tab === "progress" ? active.slice(1) : completed;
  // Courses I haven't started, from the same catalog — so the page always has a next step.
  const taken = new Set(full.map((r) => String(r.mine.course?.id)));
  const fresh = tab === "progress" ? (await listCourses(await getSetup(), { signedIn: true }).catch(() => [])).filter((c) => !taken.has(c.id)).slice(0, 3) : [];
  const lessonHref = (r: Row, id?: string) => `/learn/${encodeURIComponent(r.ref)}${id ? `/${encodeURIComponent(id)}` : ""}`;

  if (!full.length) {
    const setup = await getSetup();
    const picks = (await listCourses(setup, { signedIn: true }).catch(() => [])).slice(0, 3);
    return (
      <div className="lm-ml">
        <h1 className="lm-ml-h1">My learning</h1>
        <div className="lm-ml-empty">
          <div>
            <h2>You haven’t started a course yet</h2>
            <p>Start one and it appears here, with your place kept in every lesson.</p>
            <Link className="lm-cta inline" href="/learn">Browse courses</Link>
          </div>
        </div>
        {picks.length > 0 && (
          <section className="lm-ml-sec">
            <h2 className="lm-h2">A good place to start</h2>
            <div className="lm-grid c3">{picks.map((c) => <CourseCard key={c.id} c={c} />)}</div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="lm-ml">
      <h1 className="lm-ml-h1">My learning</h1>
      <nav className="lm-tabs" aria-label="My learning">
        <Link className={tab === "progress" ? "on" : ""} href="/account/learning" aria-current={tab === "progress" ? "page" : undefined}>In progress <span>{active.length}</span></Link>
        <Link className={tab === "completed" ? "on" : ""} href="/account/learning?tab=completed" aria-current={tab === "completed" ? "page" : undefined}>Completed <span>{completed.length}</span></Link>
      </nav>

      {hero && (
        <Link className="lm-resume" href={lessonHref(hero, hero.next?.id || hero.mine.next || undefined)}>
          <Cover title={hero.mine.course.title} src={hero.mine.course.coverImage} kicker={plural(hero.pages.length, "lesson")} className="lm-resume-cover" eager />
          <div className="lm-resume-b">
            <span className="lm-resume-k">Continue learning</span>
            <h2>{hero.mine.course.title}</h2>
            {hero.next && (
              <p className="lm-resume-next">
                <Ic n={hero.next.type === "video" ? "play" : "next"} className="lm-ic-in" />
                <span>Lesson {hero.next.step ?? hero.done + 1}: <b>{hero.next.title}</b>{hero.next.duration ? ` · ${hero.next.duration}` : ""}</span>
              </p>
            )}
            <div className="lm-resume-prog">
              <div className="lm-bar"><i style={{ width: `${Math.max(2, hero.mine.percent)}%` }} /></div>
              <small>{hero.mine.percent}% · {hero.done} of {hero.pages.length} lessons{hero.left ? ` · ${fmtMinutes(hero.left)} left` : ""}{hero.mine.dueAt ? ` · due ${new Date(hero.mine.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</small>
            </div>
            <span className="lm-cta inline">Resume <Ic n="next" className="lm-ic-in" /></span>
          </div>
        </Link>
      )}

      {rest.length > 0 ? (
        <section className="lm-ml-sec">
          {hero && <h2 className="lm-h2">Also in progress</h2>}
          <ul className="lm-ml-grid">
            {rest.map((r) => {
              const doneAll = r.mine.status === "completed";
              return (
                <li key={r.mine.enrollmentId}>
                  <Link className="lm-ml-card" href={doneAll ? lessonHref(r) : lessonHref(r, r.next?.id || r.mine.next || undefined)}>
                    <Cover title={r.mine.course.title} src={r.mine.course.coverImage} kicker={plural(r.pages.length, "lesson")} />
                    <div className="lm-ml-card-b">
                      <b>{r.mine.course.title}</b>
                      {!doneAll && r.next && <small className="lm-ml-next">Next: {r.next.title}</small>}
                      <div className="lm-bar"><i style={{ width: `${Math.max(2, doneAll ? 100 : r.mine.percent)}%` }} /></div>
                      <small>{doneAll ? "Completed" : `${r.mine.percent}% · ${r.done} of ${r.pages.length} lessons${r.left ? ` · ${fmtMinutes(r.left)} left` : ""}`}</small>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : !hero ? (
        <div className="lm-ml-empty">
          <div>
            <h2>{tab === "completed" ? "Nothing finished yet" : "Nothing in progress"}</h2>
            <p>{tab === "completed" ? "Courses you finish are kept here." : "Every course you’ve started is finished. Pick a new one."}</p>
            <Link className="lm-cta inline" href={tab === "completed" ? "/account/learning" : "/learn"}>{tab === "completed" ? "Back to in progress" : "Browse courses"}</Link>
          </div>
        </div>
      ) : null}

      {tab === "progress" && fresh.length > 0 && (
        <section className="lm-ml-sec lm-ml-new">
          <h2 className="lm-h2">Start something new</h2>
          <div className="lm-grid c3">{fresh.map((c) => <CourseCard key={c.id} c={c} />)}</div>
        </section>
      )}
    </div>
  );
}
