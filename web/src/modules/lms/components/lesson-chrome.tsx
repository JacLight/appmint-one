import Link from "next/link";
import { getSetup } from "@/lib/setup";
import { pagesOfOutline, type OutlineItem } from "@/modules/lms/lib/shape";
import { Ic } from "./icons";

/**
 * The lesson page's frame around the Content Player: a dark, minimal top bar (brand |
 * course | your progress) in place of the site header, and — on a phone, where the
 * player hides its outline — a "Course content" toggle that opens that outline as a
 * sheet (a checkbox, so it works before and without JavaScript). Progress is the
 * outline's own enrollment percent and done pages.
 */
export async function LessonChrome({ view, current, children }: { view: any; current: string; children: React.ReactNode }) {
  const setup = await getSetup();
  const c = view?.course || {};
  const ref = String(c.slug || c.id || "");
  const pages = pagesOfOutline((view?.items || []) as OutlineItem[]);
  const at = pages.find((p) => p.id === current);
  const done = pages.filter((p) => p.status === "done").length;
  const e = view?.enrollment;
  const pct = e?.status === "completed" ? 100 : Number(e?.percent) || 0;
  const single = pages.length <= 1;
  const ring = 2 * Math.PI * 15;
  return (
    <div className="lm-lesson">
      {!single && <input type="checkbox" id="lm-ot" className="lm-ot" aria-hidden tabIndex={-1} />}
      <header className="lm-lbar">
        <Link className="lm-lbar-brand" href="/">{setup.brand.name}</Link>
        <span className="lm-lbar-sep" aria-hidden />
        <Link className="lm-lbar-course" href={`/learn/${encodeURIComponent(ref)}`}>
          <b>{c.title}</b>
          {at?.step && !single ? <small>Lesson {at.step} of {pages.length}</small> : null}
        </Link>
        <span className="lm-grow" />
        {e && !single && (
          <span className="lm-lbar-prog" title={`${done} of ${pages.length} lessons done`}>
            <svg viewBox="0 0 36 36" width="34" height="34" aria-hidden>
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(ring * pct) / 100} ${ring}`} transform="rotate(-90 18 18)" />
            </svg>
            <span><b>{pct}%</b><small>{done}/{pages.length} done</small></span>
          </span>
        )}
        {!single && (
          <label htmlFor="lm-ot" className="lm-lbar-toc">
            <Ic n="menu" className="lm-ic-in" /><span>Contents</span>
          </label>
        )}
        <Link className="lm-lbar-exit" href={`/learn/${encodeURIComponent(ref)}`} >
          <Ic n="back" className="lm-ic-in" /><span>Overview</span>
        </Link>
      </header>
      {children}
    </div>
  );
}
