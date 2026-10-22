"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/alert";
import { routes } from "@/lib/nav";
import { setListingStatusAction, deleteListingAction } from "@/modules/rentals/actions/host";
import type { ListingStatus } from "@/api/rentals";

/** Quick action row for the listing dashboard. Full editing lives under /edit. */
export function ListingActions({ id, status }: { id: string; status?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setStatus(next: ListingStatus) {
    setError(null);
    start(async () => {
      const r = await setListingStatusAction(id, next);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  function del() {
    setError(null);
    start(async () => {
      const r = await deleteListingAction(id);
      if (r.ok) router.push(routes.hostListings);
      else { setError(r.error); setConfirmDelete(false); }
    });
  }

  return (
    <div style={{ marginTop: 16 }}>
      {error && <Alert kind="error" onDismiss={() => setError(null)}>{error}</Alert>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Link className="btn clay sm" href={`${routes.hostListing(id)}/edit`}>Edit listing</Link>

        {status === "active" ? (
          <button className="btn ghost sm" disabled={pending} onClick={() => setStatus("paused")}>
            {pending ? "…" : "Pause"}
          </button>
        ) : (
          <button className="btn ghost sm" disabled={pending} onClick={() => setStatus("active")}>
            {pending ? "…" : "Publish"}
          </button>
        )}

        <Link className="btn ghost sm" href={routes.listing(id)} target="_blank">View public page ↗</Link>

        <span style={{ flex: 1 }} />

        {confirmDelete ? (
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 13.5 }}>Delete this listing?</span>
            <button className="btn sm" disabled={pending} onClick={del} style={{ background: "#a5401f", color: "#fff" }}>
              {pending ? "Deleting…" : "Yes, delete"}
            </button>
            <button className="btn ghost sm" disabled={pending} onClick={() => setConfirmDelete(false)}>Cancel</button>
          </span>
        ) : (
          <button className="btn ghost sm" onClick={() => setConfirmDelete(true)} style={{ color: "#a5401f" }}>Delete</button>
        )}
      </div>
    </div>
  );
}
