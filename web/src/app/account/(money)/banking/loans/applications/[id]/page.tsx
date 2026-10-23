import { BankError } from "@/modules/money/api/types";
import { load } from "@/modules/money/api/adapter";
import { BankHead, ErrorPanel } from "@/modules/money/components/bits";
import {
  ApplicationServicing,
  ServicingButton,
} from "@/modules/money/components/servicing-actions";
import { fmt } from "@/modules/money/lib/format";
export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await load((api) => {
    if (!api.loanApplication)
      throw new BankError(
        "UNAVAILABLE",
        "Loan applications are unavailable in this connection."
      );
    return api.loanApplication(id);
  });
  if (!result.ok)
    return (
      <>
        <BankHead title="Application" />
        <ErrorPanel error={result.error} />
      </>
    );
  const a = result.data;
  return (
    <>
      <BankHead
        title={`Application ${a.number || ""}`}
        sub={a.statusText || a.status}
        back={{ href: "/account/banking/loans", label: "Loans" }}
      />
      <section className="mn-panel">
        <p>{a.request?.purpose}</p>
        {a.request?.amount != null && (
          <p>
            Requested {fmt({ amount: a.request.amount, currency: "USD" })} over{" "}
            {a.request.termMonths} months
          </p>
        )}
        {a.actions?.withdraw && (
          <ServicingButton kind="withdraw-application" id={id}>
            Withdraw application
          </ServicingButton>
        )}
        {a.actions?.answerCounteroffer && (
          <>
            <dl className="mn-dl">
              <dt>Offered amount</dt>
              <dd>{fmt(a.decision?.approved?.amount)}</dd>
              <dt>Term</dt>
              <dd>{a.decision?.approved?.termMonths} months</dd>
              <dt>Annual rate</dt>
              <dd>{a.decision?.approved?.rateBps / 100}%</dd>
              {a.decision?.truthInLending && (
                <>
                  <dt>APR</dt>
                  <dd>{a.decision.truthInLending.aprBps / 100}%</dd>
                  <dt>Finance charge</dt>
                  <dd>{fmt(a.decision.truthInLending.financeCharge)}</dd>
                  <dt>Total payments</dt>
                  <dd>{fmt(a.decision.truthInLending.totalOfPayments)}</dd>
                </>
              )}
            </dl>
            <ServicingButton kind="accept-offer" id={id}>
              Accept offer
            </ServicingButton>
            <ServicingButton kind="decline-offer" id={id}>
              Decline offer
            </ServicingButton>
          </>
        )}
        {a.adverseAction && (
          <>
            <h3>Decision notice</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>
              {a.adverseAction.notice || a.adverseAction.text}
            </p>
            {a.adverseAction.sentAt && (
              <a
                className="btn ghost sm"
                href={`/account/banking/documents/notice/${encodeURIComponent(
                  id
                )}`}
              >
                Download notice PDF
              </a>
            )}
          </>
        )}
        {a.conditions?.length > 0 && (
          <>
            <h3>Conditions</h3>
            <ul>
              {a.conditions.map((condition: any, index: number) => (
                <li key={index}>
                  {typeof condition === "string"
                    ? condition
                    : condition.description ||
                      condition.text ||
                      condition.title}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <ApplicationServicing application={a} />
    </>
  );
}
