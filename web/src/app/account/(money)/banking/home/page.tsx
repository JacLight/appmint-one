import type { Metadata } from "next";
import Link from "next/link";
import { getSetup } from "@/lib/setup";
import { load } from "@/modules/money/api/adapter";
import { Balance, CardArt, ErrorPanel, PersonAvatar, Sparkline, StatusChip } from "@/modules/money/components/bits";
import { Icon } from "@/modules/money/components/icons";
import { TxList } from "@/modules/money/components/tx-list";
import { QuickActions } from "@/modules/money/components/quick-actions";
import { ACCOUNT_TYPE_LABEL, fmt, fmtDate, greeting } from "@/modules/money/lib/format";

export const metadata: Metadata = { title: "Home" };

const B = "/account/banking";

/** Signed-in banking home: balances first, then send / receive / request, then activity. */
export default async function BankHomePage() {
  const setup = await getSetup();
  const [profile, accounts, recent, cards, requests, recipients, identity] = await Promise.all([
    load((b) => b.profile()),
    load((b) => b.listAccounts()),
    load((b) => b.listTransactions({ limit: 9 })),
    load((b) => b.listCards()),
    load((b) => b.listRequests("incoming")),
    load((b) => b.listRecipients()),
    load((b) => b.identity()),
  ]);
  // Identity check: a nudge until the bank has verified the customer. Nothing shows once it has.
  const id = identity.ok && identity.data.status !== "verified" ? identity.data : null;
  const idWaiting = id ? id.accountsWaiting.length : 0;
  if (!accounts.ok) return <ErrorPanel error={accounts.error} title="We couldn’t load your accounts" />;
  const { items, total } = accounts.data;
  const first = profile.ok ? profile.data.firstName : "";
  const card = cards.ok ? cards.data.find((c) => c.form === "physical") || cards.data[0] : undefined;
  const waiting = requests.ok ? requests.data.filter((r) => r.status === "open") : [];
  const people = recipients.ok ? recipients.data.slice(0, 5) : [];

  return (
    <div className="mn-home">
      <div className="mn-hello">
        <div>
          <p className="mn-hello-date">{fmtDate(new Date().toISOString(), { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1>{greeting()}{first ? `, ${first}` : ""}</h1>
        </div>
        <form action={`${B}/transactions`} className="mn-search" role="search">
          <Icon name="search" size={17} />
          <input name="q" placeholder="Search transactions" aria-label="Search transactions" />
        </form>
      </div>

      {id && (
        <Link href={`${B}/identity`} className={`mn-verify${id.status === "submitted" || id.status === "in_review" ? " wait" : ""}`}>
          <Icon name={id.status === "submitted" || id.status === "in_review" ? "clock" : "shield"} size={22} />
          <span>
            <b>{id.status === "not_started" ? "Verify your identity" : id.status === "needs_info" ? "The bank needs something more from you" : id.status === "rejected" ? "We couldn’t verify your identity" : "We’re checking your identity"}</b>
            <span className="mn-muted">
              {id.status === "not_started" ? `About five minutes: your details and a photo of your ID.${idWaiting ? ` ${idWaiting === 1 ? "Your new account opens" : `${idWaiting} accounts open`} once you’re verified.` : ""}`
                : id.status === "needs_info" ? id.requestedInfo?.message || "Check your details and send them again."
                : id.status === "rejected" ? "Contact us to talk it through."
                : id.missing.length ? `Add ${id.missing.length === 1 ? "the last item" : `${id.missing.length} more items`} to finish.` : "Most checks finish within one business day."}
            </span>
          </span>
          <span className="btn clay sm">{id.status === "not_started" ? "Start" : id.status === "needs_info" ? "Respond" : "View"}</span>
        </Link>
      )}

      <QuickActions />

      <div className="mn-grid2">
        <section className="mn-panel mn-total">
          <div className="mn-panel-hd"><span>Total balance</span><span className="mn-muted">{items.length} {items.length === 1 ? "account" : "accounts"}</span></div>
          <Balance value={total.available} className="xl" />
          {total.last30Days && (
            <div className="mn-flows">
              <span className="in"><Icon name="receive" size={15} />{fmt(total.last30Days.moneyIn)} <em>in</em></span>
              <span className="out"><Icon name="sendUp" size={15} />{fmt(total.last30Days.moneyOut)} <em>out</em></span>
              <span className="mn-muted">Last 30 days</span>
            </div>
          )}
          {total.balanceHistory && <Sparkline points={total.balanceHistory} height={96} />}
        </section>

        <section className="mn-panel">
          <div className="mn-panel-hd"><span>Accounts</span><Link href={`${B}/accounts`} className="mn-link">View all</Link></div>
          <ul className="mn-acclist">
            {items.map((a) => (
              <li key={a.id}>
                <Link href={`${B}/accounts/${a.id}`}>
                  <span className={`mn-acc-ic ${a.type}`}><Icon name={a.type === "savings" ? "piggy" : "bank"} size={18} /></span>
                  <span className="mn-acc-name"><b>{a.nickname || a.name}</b><span>{ACCOUNT_TYPE_LABEL[a.type]} ••{a.mask}{a.apy ? ` · ${a.apy.toFixed(2)}% APY` : ""}</span></span>
                  <span className="mn-acc-bal"><Balance value={a.balances.available} />{a.balances.pending && a.balances.pending.amount > 0 ? <span className="mn-muted">{fmt(a.balances.pending)} pending</span> : <span className="mn-muted">Available</span>}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mn-acc-foot">
            <Link href={`${B}/receive`} className="mn-link"><Icon name="receive" size={15} />Account &amp; routing numbers</Link>
            <Link href={`${B}/statements`} className="mn-link"><Icon name="statement" size={15} />Statements</Link>
          </div>
        </section>
      </div>

      <div className="mn-grid-main">
        <section className="mn-panel">
          <div className="mn-panel-hd"><span>Recent activity</span><Link href={`${B}/transactions`} className="mn-link">See all</Link></div>
          {recent.ok ? (
            recent.data.items.length ? <TxList items={recent.data.items} accounts={items} showAccount compact /> : (
              <div className="mn-empty"><b>No transactions yet</b><p>Share your account details to get paid, or move money in from another bank.</p><Link className="btn clay sm" href={`${B}/receive`}>Get your account details</Link></div>
            )
          ) : <ErrorPanel error={recent.error} />}
        </section>

        <aside className="mn-side">
          {waiting.length > 0 && (
            <section className="mn-panel mn-waiting">
              <div className="mn-panel-hd"><span>Waiting on you</span><Link href={`${B}/request`} className="mn-link">Requests</Link></div>
              {waiting.slice(0, 3).map((r) => (
                <Link key={r.id} href={`${B}/request#${r.id}`} className="mn-wait">
                  <PersonAvatar name={r.counterparty?.name || "Request"} size={36} />
                  <span><b>{r.counterparty?.name || "Someone"} requested {fmt(r.amount)}</b><span className="mn-muted">{r.memo || "Request"} · {fmtDate(r.createdAt)}</span></span>
                  <Icon name="chev" size={16} />
                </Link>
              ))}
            </section>
          )}

          {card && (
            <section className="mn-panel">
              <div className="mn-panel-hd"><span>Card</span><StatusChip status={card.status} /></div>
              <Link href={`${B}/cards`} className="mn-cardtile">
                <CardArt card={card} brand={setup.brand.name} small />
                <span>
                  <b>{card.form === "virtual" ? "Virtual card" : "Debit card"} ••{card.last4}</b>
                  {card.spentThisMonth && <span className="mn-muted">{fmt(card.spentThisMonth)} spent this month</span>}
                  <span className="mn-link">{card.status === "frozen" ? "Unfreeze or manage" : "Freeze, limits and more"}</span>
                </span>
              </Link>
            </section>
          )}

          {people.length > 0 && (
            <section className="mn-panel">
              <div className="mn-panel-hd"><span>Send again</span><Link href={`${B}/recipients`} className="mn-link">Recipients</Link></div>
              <div className="mn-people">
                {people.map((p, i) => (
                  <Link key={p.id} href={`${B}/send/${p.kind}?to=${p.id}`}>
                    <PersonAvatar name={p.name} size={46} tone={i} />
                    <span>{(p.nickname || p.name).split(" ")[0]}</span>
                  </Link>
                ))}
                <Link href={`${B}/send`} className="add"><span className="mn-av add"><Icon name="plus" size={20} /></span><span>New</span></Link>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
