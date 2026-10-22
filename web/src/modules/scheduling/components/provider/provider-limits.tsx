import { Ic } from "../bits";

/** Says plainly what this calendar can't show yet, so nobody looks for a missing button. */
export function ProviderLimits({ style }: { style: "studio" | "clinic" | "firm" }) {
  const who = style === "studio" ? "who's booked into each class" : style === "clinic" ? "patient names" : "client names";
  return (
    <p className="pv-limits"><Ic n="shield" size={15} /> This calendar shows your booked times. {who[0].toUpperCase() + who.slice(1)}, check-in and notes are kept at the front desk for now.</p>
  );
}
