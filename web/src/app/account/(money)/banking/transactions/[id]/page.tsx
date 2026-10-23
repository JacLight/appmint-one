import type { Metadata } from "next";
import Link from "next/link";
import { load } from "@/modules/money/api/adapter";
import {
  BankHead,
  ErrorPanel,
  Signed,
  StatusChip,
  TxAvatar,
} from "@/modules/money/components/bits";
import { Icon } from "@/modules/money/components/icons";
import {
  FileDispute,
  ServicingButton,
} from "@/modules/money/components/servicing-actions";
import { PrintButton } from "@/modules/money/components/print-button";
import { TxList } from "@/modules/money/components/tx-list";
import {
  CATEGORY_LABEL,
  KIND_LABEL,
  accountLabel,
  fmt,
  fmtDateTime,
  txTitle,
} from "@/modules/money/lib/format";

const B = "/account/banking";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ account?: string }>;
}): Promise<Metadata> {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const r = await load(async (b) => b.getTransaction(id, sp.account));
  return { title: r.ok ? txTitle(r.data) : "Transaction" };
}

/** One transaction, with everything support would ask for. */
export default async function TransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ account?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const res = await load((b) => b.getTransaction(id, sp.account));
  if (!res.ok)
    return (
      <>
        <BankHead
          title="Transaction"
          back={{ href: `${B}/transactions`, label: "Transactions" }}
        />
        <ErrorPanel error={res.error} />
      </>
    );
  const t = res.data;
  const acc = await load((b) => b.getAccount(t.accountId));
  const a = acc.ok ? acc.data : null;
  const cp = t.counterparty;
  const who = cp?.name || txTitle(t);
  const hist = await load((b) =>
    b.listTransactions({
      q: who,
      limit: 7,
      from: new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10),
    })
  );
  const others = hist.ok
    ? hist.data.items.filter((x) => x.id !== t.id).slice(0, 6)
    : [];
  const resend =
    t.direction === "debit" && (t.kind === "internal" || t.kind === "ach")
      ? t.kind === "internal"
        ? "internal"
        : "external"
      : null;

  return (
    <>
      <BankHead
        title=""
        back={{
          href: a ? `${B}/accounts/${a.id}` : `${B}/transactions`,
          label: a ? a.nickname || a.name : "Transactions",
        }}
      />
      <div className="mn-txd-grid">
        <div className="mn-txd">
          <section className="mn-panel" style={{ padding: 0 }}>
            <div className="mn-txd-top">
              <TxAvatar t={t} size={56} />
              <h2>{txTitle(t)}</h2>
              <span
                className={`mn-txd-amt${t.direction === "credit" ? " in" : ""}`}
              >
                <Signed t={t} />
              </span>
              <StatusChip status={t.status} />
            </div>
            <div style={{ padding: "0 22px 8px" }}>
              <dl className="mn-dl">
                <dt>Date</dt>
                <dd>{fmtDateTime(t.createdAt)}</dd>
                {t.postedAt && (
                  <>
                    <dt>Posted</dt>
                    <dd>{fmtDateTime(t.postedAt)}</dd>
                  </>
                )}
                <dt>{t.direction === "credit" ? "To" : "From"}</dt>
                <dd>{a ? accountLabel(a) : `••`}</dd>
                {cp &&
                  (cp.type === "bank_account" ||
                    cp.type === "person" ||
                    cp.type === "own_account") && (
                    <>
                      <dt>{t.direction === "credit" ? "From" : "To"}</dt>
                      <dd>
                        {cp.name}
                        {cp.bankName ? ` · ${cp.bankName}` : ""}
                        {cp.mask ? ` ••${cp.mask}` : ""}
                      </dd>
                    </>
                  )}
                {t.cardMask && (
                  <>
                    <dt>Card</dt>
                    <dd>Debit card ••{t.cardMask}</dd>
                  </>
                )}
                {cp?.location && (
                  <>
                    <dt>Location</dt>
                    <dd>{cp.location}</dd>
                  </>
                )}
                <dt>Type</dt>
                <dd>{KIND_LABEL[t.kind]}</dd>
                <dt>Category</dt>
                <dd>{CATEGORY_LABEL[t.category]}</dd>
                {t.memo && (
                  <>
                    <dt>Note</dt>
                    <dd>{t.memo}</dd>
                  </>
                )}
                {t.statementDescriptor && (
                  <>
                    <dt>On your statement</dt>
                    <dd className="mono">{t.statementDescriptor}</dd>
                  </>
                )}
                {t.balanceAfter && (
                  <>
                    <dt>Balance after</dt>
                    <dd>{fmt(t.balanceAfter)}</dd>
                  </>
                )}
                <dt>Reference</dt>
                <dd className="mono">{t.reference}</dd>
              </dl>
            </div>
          </section>

          <section className="mn-panel" style={{ marginTop: 16 }}>
            <div className="mn-panel-hd">
              <span>Status</span>
            </div>
            <ol className="mn-timeline">
              <li>
                <b>
                  {t.kind === "card" || t.kind === "atm"
                    ? "Authorized"
                    : t.direction === "credit"
                    ? "Received"
                    : "Sent"}
                </b>
                <span>{fmtDateTime(t.createdAt)}</span>
              </li>
              <li className={t.postedAt ? "" : "wait"}>
                <b>
                  {t.postedAt ? "Posted to your account" : "Waiting to post"}
                </b>
                <span>
                  {t.postedAt
                    ? fmtDateTime(t.postedAt)
                    : t.kind === "card"
                    ? "Card purchases usually post in 1–2 business days."
                    : "Usually within one business day."}
                </span>
              </li>
            </ol>
          </section>

          {t.actions?.dispute && (
            <section className="mn-panel mn-noprint" style={{ marginTop: 16 }}>
              <FileDispute transaction={t.id} />
            </section>
          )}
          <div className="mn-help mn-noprint">
            {t.actions?.cancel && (
              <ServicingButton kind="cancel-payment" id={t.id}>
                Stop this payment
              </ServicingButton>
            )}
            <Link className="btn ghost sm" href={`${B}/disputes`}>
              My disputes
            </Link>
            {resend && (
              <Link className="btn clay sm" href={`${B}/send/${resend}`}>
                <Icon name="sendUp" size={16} />
                Send again
              </Link>
            )}
            <Link className="btn ghost sm" href="/account/support">
              <Icon name="alert" size={16} />
              Report a problem
            </Link>
            <PrintButton label="Print receipt" />
          </div>
        </div>

        <aside className="mn-side mn-noprint">
          {t.cardMask && t.direction === "debit" && (
            <section className="mn-panel mn-notyou">
              <span className="mn-notyou-ic">
                <Icon name="shield" size={20} />
              </span>
              <div>
                <b>Don’t recognize this?</b>
                <p>
                  Freeze card ••{t.cardMask} straight away, then tell us and
                  we’ll look into it.
                </p>
                <div className="mn-notyou-acts">
                  <Link className="btn clay sm" href={`${B}/cards`}>
                    Freeze card
                  </Link>
                  <Link className="btn ghost sm" href="/account/support">
                    Dispute
                  </Link>
                </div>
              </div>
            </section>
          )}
          <section className="mn-panel">
            <div className="mn-panel-hd">
              <span>{others.length ? `Earlier with ${who}` : who}</span>
              {others.length > 0 && (
                <Link
                  className="mn-link"
                  href={`${B}/transactions?q=${encodeURIComponent(
                    who
                  )}&range=all`}
                >
                  See all
                </Link>
              )}
            </div>
            {others.length ? (
              <TxList items={others} compact />
            ) : (
              <p className="mn-muted mn-small">
                This is your first transaction with {who} in the last year.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
