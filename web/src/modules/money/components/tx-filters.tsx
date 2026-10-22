"use client";

import { useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "./icons";
import { CATEGORY_LABEL } from "../lib/format";
import type { TxCategory } from "../api/types";

export interface TxFilterState {
  q?: string; dir?: string; cat?: string; range?: string; acct?: string; status?: string;
}

const RANGES: [string, string][] = [["30", "Last 30 days"], ["90", "Last 90 days"], ["ytd", "This year"], ["all", "All time"]];

/** Search + filters for a transaction list. Lives in the URL so every view is linkable. */
export function TxFilters({ state, accounts }: { state: TxFilterState; accounts?: { id: string; label: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  const form = useRef<HTMLFormElement>(null);
  const go = (patch: Partial<TxFilterState>) => {
    const next = { ...state, ...patch };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    router.push(`${path}${p.size ? `?${p}` : ""}`);
  };
  const seg = (label: string, patch: Partial<TxFilterState>, on: boolean) => (
    <button type="button" aria-pressed={on} onClick={() => go(patch)}>{label}</button>
  );
  const dir = state.status === "pending" ? "pending" : state.dir || "";
  return (
    <div className="mn-filters">
      <form ref={form} className="mn-search" role="search" onSubmit={(e) => { e.preventDefault(); go({ q: String(new FormData(e.currentTarget).get("q") || "").trim() || undefined }); }}>
        <Icon name="search" size={17} />
        <input name="q" defaultValue={state.q || ""} placeholder="Search merchant, person, amount or reference" aria-label="Search transactions" />
      </form>
      <div className="mn-seg" role="group" aria-label="Direction">
        {seg("All", { dir: undefined, status: undefined }, dir === "")}
        {seg("Money in", { dir: "credit", status: undefined }, dir === "credit")}
        {seg("Money out", { dir: "debit", status: undefined }, dir === "debit")}
        {seg("Pending", { dir: undefined, status: "pending" }, dir === "pending")}
      </div>
      {accounts && accounts.length > 1 && (
        <select className="mn-select" aria-label="Account" value={state.acct || ""} onChange={(e) => go({ acct: e.target.value || undefined })}>
          <option value="">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      )}
      <select className="mn-select" aria-label="Category" value={state.cat || ""} onChange={(e) => go({ cat: e.target.value || undefined })}>
        <option value="">All categories</option>
        {(Object.keys(CATEGORY_LABEL) as TxCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
      </select>
      <select className="mn-select" aria-label="Date range" value={state.range || "90"} onChange={(e) => go({ range: e.target.value })}>
        {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
