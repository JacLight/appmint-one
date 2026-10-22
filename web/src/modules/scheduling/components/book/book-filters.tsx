"use client";

import { useContext } from "react";
import { Ic } from "../bits";
import { PendingCtx, PendingLink } from "./pending";

export interface FilterOption { value: string; label: string; href: string }

/** The search row on top of the booking page: what it's for, who with, which week. Each
 *  choice is a link the server worked out; picking one loads it in place. */
export function BookFilters({ reasonLabel, reasons, reason, whoLabel, people, who, week, prev, next }: {
  reasonLabel: string; reasons: FilterOption[]; reason: string;
  whoLabel: string; people: FilterOption[]; who: string;
  week: string; prev?: string; next: string;
}) {
  const { go, pending } = useContext(PendingCtx);
  const pick = (list: FilterOption[]) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const o = list.find((x) => x.value === e.target.value);
    if (o) go(o.href);
  };
  return (
    <div className={`bf${pending ? " is-busy" : ""}`}>
      <label className="bf-f">
        <span>{reasonLabel}</span>
        <select value={reason} onChange={pick(reasons)}>
          {reasons.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="bf-f">
        <span>{whoLabel}</span>
        <select value={who} onChange={pick(people)}>
          {people.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <div className="bf-week">
        <span>Week of</span>
        <div>
          {prev ? <PendingLink href={prev} className="bk-wk" aria-label="Earlier days"><Ic n="back" size={16} /></PendingLink> : <span className="bk-wk off"><Ic n="back" size={16} /></span>}
          <b>{week}</b>
          <PendingLink href={next} className="bk-wk" aria-label="Later days"><Ic n="arrow" size={16} /></PendingLink>
        </div>
      </div>
    </div>
  );
}
