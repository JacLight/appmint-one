import Link from "next/link";
import type { Unit } from "../lib/types";
import { availability, money, psf, unitSize } from "../lib/format";

/** A building's commercial spaces, the way a broker's availability sheet lists them:
 *  suite, size, rate, lease type, when it's free. Leased suites stay listed, greyed. */
export function SuiteTable({ units }: { units: Unit[] }) {
  const rows = [...units].sort((a, b) => Number(b.available) - Number(a.available) || (b.sqft ?? 0) - (a.sqft ?? 0));
  return (
    <table className="pm-units">
      <thead><tr><th>Space</th><th>Size</th><th>Rate</th><th>Available</th><th /></tr></thead>
      <tbody>
        {rows.map((u) => (
          <tr key={u.id} className={u.available ? "" : "leased"}>
            <td><b>{u.title}</b><span className="sub">{[u.typeLabel, u.condition].filter(Boolean).join(" · ")}</span></td>
            <td>{unitSize(u)}{u.floor != null && <span className="sub">Floor {u.floor}</span>}</td>
            <td><b>{psf(u.ratePsf)}</b><span className="sub">{u.leaseType || ""}{u.rent != null ? `${u.leaseType ? " · " : ""}${money(u.rent)}/mo base` : ""}</span></td>
            <td>{u.available ? availability(u) : "Leased"}</td>
            <td className="act">
              {u.available ? (
                <>
                  <Link className="btn ghost xs" href={`/homes/${u.id}`}>Details</Link>
                  <Link className="btn clay xs" href={`/apply/${u.id}`}>Apply</Link>
                </>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
