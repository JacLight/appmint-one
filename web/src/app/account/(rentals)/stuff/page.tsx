import { PageTitle } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/empty-state";
import { requireSession } from "@/lib/guards";
import { routes } from "@/lib/nav";
import { stowbo, type MyItem } from "@/api/rentals";
import { fmtFull } from "@/lib/dates";

export const metadata = { title: "Your stuff" };

function stuffStatus(s: MyItem): { text: string; cls: string } {
  if (s.status === "ended" || s.checkedOutAt) return { text: "Collected", cls: "ended" };
  if (s.present) return { text: "In storage", cls: "in" };
  if (s.status === "active") return { text: "Out with you", cls: "out" };
  if (s.status === "cancelled") return { text: "Cancelled", cls: "cancelled" };
  return { text: "Awaiting drop-off", cls: "reserved" };
}

export default async function StuffPage() {
  await requireSession();
  const [stuffRaw, bookingsRes] = await Promise.all([
    stowbo.myStuff().catch(() => []),
    stowbo.myBookings().catch(() => null),
  ]);
  const stuff = stuffRaw as unknown as MyItem[];
  // Join listing code → real name from the customer's own bookings.
  const titleMap = new Map<string, string>();
  for (const b of (bookingsRes?.data ?? [])) for (const it of ((b.data as any)?.items ?? [])) if (it.listing && it.listingTitle) titleMap.set(it.listing, it.listingTitle);

  return (
    <>
      <PageTitle title="Your stuff" />
        {stuff.length === 0 ? (
          <EmptyState title="Nothing stored right now" note="Items you've dropped off appear here — with their status and where they are." ctaLabel="Find a spot →" ctaHref={routes.browse} />
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
