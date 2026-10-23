import type { Metadata } from "next";
import { BankError } from "@/modules/money/api/types";
import { load } from "@/modules/money/api/adapter";
import { BankHead, ErrorPanel } from "@/modules/money/components/bits";
import { ServicingButton } from "@/modules/money/components/servicing-actions";
import { fmt, fmtDate } from "@/modules/money/lib/format";
export const metadata: Metadata = { title: "My disputes" };
export default async function DisputesPage() {
  const result = await load((api) => {
    if (!api.listDisputes)
      throw new BankError(
        "UNAVAILABLE",
        "Dispute tracking is unavailable in this connection."
      );
    return api.listDisputes();
  });
  return (
    <>
      <BankHead
        title="My disputes"
        sub="Track your claims and the bank’s responses."
      />
      {!result.ok ? (
        <ErrorPanel error={result.error} />
      ) : !result.data.length ? (
        <div className="mn-empty">
          <b>No disputes</b>
          <p>Claims filed from a transaction appear here.</p>
        </div>
      ) : (
        result.data.map((claim) => (
          <section
            className="mn-panel"
            key={claim.id}
            style={{ marginBottom: 16 }}
          >
            <h3>Dispute {claim.number || claim.id}</h3>
            <dl className="mn-dl">
              <dt>Status</dt>
              <dd>{claim.status}</dd>
              <dt>Amount</dt>
              <dd>{fmt({ amount: claim.amount, currency: "USD" })}</dd>
              <dt>Reason</dt>
              <dd>{claim.reason?.replaceAll("_", " ")}</dd>
              {claim.decideBy && (
                <>
                  <dt>Decision due</dt>
                  <dd>{fmtDate(claim.decideBy)}</dd>
                </>
              )}
              {claim.resolveBy && (
                <>
                  <dt>Resolution due</dt>
                  <dd>{fmtDate(claim.resolveBy)}</dd>
                </>
              )}
            </dl>
            <p>{claim.description}</p>
            {claim.resolution && <p>{claim.resolution}</p>}
            {(claim.notices || []).map((notice: any, index: number) => (
              <p className="mn-muted" key={index}>
                {notice.kind} · {fmtDate(notice.sentAt)} · {notice.channel}
              </p>
            ))}
            {!["won", "lost", "withdrawn"].includes(claim.status) && (
              <ServicingButton kind="withdraw-dispute" id={claim.id}>
                Withdraw dispute
              </ServicingButton>
            )}
          </section>
        ))
      )}
    </>
  );
}
