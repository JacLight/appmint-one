import Link from "next/link";
import type { CourseCard as Card } from "@/modules/lms/lib/types";
import { courseRef, fmtMinutes, plural } from "@/modules/lms/lib/shape";
import type { Product } from "@/modules/store/lib/types";
import { money } from "@/modules/store/lib/money";
import { listPrice, productHref, productImage } from "@/modules/store/lib/options";
import { Cover } from "./cover";

/** One published course as a cover tile: the cover (or a typographic one), title,
 *  lessons · length · quizzes, the promise, and my progress or the way in. */
export function CourseCard({ c, feature = false }: { c: Card; feature?: boolean }) {
  const time = fmtMinutes(c.minutes);
  const started = c.mine && c.mine.status !== "withdrawn";
  const done = c.mine?.status === "completed";
  const ref = courseRef(c);
  const href = started && !done && c.mine?.next ? `/learn/${ref}/${encodeURIComponent(c.mine.next)}` : `/learn/${ref}`;
  return (
    <Link className={`lm-tile${feature ? " feature" : ""}`} href={href}>
      <div className="lm-tile-ph">
        <Cover title={c.title} src={c.coverImage} kicker={plural(c.lessons, "lesson")} />
        {c.assignments > 0 && <span className="lm-tag">Teacher-reviewed</span>}
        {started && <span className="lm-tile-bar"><i style={{ width: `${Math.max(3, done ? 100 : c.mine!.percent)}%` }} /></span>}
      </div>
      <div className="lm-tile-b">
        <h3>{c.title}</h3>
        <p className="lm-tile-meta">
          {plural(c.lessons, "lesson")}
          {time && <> · {time}</>}
          {c.quizzes > 0 && <> · {plural(c.quizzes, "quiz", "quizzes")}</>}
        </p>
        {c.summary && <p className="lm-tile-sum">{c.summary}</p>}
        <p className="lm-tile-ft">
          {started ? (
            done ? <span className="ok">Completed</span> : <><span className="go">{c.mine!.percent}% complete</span><span className="lm-tile-act">Resume →</span></>
          ) : (
            <span className={c.open ? "free" : ""}>{c.open ? "Free" : "Access required"}</span>
          )}
        </p>
      </div>
    </Link>
  );
}

/** A paid course: a storefront product, opened on the Store's own product page (add to
 *  bag → the Store's checkout). The price is the engine's list price for the product. */
export function CourseProductCard({ p }: { p: Product }) {
  const img = productImage(p);
  const title = p.data.title || p.data.name || "Course";
  return (
    <Link className="lm-tile" href={productHref(p)}>
      <div className="lm-tile-ph">
        <Cover title={title} src={img || undefined} kicker="Course" />
      </div>
      <div className="lm-tile-b">
        <h3>{title}</h3>
        {p.data.description && <p className="lm-tile-sum">{p.data.description.replace(/<[^>]+>/g, "").slice(0, 160)}</p>}
        <p className="lm-tile-ft"><span className="price">{money(listPrice(p), p.data.currency || "USD")}</span><span className="lm-tile-act">View in shop →</span></p>
      </div>
    </Link>
  );
}
