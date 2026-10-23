import type { Metadata } from "next";
import Link from "next/link";
import { BankError } from "@/modules/money/api/types";
import { load } from "@/modules/money/api/adapter";
import { BankHead, ErrorPanel } from "@/modules/money/components/bits";
import { fmt } from "@/modules/money/lib/format";
export const metadata: Metadata = { title: "Loans" };
export default async function LoansPage() {
  const result = await load(async (api) => {
    if (!api.listLoans || !api.listLoanApplications)
      throw new BankError(
        "UNAVAILABLE",
        "Loan servicing is unavailable in this connection."
      );
    return {
      loans: await api.listLoans(),
      applications: await api.listLoanApplications(),
    };
  });
  return (
    <>
      <BankHead
        title="Loans"
        sub="Your balances, applications and offers."
        actions={
          <Link className="btn clay sm" href="/account/banking/loans/apply">
            Apply for a loan
          </Link>
        }
      />
      {!result.ok ? (
        <ErrorPanel error={result.error} />
      ) : (
        <>
          <section className="mn-panel">
            <h3>My loans</h3>
            {!result.data.loans.length ? (
              <p>No loans.</p>
            ) : (
              result.data.loans.map((loan) => (
                <p key={loan.sk}>
                  <Link
                    className="mn-link"
                    href={`/account/banking/loans/${encodeURIComponent(
                      loan.sk
                    )}`}
                  >
                    {loan.number || loan.product?.title || loan.sk}
                  </Link>{" "}
                  · {loan.statusText || loan.status} ·{" "}
                  {fmt({ amount: loan.owed, currency: "USD" })}
                </p>
              ))
            )}
          </section>
          <section className="mn-panel" style={{ marginTop: 16 }}>
            <h3>Applications</h3>
            {!result.data.applications.length ? (
              <p>No applications.</p>
            ) : (
              result.data.applications.map((application) => (
                <p key={application.sk}>
                  <Link
                    className="mn-link"
                    href={`/account/banking/loans/applications/${encodeURIComponent(
                      application.sk
                    )}`}
                  >
                    {application.number || application.sk}
                  </Link>{" "}
                  · {application.statusText || application.status}
                </p>
              ))
            )}
          </section>
        </>
      )}
    </>
  );
}
