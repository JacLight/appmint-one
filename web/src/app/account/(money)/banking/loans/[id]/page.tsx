import { BankAutopay } from "@/modules/money/components/bank-autopay";
import { BankError } from "@/modules/money/api/types";
import { load } from "@/modules/money/api/adapter";
import { BankHead, ErrorPanel } from "@/modules/money/components/bits";
import { LoanPayment } from "@/modules/money/components/servicing-actions";
import { runtimeEnv } from "@/lib/runtime-env";
import { fmt } from "@/modules/money/lib/format";
export default async function LoanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await load(async (api) => {
    if (!api.loan)
      throw new BankError(
        "UNAVAILABLE",
        "Loan servicing is unavailable in this connection."
      );
    return {
      loan: await api.loan(id),
      accounts: (await api.listAccounts()).items,
      customer: (await api.profile()).customerId,
    };
  });
  if (!result.ok)
    return (
      <>
        <BankHead title="Loan" />
        <ErrorPanel error={result.error} />
      </>
    );
  const { loan, accounts, customer } = result.data;
  return (
    <>
      <BankHead
        title={loan.number || "Loan"}
        sub={loan.statusText || loan.status}
        back={{ href: "/account/banking/loans", label: "Loans" }}
      />
      <section className="mn-panel">
        <dl className="mn-dl">
          {Object.entries({
            owed: "Total owed",
            principal: "Principal",
            interest: "Interest",
            fees: "Fees",
          }).map(([key, label]) =>
            (key === "owed" ? loan.owed : loan.balances?.[key]) != null ? (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  {fmt({
                    amount: key === "owed" ? loan.owed : loan.balances[key],
                    currency: "USD",
                  })}
                </dd>
              </div>
            ) : null
          )}
        </dl>
        <a
          className="btn ghost sm"
          href={`/account/banking/documents/payoff/${encodeURIComponent(id)}`}
        >
          Download payoff PDF
        </a>
      </section>
      {loan.actions?.pay && (
        <section className="mn-panel" style={{ marginTop: 16 }}>
          <LoanPayment
            scope={JSON.stringify([runtimeEnv("ORG_ID"), customer])}
            loan={id}
            accounts={accounts.filter((account) => account.status === "open")}
          />
        </section>
      )}
      <BankAutopay loan={id} accounts={accounts} />
      <section className="mn-panel" style={{ marginTop: 16 }}>
        <h3>Payment history</h3>
        {(loan.payments || []).map((payment: any) => (
          <p key={payment.sk || payment.id}>
            {payment.effectiveDate || payment.postedAt} ·{" "}
            {fmt({ amount: payment.amount, currency: "USD" })}
          </p>
        ))}
      </section>
    </>
  );
}
