"use client";
import { useBankVerification } from "./bank-verification";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateLoanApplicationAction,
  attachLoanDocumentAction,
  respondToLoanConditionAction,
  applyForLoanAction,
  answerLoanCounterofferAction,
  cancelTransactionAction,
  fileDisputeAction,
  payLoanAction,
  withdrawDisputeAction,
  withdrawLoanApplicationAction,
} from "../actions/banking";
import type { Account } from "../api/types";
import { accountLabel, parseAmount } from "../lib/format";

export function ServicingButton({
  kind,
  id,
  children,
}: {
  kind:
    | "withdraw-dispute"
    | "withdraw-application"
    | "accept-offer"
    | "decline-offer"
    | "cancel-payment";
  id: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const verification = useBankVerification();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <span>
      <button
        type="button"
        className="btn ghost sm"
        disabled={busy}
        onClick={async () => {
          if (
            !window.confirm(
              kind === "withdraw-dispute"
                ? "Withdraw this dispute? Any provisional credit may be taken back."
                : "Confirm this change?"
            )
          )
            return;
          setBusy(true);
          setError("");
          let auth: Record<string, unknown> | undefined;
          try {
            if (kind === "withdraw-dispute" || kind === "cancel-payment") {
              const operation = kind === "withdraw-dispute" ? "dispute_withdraw" : "cancel";
              const idempotencyKey = await verification.keyFor(JSON.stringify([operation, id]));
              const bankingProof = await verification.confirm(operation, { id, idempotencyKey });
              auth = { idempotencyKey, bankingProof };
            }
          } catch (error) { setBusy(false); setError(error instanceof Error ? error.message : "Confirmation failed."); return; }
          const result = await (kind === "withdraw-dispute"
            ? withdrawDisputeAction(id, auth)
            : kind === "withdraw-application"
            ? withdrawLoanApplicationAction(id)
            : kind === "cancel-payment"
            ? cancelTransactionAction(id, auth)
            : answerLoanCounterofferAction(id, kind === "accept-offer"));
          setBusy(false);
          if (result.ok) router.refresh();
          else setError(result.error);
        }}
      >
        {busy ? "Saving…" : children}
      </button>
      {error && (
        <span role="alert" className="mn-formerr">
          {error}
        </span>
      )}
    </span>
  );
}

const REASONS = {
  unauthorized: "I did not authorize it",
  not_received: "Goods or services not received",
  duplicate: "Charged twice",
  wrong_amount: "Wrong amount",
  cancelled_recurring: "Cancelled recurring payment",
  not_as_described: "Not as described",
  atm_cash_not_received: "ATM cash not received",
  other: "Something else",
};
export function FileDispute({ transaction }: { transaction: string }) {
  const router = useRouter();
  const verification = useBankVerification();
  const [reason, setReason] = useState("unauthorized");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  if (done)
    return (
      <p role="status">
        Dispute filed. Track it in{" "}
        <a className="mn-link" href="/account/banking/disputes">
          My disputes
        </a>
        .
      </p>
    );
  return (
    <form
      className="mn-subform"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const result = await fileDisputeAction({
          transaction,
          reason,
          description: description.trim(),
        });
        setBusy(false);
        if (result.ok) {
          setDone(true);
          router.refresh();
        } else setError(result.error);
      }}
    >
      <h3>Report a problem with this transaction</h3>
      <label>
        Reason
        <select
          className="mn-input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          {Object.entries(REASONS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        What happened
        <textarea
          className="mn-input"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {error && (
        <p className="mn-formerr" role="alert">
          {error}
        </p>
      )}
      <button className="btn ghost sm" disabled={busy}>
        {busy ? "Filing…" : "File dispute"}
      </button>
    </form>
  );
}

/** Uses the existing customer payment endpoint. An unresolved exact intent
 * retains its key across navigation/reload in this browser tab; pending is never called paid.
 */
export function LoanPayment({
  loan,
  accounts,
  scope,
}: {
  loan: string;
  accounts: Account[];
  scope: string;
}) {
  const router = useRouter();
  const verification = useBankVerification();
  const [from, setFrom] = useState(accounts[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const intents = useRef(new Map<string, string>());
  return (
    <form
      className="mn-subform"
      onSubmit={async (event) => {
        event.preventDefault();
        const cents = parseAmount(amount);
        if (!cents || cents < 1)
          return setError("Enter a valid payment amount.");
        setBusy(true);
        setError("");
        const intent = JSON.stringify([scope, loan, from, cents]);
        let storageKey: string;
        let key: string;
        try {
          // Persist only a one-way intent fingerprint and random recovery key.
          // Account identifiers, amounts and customer data are never stored here.
          const hash = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(intent)
          );
          storageKey = `banking-loan-payment:${Array.from(
            new Uint8Array(hash),
            (b) => b.toString(16).padStart(2, "0")
          ).join("")}`;
          key =
            sessionStorage.getItem(storageKey) ||
            intents.current.get(intent) ||
            crypto.randomUUID();
          sessionStorage.setItem(storageKey, key);
          intents.current.set(intent, key);
        } catch {
          setBusy(false);
          setError(
            "Payment not sent: browser recovery storage is unavailable. Try again when it is available."
          );
          return;
        }
        let bankingProof: string | undefined;
        try { bankingProof = await verification.confirm("loan_payment", { id: loan, from, amount: cents, idempotencyKey: key }); }
        catch (error) { setBusy(false); setError(error instanceof Error ? error.message : "Confirmation failed."); return; }
        const result = await payLoanAction(loan, {
          from,
          amount: cents,
          idempotencyKey: key,
          bankingProof,
        });
        setBusy(false);
        if (!result.ok) {
          setError(
            `${result.error} Retrying unchanged details checks the same request. Check activity before changing details.`
          );
          return;
        }
        const transaction = result.data?.transaction || result.data;
        const data = transaction?.data || transaction;
        const state = data?.status;
        if (state === "posted") {
          try {
            sessionStorage.removeItem(storageKey!);
          } catch {}
          intents.current.delete(intent);
          setStatus("Payment posted.");
          router.refresh();
        } else if (state === "pending" || state === "in_review") {
          setStatus(
            "Payment is pending. It has not been confirmed as paid. Check this request again before starting another payment."
          );
          router.refresh();
        } else if (
          ["failed", "cancelled", "returned", "reversed"].includes(state)
        ) {
          try {
            sessionStorage.removeItem(storageKey!);
          } catch {}
          intents.current.delete(intent);
          setError(`This payment is ${state}.`);
        } else
          setError(
            "No payment confirmation was received. Check activity; retrying unchanged details uses the same request."
          );
      }}
    >
      <h3>Make a payment</h3>
      <label>
        From
        <select
          className="mn-input"
          value={from}
          disabled={busy || !!status}
          onChange={(e) => setFrom(e.target.value)}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {accountLabel(account)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Amount
        <input
          className="mn-input"
          inputMode="decimal"
          value={amount}
          disabled={busy || !!status}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </label>
      {error && (
        <p className="mn-formerr" role="alert">
          {error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      <button
        className="btn clay sm"
        disabled={busy || !from || status === "Payment posted."}
      >
        {busy ? "Checking…" : status ? "Check payment" : "Pay from my account"}
      </button>
    </form>
  );
}

export function LoanApplicationForm({
  products,
  accounts,
}: {
  products: any[];
  accounts: Account[];
}) {
  const router = useRouter();
  const verification = useBankVerification();
  const [product, setProduct] = useState(products[0]?.sk || "");
  const [from, setFrom] = useState(accounts[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [term, setTerm] = useState("");
  const [income, setIncome] = useState("");
  const [purpose, setPurpose] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = products.find((item) => item.sk === product);
  return (
    <form
      className="mn-subform"
      onSubmit={async (event) => {
        event.preventDefault();
        const cents = parseAmount(amount);
        const gross = parseAmount(income);
        const months = Number(term);
        if (
          !cents ||
          !gross ||
          !Number.isSafeInteger(months) ||
          months < 1 ||
          !consent
        )
          return setError(
            "Enter a valid amount, term and monthly income, and consent to the credit check."
          );
        setBusy(true);
        setError("");
        const result = await applyForLoanAction({
          product,
          amount: cents,
          termMonths: months,
          purpose: purpose.trim(),
          income: { grossMonthly: gross },
          linkedAccount: from,
          consentToCreditCheck: true,
        });
        setBusy(false);
        if (result.ok) {
          router.push(
            `/account/banking/loans/applications/${encodeURIComponent(
              result.data.sk
            )}`
          );
          router.refresh();
        } else setError(result.error);
      }}
    >
      <label>
        Loan product
        <select
          className="mn-input"
          value={product}
          onChange={(event) => setProduct(event.target.value)}
        >
          {products.map((item) => (
            <option key={item.sk} value={item.sk}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      {selected?.description && <p>{selected.description}</p>}
      {selected?.disclosure && <p>{selected.disclosure}</p>}
      {selected?.example?.text && <p>{selected.example.text}</p>}
      <label>
        Requested amount
        <input
          className="mn-input"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </label>
      <label>
        Term in months
        <input
          className="mn-input"
          inputMode="numeric"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          required
        />
      </label>
      <label>
        Purpose
        <input
          className="mn-input"
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
          required
        />
      </label>
      <label>
        Gross monthly income
        <input
          className="mn-input"
          inputMode="decimal"
          value={income}
          onChange={(event) => setIncome(event.target.value)}
          required
        />
      </label>
      <label>
        My account for disbursement
        <select
          className="mn-input"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {accountLabel(account)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          required
        />{" "}
        I authorize the bank to obtain my credit report for this application.
      </label>
      {error && (
        <p className="mn-formerr" role="alert">
          {error}
        </p>
      )}
      <button
        className="btn clay sm"
        disabled={busy || !from || !product || !consent}
      >
        {busy ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}

/** Applicant evidence enters the bank's existing review, never clears conditions. */
export function ApplicationServicing({ application: a }: { application: any }) {
  const router = useRouter();
  const verification = useBankVerification();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dollars = (value: unknown) =>
    typeof value === "number" ? (value / 100).toFixed(2) : "";
  const [amount, setAmount] = useState(dollars(a.request?.amount));
  const [term, setTerm] = useState(String(a.request?.termMonths || ""));
  const [purpose, setPurpose] = useState(a.request?.purpose || "");
  const [income, setIncome] = useState(dollars(a.mine?.income?.grossMonthly));
  const [responses, setResponses] = useState<Record<number, string>>({});
  const complete = (
    result: { ok: boolean; error?: string },
    message: string
  ) => {
    setBusy(false);
    if (!result.ok)
      setError(result.error || "The bank could not save this. Try again.");
    else {
      setNotice(message);
      router.refresh();
    }
  };
  const upload = async (file: File | undefined, condition?: number) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Choose a file under 10 MB.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const extension = (file.name.split(".").pop() || "bin")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const location = `banking/loan-applications/${a.sk}`;
      const name = `${crypto.randomUUID()}.${extension}`;
      const data = new FormData();
      data.append("file", new File([file], name, { type: file.type }));
      data.append("location", location);
      const response = await fetch("/api/client-data/files/upload", {
        method: "POST",
        body: data,
      });
      if (!response.ok) throw new Error("The file did not upload. Try again.");
      const document = { path: `${location}/${name}` };
      const result =
        condition === undefined
          ? await attachLoanDocumentAction(a.sk, document)
          : await respondToLoanConditionAction(a.sk, condition, {
              documents: [document],
            });
      complete(result, "Evidence submitted for the bank to review.");
    } catch (failure) {
      setBusy(false);
      setError(
        failure instanceof Error ? failure.message : "The upload failed."
      );
    }
  };
  return (
    <section className="mn-panel" style={{ marginTop: 16 }}>
      {a.actions?.edit && (
        <form
          className="mn-subform"
          onSubmit={async (event) => {
            event.preventDefault();
            const cents = parseAmount(amount),
              salary = parseAmount(income),
              months = Number(term);
            if (
              !cents ||
              !salary ||
              !Number.isSafeInteger(months) ||
              months <= 0
            ) {
              setError("Enter valid amounts and a whole number of months.");
              return;
            }
            const changes: Record<string, unknown> = {};
            if (cents !== a.request?.amount) changes.amount = cents;
            if (months !== a.request?.termMonths) changes.termMonths = months;
            if (purpose.trim() !== a.request?.purpose)
              changes.purpose = purpose.trim();
            if (salary !== a.mine?.income?.grossMonthly)
              changes.income = {
                grossMonthly: salary,
                ...(a.mine?.income?.source
                  ? { source: a.mine.income.source }
                  : {}),
              };
            if (!Object.keys(changes).length) {
              setNotice("No changes to save.");
              return;
            }
            setBusy(true);
            setError("");
            setNotice("");
            complete(
              await updateLoanApplicationAction(a.sk, changes),
              "Corrections submitted. The bank may need to verify updated information."
            );
          }}
        >
          <h3>Correct my application</h3>
          <label>
            Requested amount
            <input
              className="mn-input"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          <label>
            Term in months
            <input
              className="mn-input"
              inputMode="numeric"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              required
            />
          </label>
          <label>
            Purpose
            <input
              className="mn-input"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              required
            />
          </label>
          <label>
            Gross monthly income
            <input
              className="mn-input"
              inputMode="decimal"
              value={income}
              onChange={(event) => setIncome(event.target.value)}
              required
            />
          </label>
          <button className="btn ghost sm" disabled={busy}>
            Save corrections
          </button>
        </form>
      )}
      {a.actions?.uploadDocuments && (
        <p>
          <label className="btn ghost sm">
            Add supporting document
            <input
              type="file"
              hidden
              accept="image/*,.pdf"
              disabled={busy}
              onChange={(event) => {
                void upload(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </p>
      )}
      {(a.supportingDocuments || []).map((document: any, index: number) => (
        <p className="mn-muted" key={index}>
          {document.kind?.replaceAll("_", " ") || "Supporting document"} ·
          Submitted {document.submittedAt}
          {document.conditionIndex != null
            ? ` · Condition ${document.conditionIndex + 1}`
            : ""}
        </p>
      ))}
      {(a.conditions || [])
        .filter((condition: any) => condition.respond)
        .map((condition: any) => (
          <div key={condition.index} className="mn-subform">
            <h3>{condition.text}</h3>
            <textarea
              className="mn-input"
              value={responses[condition.index] || ""}
              maxLength={2000}
              aria-label={`Response to ${condition.text}`}
              onChange={(event) =>
                setResponses((previous) => ({
                  ...previous,
                  [condition.index]: event.target.value,
                }))
              }
            />
            <div className="mn-actions">
              <button
                type="button"
                className="btn ghost sm"
                disabled={busy || !responses[condition.index]?.trim()}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  setNotice("");
                  complete(
                    await respondToLoanConditionAction(a.sk, condition.index, {
                      text: responses[condition.index].trim(),
                    }),
                    "Response submitted for review. The bank still needs to clear the condition."
                  );
                }}
              >
                Submit response
              </button>
              <label className="btn ghost sm">
                Attach evidence
                <input
                  type="file"
                  hidden
                  accept="image/*,.pdf"
                  disabled={busy}
                  onChange={(event) => {
                    void upload(event.target.files?.[0], condition.index);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        ))}
      {error && (
        <p className="mn-formerr" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
