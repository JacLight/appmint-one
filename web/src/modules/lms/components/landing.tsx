import Link from "next/link";
import type { CourseOutline } from "@/api/content";
import { getSetup } from "@/lib/setup";
import { listCourses } from "@/modules/lms/lib/catalog";
import { fmtMinutes, includesOf, minutesOf, pagesOfOutline, plural, sectionsOf, type OutlineItem } from "@/modules/lms/lib/shape";
import { ContentPlayerRuntime } from "@/modules/lms/player/runtime";
import { Cover } from "./cover";
import { CourseCard } from "./course-card";
import { ExpandAll } from "./expand-all";
import { Ic, typeIcon } from "./icons";

/**
 * A course's landing page, drawn from the Content Player's outline (the same read as
 * base-app's overview: client/content-studio/:course). Nothing here is invented: the
 * counts, lengths, sections and lock reasons are the author's pages as the engine sends
 * them. The way in keeps the Content Player contract: Start is
 * `data-action="contentPlayer.enroll"` and navigates to the `next` page it returns.
 */
export async function CourseLanding({ view, signInHref, notice, query, signedIn }: { view: CourseOutline; signInHref: string; notice?: string; query: string; signedIn: boolean }) {
  const setup = await getSetup();
  const c = view.course;
  const e = view.enrollment;
  const ref = String(c.slug || c.id);
  const items = (view.items || []) as OutlineItem[];
  const pages = pagesOfOutline(items);
  const sections = sectionsOf(items);
  const chapters = sections.filter((s) => s.title).length;
  const total = Math.round(pages.reduce((t, p) => t + minutesOf(p.duration), 0));
  const quizzes = pages.filter((p) => p.type === "quiz").length;
  const done = pages.filter((p) => p.status === "done").length;
  const pct = Number(e?.percent) || 0;
  const next = pages.find((p) => p.id === view.next);
  const includes = includesOf(items);
  const summary = String(c.summary || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const q = query ? `?${query}` : "";
  const href = (item?: string) => `/learn/${encodeURIComponent(ref)}${item ? `/${/^\{\{\w+\}\}$/.test(item) ? item : encodeURIComponent(item)}` : ""}${q}`;
  const date = (v?: string | null) => (v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

  const others = await listCourses(setup, { signedIn }).then((l) => l.filter((x) => x.id !== c.id).slice(0, 4)).catch(() => []);

  // The way in: the same four states as the Content Player overview.
  const cta = (where: "card" | "bar") => {
    const cls = `lm-cta${where === "bar" ? " sm" : ""}`;
    if (signInHref) return <a className={cls} href={signInHref}>Sign in to start</a>;
    if (!e)
      return (
        <button className={cls} data-action="contentPlayer.enroll" data-on-success={`navigate:${href("{{next}}")}`}>
          Start course <Ic n="next" className="lm-ic-in" />
        </button>
      );
    if (e.status === "completed") return <a className={cls} href={href(pages[0]?.id)}>Review course</a>;
    return <a className={cls} href={href(view.next || pages[0]?.id)}>{done ? "Continue learning" : "Start the first lesson"} <Ic n="next" className="lm-ic-in" /></a>;
  };
  const preview = !e && view.next ? <a className="lm-cta ghost" href={href(view.next)}>Preview the first lesson</a> : null;

  return (
    <div className="lm-land">
      <section className="lm-band">
        <div className="wrap lm-band-in">
          <div className="lm-band-copy">
            <nav className="lm-crumbs" aria-label="Breadcrumb">
              <Link href="/learn">Courses</Link>
              <Ic n="next" className="lm-ic-in" />
              <span>{c.title}</span>
            </nav>
            <Cover title={c.title} src={c.coverImage} kicker={plural(pages.length, "lesson")} className="lm-band-cover" eager />
            <h1>{c.title}</h1>
            {summary && <p className="lm-promise">{summary}</p>}
            <ul className="lm-facts">
              <li><Ic n="layers" className="lm-ic-in" />{plural(pages.length, "lesson")}{chapters > 1 ? ` in ${chapters} sections` : ""}</li>
              {total > 0 && <li><Ic n="clock" className="lm-ic-in" />{fmtMinutes(total)} total</li>}
              {quizzes > 0 && <li><Ic n="quiz" className="lm-ic-in" />{plural(quizzes, "quiz", "quizzes")}</li>}
              <li><Ic n="infinity" className="lm-ic-in" />{c.dueInDays ? `Finish within ${c.dueInDays} days` : "Self-paced"}</li>
            </ul>
            {e && (
              <p className="lm-standing">
                {e.status === "completed" ? <>Completed {date(e.completedAt)}</> : <>You’re enrolled · {done} of {pages.length} done{e.dueAt ? ` · due ${date(e.dueAt)}` : ""}</>}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="wrap lm-land-body">
        <div className="lm-land-main">
          {notice && (
            <div className="lm-note"><Ic n="lock" className="lm-ic-in" /><span>{notice}</span></div>
          )}

          {includes.length > 0 && (
            <section className="lm-block">
              <h2 className="lm-h2">This course includes</h2>
              <ul className="lm-includes">
                {includes.map((r) => <li key={r.label}><Ic n={r.icon} className="lm-ic-in" />{r.label}</li>)}
                <li><Ic n="save" className="lm-ic-in" />Your progress is saved to your account</li>
                {(c.languages || []).length > 0 && <li><Ic n="globe" className="lm-ic-in" />Also in {(c.languages || []).length} other {(c.languages || []).length === 1 ? "language" : "languages"}</li>}
              </ul>
            </section>
          )}

          <section className="lm-block" id="content">
            <div className="lm-block-hd">
              <h2 className="lm-h2">Course content</h2>
            </div>
            <div className="lm-sum-line">
              <span>{chapters > 0 ? `${plural(chapters, "section")} • ` : ""}{plural(pages.length, "lesson")}{total ? ` • ${fmtMinutes(total)} total length` : ""}</span>
              {chapters > 1 && <ExpandAll target="#lm-outline" />}
            </div>
            <div className="lm-outline" id="lm-outline">
              {sections.map((s, si) => {
                const rows = (
                  <ul className="lm-rows">
                    {s.items.map((i) => {
                      const locked = i.status === "locked";
                      const isNext = e && i.id === view.next;
                      const inner = (
                        <>
                          <span className={`lm-row-ic${i.status === "done" ? " done" : ""}`}><Ic n={i.status === "done" ? "check" : locked ? "lock" : typeIcon(i.type)} className="lm-ic-in" /></span>
                          <span className="lm-row-t">{i.title}{isNext && <em className="lm-up">Up next</em>}</span>
                          {!e && !locked && <span className="lm-pv">Preview</span>}
                          <span className="lm-row-d">{i.duration || ""}</span>
                        </>
                      );
                      return (
                        <li key={i.id} className={`lm-row is-${i.status || "open"}`}>
                          {locked ? <span title={i.lockReason || undefined}>{inner}</span> : <a href={href(i.id)}>{inner}</a>}
                        </li>
                      );
                    })}
                  </ul>
                );
                if (!s.title) return <div key={s.id} className="lm-osec loose">{rows}</div>;
                const open = si < 2 || s.items.some((i) => i.id === view.next);
                return (
                  <details key={s.id} className={`lm-osec is-${s.status || "open"}`} open={open}>
                    <summary>
                      <Ic n="chev" className="lm-ic-in lm-chev" />
                      <span className="lm-osec-t">
                        <b>{s.title}</b>
                        {s.status === "locked" && s.lockReason && <small><Ic n="lock" className="lm-ic-in" />{s.lockReason}</small>}
                      </span>
                      <span className="lm-osec-m">
                        {e ? `${s.done}/${s.total || s.items.length}` : plural(s.items.length, "lesson")}
                        {s.minutes ? ` • ${fmtMinutes(s.minutes)}` : ""}
                      </span>
                    </summary>
                    {rows}
                  </details>
                );
              })}
            </div>
          </section>

          {others.length > 0 && (
            <section className="lm-block">
              <div className="lm-block-hd">
                <h2 className="lm-h2">More from {setup.brand.name}</h2>
                <Link className="lm-more" href="/learn">All courses →</Link>
              </div>
              <div className="lm-grid c-land">{others.map((o) => <CourseCard key={o.id} c={o} />)}</div>
            </section>
          )}
        </div>

        <aside className="lm-buy" aria-label="Enroll">
          <div className="lm-buy-card">
            <Cover title={c.title} src={c.coverImage} kicker={plural(pages.length, "lesson")} className="lm-buy-cover" eager />
            <div className="lm-buy-b">
              {e ? (
                <div className="lm-buy-prog">
                  <div className="lm-buy-pct"><b>{e.status === "completed" ? 100 : pct}%</b><span>{e.status === "completed" ? "complete" : `${done} of ${pages.length} lessons done`}</span></div>
                  <div className="lm-bar"><i style={{ width: `${Math.max(2, e.status === "completed" ? 100 : pct)}%` }} /></div>
                  {next && e.status !== "completed" && <p className="lm-buy-next">Next: <b>{next.title}</b>{next.duration ? ` · ${next.duration}` : ""}</p>}
                </div>
              ) : (
                <div className="lm-buy-price"><b>Free</b><span>{signInHref ? "Sign in to enroll and keep your place" : "Enroll in one click"}</span></div>
              )}
              {cta("card")}
              {preview}
              <ul className="lm-buy-list">
                <li><Ic n="check" className="lm-ic-in" />{plural(pages.length, "lesson")}{total ? `, ${fmtMinutes(total)} in all` : ""}</li>
                <li><Ic n="check" className="lm-ic-in" />{c.dueInDays ? `${c.dueInDays} days to finish` : "Learn at your own pace"}</li>
                <li><Ic n="check" className="lm-ic-in" />Pick up where you left off on any device</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

      <div className="lm-buybar">
        <div className="lm-buybar-t">
          <b>{e ? (e.status === "completed" ? "Completed" : `${pct}% complete`) : "Free"}</b>
          <span>{c.title}</span>
        </div>
        {cta("bar")}
      </div>
      <ContentPlayerRuntime />
    </div>
  );
}
