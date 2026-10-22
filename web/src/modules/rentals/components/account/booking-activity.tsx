import type { TimelineEvent } from "@/api/rentals";
import { eventLabel, eventWhen, actorWord } from "@/modules/rentals/lib/custody";

/** The shared activity feed for a booking — the same events the host sees, so
 *  the two sides stay in sync: check-ins, moves in/out, extensions, charges. */
export function BookingActivity({ events }: { events: TimelineEvent[] }) {
  const rows = [...(events || [])].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  if (!rows.length) {
    return <p className="act-empty">Nothing yet — activity shows up here as your booking moves along.</p>;
  }
  return (
    <div className="act">
      {rows.map((ev, i) => {
        const { title, icon, tone } = eventLabel(ev);
        const who = actorWord(ev);
        return (
          <div className="act-row" key={ev.id || i}>
            <div className={`act-ic t-${tone}`} aria-hidden>{icon}</div>
            <div className="act-body">
              <div className="act-title">{title}</div>
              <div className="act-sub">{[who, eventWhen(ev.at)].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
