"use client";

import Link from "next/link";
import { useState } from "react";
import type { Unit } from "../lib/types";
import { availability, baths, beds, money, sqft } from "../lib/format";

/** A building's homes as a table, filtered by bedrooms (the Greystar availability grid).
 *  Leased homes stay listed, greyed, so the building reads as a real place. */
export function UnitTable({ units }: { units: Unit[] }) {
  const kinds = [...new Set(units.map((u) => (u.type === "room" ? -1 : u.beds)))].sort((a, b) => a - b);
  const [k, setK] = useState<number | null>(null);
  const label = (b: number) => (b === -1 ? "Rooms" : beds(b));
  const rows = units
    .filter((u) => k == null || (k === -1 ? u.type === "room" : u.type !== "room" && u.beds === k))
    .sort((a, b) => Number(b.available) - Number(a.available) || (a.rent ?? 0) - (b.rent ?? 0));
  return (
    <>
      {kinds.length > 1 && (
        <div className="pm-tabs" role="group" aria-label="Filter by bedrooms">
          <button type="button" className={`pm-chip${k == null ? " on" : ""}`} onClick={() => setK(null)}>All ({units.filter((u) => u.available).length})</button>
          {kinds.map((b) => (
            <button key={b} type="button" className={`pm-chip${k === b ? " on" : ""}`} onClick={() => setK(b)}>{label(b)}</button>
          ))}
        </div>
      )}
      <table className="pm-units">
        <thead><tr><th>Home</th><th>Layout</th><th>Rent</th><th>Move in</th><th /></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className={u.available ? "" : "leased"}>
              <td><b>{u.title}</b>{u.plan && <span className="sub">{u.plan}</span>}</td>
              <td>{u.type === "room" ? "Private room" : beds(u.beds)}{u.baths ? ` · ${baths(u.baths)}` : ""}{u.sqft ? <span className="sub">{sqft(u.sqft)}</span> : null}</td>
              <td><b>{money(u.rent)}</b><span className="sub">per month</span></td>
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
    </>
  );
}
