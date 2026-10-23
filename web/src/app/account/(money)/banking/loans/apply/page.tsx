import { BankError } from "@/modules/money/api/types";
import { load } from "@/modules/money/api/adapter";
import { BankHead, ErrorPanel } from "@/modules/money/components/bits";
import { LoanApplicationForm } from "@/modules/money/components/servicing-actions";
export default async function ApplyPage() {
  const result = await load(async (api) => {
    if (!api.loanProducts)
      throw new BankError(
        "UNAVAILABLE",
        "Online applications are unavailable in this connection."
      );
    return {
      products: await api.loanProducts(),
      accounts: (await api.listAccounts()).items,
    };
  });
  return (
    <>
      <BankHead
        title="Apply for a loan"
        back={{ href: "/account/banking/loans", label: "Loans" }}
      />
      {!result.ok ? (
        <ErrorPanel error={result.error} />
      ) : (
        <section className="mn-panel">
          {result.data.products.filter(
            (product) => product.canApplyOnline !== false
          ).length ? (
            <LoanApplicationForm
              products={result.data.products.filter(
                (product) => product.canApplyOnline !== false
              )}
              accounts={result.data.accounts.filter(
                (account) => account.status === "open"
              )}
            />
          ) : (
            <p>
              No products are currently offered for online application. Contact
              the bank.
            </p>
          )}
        </section>
      )}
    </>
  );
}
