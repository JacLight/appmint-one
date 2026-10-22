import Link from "next/link";
import type { CourseCard } from "@/modules/lms/lib/types";
import { courseRef, plural } from "@/modules/lms/lib/shape";
import { Cover } from "./cover";

/** A course in progress: cover, title, bar — straight back into the next lesson. */
export function ContinueRow({ c, wide = false }: { c: CourseCard; wide?: boolean }) {
  const ref = courseRef(c);
  const href = c.mine?.next ? `/learn/${ref}/${encodeURIComponent(c.mine.next)}` : `/learn/${ref}`;
  const pct = c.mine?.percent ?? 0;
  return (
    <Link className={`lm-crow${wide ? " wide" : ""}`} href={href}>
      <Cover title={c.title} src={c.coverImage} className="lm-crow-cover" />
      <div className="lm-crow-b">
        <b>{c.title}</b>
        <small>{pct}% complete · {plural(c.lessons, "lesson")}</small>
        <div className="lm-bar"><i style={{ width: `${Math.max(2, pct)}%` }} /></div>
      </div>
      <span className="lm-cta lm-crow-go">Resume</span>
    </Link>
  );
}
