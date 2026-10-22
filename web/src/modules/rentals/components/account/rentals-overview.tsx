import Link from "next/link";
import { routes } from "@/lib/nav";
import { stowbo, type MyItem } from "@/api/rentals";
import { fmtFull } from "@/lib/dates";

function stuffStatus(s: MyItem): { text: string; cls: string } {
  if (s.status === "ended" || s.checkedOutAt) return { text: "Collected", cls: "ended" };
  if (s.present) return { text: "In storage", cls: "in" };
  if (s.status === "active") return { text: "Out with you", cls: "out" };
  if (s.status === "cancelled") return { text: "Cancelled", cls: "cancelled" };
  return { text: "Awaiting drop-off", cls: "reserved" };
}

/** Rentals' slice of the account overview (from stowbo-web's overview): the count
 *  stats and the "Your stuff" list. Server component. */
export async function rentalsOverviewData() {
  const [stuffR, bookingsR] = await Promise.allSettled([stowbo.myStuff(), stowbo.myBookings()]);
  const stuff = (stuffR.status === "fulfilled" ? stuffR.value : []) as unknown as MyItem[];
  const bookings = bookingsR.status === "fulfilled" ? bookingsR.value?.data ?? [] : [];
  // Join listing code → real name from the customer's own bookings (my-stuff has
  // only the code), so a card reads "Locker 18454347", not "h02s2m8n".
  const titleMap = new Map<string, string>();
  for (const b of bookings) for (const it of ((b.data as any)?.items ?? [])) if (it.listing && it.listingTitle) titleMap.set(it.listing, it.listingTitle);
  return { stuff, bookings, titleMap };
}

export function RentalsStuffList({ stuff, titleMap }: { stuff: MyItem[]; titleMap: Map<string, string> }) {
  return (
    <>
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Your stuff</h2>
      {stuff.length === 0 ? (
        <div className="tcard" style={{ textAlign: "center", padding: "38px 20px" }}>
          <p className="muted">Nothing stored yet.</p>
          <Link className="btn clay sm" href={routes.browse} style={{ marginTop: 12 }}>Find a spot →</Link>
        </div>
      ) : (
        <div className="stf-list">
          {stuff.map((s, i) => {
            const chip = stuffStatus(s);
            const title = titleMap.get(s.listing || "") || s.label || s.identifier || "Stored item";
            const when = s.present && s.checkedInAt ? `Stored since ${fmtFull(s.checkedInAt)}`
              : s.startDate ? `${fmtFull(s.startDate)}${s.endDate ? ` → ${fmtFull(s.endDate)}` : ""}` : "";
            return (
              <div key={s.id || i} className="stf-card">
                <div className="stf-main">
                  <b className="stf-title">{title}</b>
                  <div className="stf-sub">{[s.unit ? `Unit ${s.unit}` : "", s.identifier || "", when].filter(Boolean).join(" · ")}</div>
                </div>
                <span className={`csl-status s-${chip.cls}`}>{chip.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
