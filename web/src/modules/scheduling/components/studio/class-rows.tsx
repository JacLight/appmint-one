import Link from "next/link";
import { duration, timeParts } from "../../lib/format";
import type { ClassTime } from "../../lib/types";
import { Avatar, Img, Spots } from "../bits";

/** The timetable's rows: time, class, coach, room, spots left, Book. */
export function ClassRows({ rows, tz }: { rows: ClassTime[]; tz: string }) {
  return (
    <ol className="st-rows">
      {rows.map(({ type, coach, slot }) => {
        const [t, ap] = timeParts(slot.startTime, tz);
        const full = slot.spotsAvailable <= 0;
        const href = `/book/${type.slug}?at=${encodeURIComponent(slot.startTime)}`;
        return (
          <li key={`${type.id}-${slot.startTime}`} className={`st-row${full ? " full" : ""}`}>
            <div className="st-time"><b>{t}</b><span>{ap} · {duration(type.services[0]?.duration || 0)}</span></div>
            <Img src={type.image} alt="" className="st-thumb" w={200} />
            <div className="st-what">
              <Link href={href} className="st-name">{type.title}</Link>
              <span className="st-meta">{[type.level, type.room].filter(Boolean).join(" · ")}</span>
            </div>
            <div className="st-coach">{coach && <><Avatar m={coach} size={34} /><span>{coach.name.split(" ")[0]}</span></>}</div>
            <div className="st-left"><Spots left={slot.spotsAvailable} total={slot.spotsTotal} /></div>
            <div className="st-go">{full ? <span className="btn sm ghost" aria-disabled>Full</span> : <Link className="btn sm clay" href={href}>Book</Link>}</div>
          </li>
        );
      })}
    </ol>
  );
}
