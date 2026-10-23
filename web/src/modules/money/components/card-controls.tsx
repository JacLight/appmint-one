"use client";

import { useState } from "react";
import Link from "next/link";
import {
  setPersonalCardLimitsAction,
  freezeCardAction,
  setCardLimitsAction,
} from "../actions/banking";
import type { Account, Card } from "../api/types";
import { parseAmount, accountLabel, fmt, fmtDate } from "../lib/format";
import { CardArt, StatusChip } from "./bits";
import { Icon } from "./icons";
import { BankCardLifecycle } from "./account-servicing";
import { StepUpDialog } from "./step-up";

const STEP = 5000; // $50 slider steps

/** Freeze / unfreeze and daily limits for the customer's cards. */
export function CardControls({
  cards: initial,
  accounts,
  brand,
  sample,
  engine = false,
}: {
  cards: Card[];
  accounts: Account[];
  brand: string;
  sample: boolean;
  engine?: boolean;
}) {
  const [cards, setCards] = useState(initial);
  const [id, setId] = useState(initial[0]?.id);
  const card = cards.find((c) => c.id === id) || cards[0];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const savedLimits = (c: Card) => ({
    p: c.limits.purchasesDaily.limit?.amount ?? 0,
    a: c.limits.atmDaily.limit?.amount ?? 0,
  });
  const [draft, setDraft] = useState<{ p: number; a: number }>(
    savedLimits(card)
  );
  const [stepUp, setStepUp] = useState(false);

  const replace = (c: Card) =>
    setCards((xs) => xs.map((x) => (x.id === c.id ? c : x)));
  const pick = (c: Card) => {
    setId(c.id);
    setErr(null);
    setNote(null);
    setDraft(savedLimits(c));
  };
  const frozen = card.status === "frozen";
  const acct = accounts.find((a) => a.id === card.accountId);
  const editable = card.limitsEditable !== false;
  const canFreeze =
    card.freezeEditable !== false && (card.status === "active" || frozen);
  const dirty =
    draft.p !== savedLimits(card).p || draft.a !== savedLimits(card).a;

  const toggle = async () => {
    if (!canFreeze) return;
    setBusy(true);
    setErr(null);
    setNote(null);
    const r = await freezeCardAction(card.id, !frozen);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    replace(r.data);
    setNote(
      r.data.status === "frozen"
        ? "Card frozen. New purchases and ATM use are declined until you unfreeze it."
        : "Card unfrozen. Your existing limits and restrictions still apply."
    );
  };

  const limit = (
    label: string,
    k: "p" | "a",
    l: Card["limits"]["purchasesDaily"]
  ) => {
    if (!editable || !l.limit || !l.max)
      return (
        <div className="mn-limit">
          <div className="mn-limit-hd">
            <b>{label}</b>
            <span>{l.limit ? fmt(l.limit) : "No daily cap recorded"}</span>
          </div>
          {l.used && <div className="mn-muted">{fmt(l.used)} used today</div>}
        </div>
      );
    if (l.max.amount <= 0)
      return (
        <div className="mn-limit">
          <div className="mn-limit-hd">
            <b>{label}</b>
            <span className="mn-muted">Not available on this card</span>
          </div>
        </div>
      );
    const pct = Math.min(
      100,
      l.limit.amount && l.used ? (l.used.amount / l.limit.amount) * 100 : 0
    );
    return (
      <div className="mn-limit">
        <div className="mn-limit-hd">
          <b>{label}</b>
          <span className="mn-bal" style={{ fontSize: 18 }}>
            {fmt(draft[k])}
          </span>
        </div>
        <input
          className="mn-range"
          type="range"
          min={0}
          max={l.max.amount}
          step={STEP}
          value={draft[k]}
          aria-label={label}
          onChange={(e) =>
            setDraft((d) => ({ ...d, [k]: Number(e.target.value) }))
          }
        />
        <div className="mn-avail">
          <span>$0</span>
          <span>Up to {fmt(l.max)}</span>
        </div>
        {l.used && (
          <>
            <div className="mn-meter" aria-hidden>
              <i style={{ width: `${pct}%` }} />
            </div>
            <div className="mn-muted">{fmt(l.used)} used today</div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="mn-cards">
      <div>
        {cards.length > 1 && (
          <div className="mn-cardpick" role="tablist">
            {cards.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={c.id === card.id}
                className={`mn-opt${c.id === card.id ? " on" : ""}`}
                style={{ width: "auto" }}
                onClick={() => pick(c)}
              >
                <span>
                  <b>
                    {c.form === "virtual" ? "Virtual" : "Debit"} ••{c.last4}
                  </b>
                  <small>
                    <StatusChip status={c.status} />
                  </small>
                </span>
              </button>
            ))}
          </div>
        )}
        <CardArt card={card} brand={brand} />
        <dl className="mn-dl" style={{ marginTop: 18, maxWidth: 380 }}>
          <dt>Status</dt>
          <dd>
            <StatusChip status={card.status} />
          </dd>
          <dt>Linked to</dt>
          <dd>{acct ? accountLabel(acct) : "—"}</dd>
          <dt>Expires</dt>
          <dd>
            {card.expMonth && card.expYear
              ? `${String(card.expMonth).padStart(2, "0")}/${card.expYear}`
              : "Not issued"}
          </dd>
          {card.spentThisMonth && (
            <>
              <dt>Spent this month</dt>
              <dd>{fmt(card.spentThisMonth)}</dd>
            </>
          )}
          <dt>Issued</dt>
          <dd>
            {fmtDate(card.issuedAt, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </dd>
        </dl>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minWidth: 0,
        }}
      >
        <section className="mn-panel">
          <div className="mn-toggle">
            <span>
              <b>{frozen ? "Card is frozen" : "Freeze card"}</b>
              <small>
                {frozen
                  ? "Purchases, ATM use and online payments are declined. Refunds still come in."
                  : "Misplaced it? Freeze it in a tap — unfreeze any time."}
              </small>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={frozen}
              aria-label="Freeze card"
              className="mn-switch"
              onClick={toggle}
              disabled={busy || !canFreeze}
            />
          </div>
          {note && (
            <div className="mn-notice" style={{ marginTop: 4 }}>
              <Icon name={frozen ? "snow" : "check"} size={16} />
              {note}
            </div>
          )}
        </section>

        <section className="mn-panel">
          <div className="mn-panel-hd">
            <span>Daily limits</span>
            {dirty && (
              <button
                type="button"
                className="mn-link as-btn"
                onClick={() => setDraft(savedLimits(card))}
              >
                Reset
              </button>
            )}
          </div>
          {engine ? (
            <PersonalLimits key={card.id} card={card} onSaved={replace} />
          ) : (
            <>
              {limit("Purchases per day", "p", card.limits.purchasesDaily)}
              {limit("ATM cash per day", "a", card.limits.atmDaily)}
            </>
          )}
          {err && (
            <div className="mn-formerr" role="alert">
              <Icon name="alert" size={16} />
              {err}
            </div>
          )}
          {!editable && (
            <p className="mn-muted">
              Contact the bank to change your card limits.
            </p>
          )}
          {editable && !engine && (
            <div className="mn-actions" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn clay sm"
                disabled={!dirty || busy}
                onClick={() => setStepUp(true)}
              >
                <Icon name="lock" size={15} />
                Save limits
              </button>
            </div>
          )}
        </section>

        {engine && <BankCardLifecycle key={card.id} card={card} />}
        <section className="mn-panel">
          <div className="mn-panel-hd">
            <span>Something wrong?</span>
          </div>
          <div className="mn-help" style={{ marginTop: 6 }}>
            <Link className="btn ghost sm" href="/account/support">
              <Icon name="alert" size={15} />
              Report lost or stolen
            </Link>
            <Link className="btn ghost sm" href="/account/messages">
              Replace this card
            </Link>
            <Link
              className="btn ghost sm"
              href={`/account/banking/transactions?q=${card.last4}`}
            >
              Card transactions
            </Link>
          </div>
        </section>
      </div>

      {stepUp && editable && (
        <StepUpDialog
          action="card_limits"
          title="Confirm new limits"
          body={`Purchases ${fmt(draft.p)} a day, ATM ${fmt(draft.a)} a day.`}
          confirmLabel="Save limits"
          sample={sample}
          onCancel={() => setStepUp(false)}
          onConfirm={async (proof) => {
            const input: { purchasesDaily?: number; atmDaily?: number } = {};
            if (draft.p !== savedLimits(card).p) input.purchasesDaily = draft.p;
            if (draft.a !== savedLimits(card).a) input.atmDaily = draft.a;
            const r = await setCardLimitsAction(card.id, input, proof);
            if (r.ok) {
              replace(r.data);
              setStepUp(false);
              setNote("New limits saved. They apply straight away.");
              setErr(null);
            } else if (!r.code.startsWith("STEP_UP")) setErr(r.error);
            return r;
          }}
        />
      )}
    </div>
  );
}

function PersonalLimits({
  card,
  onSaved,
}: {
  card: Card;
  onSaved: (card: Card) => void;
}) {
  const [field, setField] = useState("dailySpend");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const names = {
    perTransaction: "Per purchase",
    dailySpend: "Daily spending",
    dailyAtm: "Daily ATM cash",
  };
  const save = async (value: number | null) => {
    setBusy(true);
    setError("");
    const result = await setPersonalCardLimitsAction(card.id, {
      [field]: value,
    });
    setBusy(false);
    if (result.ok) {
      onSaved(result.data);
      setAmount("");
      setSaved(true);
    } else setError(result.error);
  };
  return (
    <div>
      <dl className="mn-dl">
        {Object.entries(names).map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>
              {card.controls?.[key] == null
                ? "No fixed limit"
                : fmt(card.controls[key])}
            </dd>
          </div>
        ))}
      </dl>
      {card.bankLimits ? (
        <form
          className="mn-subform"
          onSubmit={(event) => {
            event.preventDefault();
            const cents = parseAmount(amount);
            const ceiling = card.bankLimits?.[field];
            if (
              cents == null ||
              cents < 0 ||
              (typeof ceiling === "number" && cents > ceiling)
            ) {
              setError("Enter a nonnegative amount within the bank’s limit.");
              return;
            }
            void save(cents);
          }}
        >
          <label>
            Personal limit
            <select
              className="mn-input"
              value={field}
              disabled={busy}
              onChange={(event) => {
                setField(event.target.value);
                setAmount("");
                setSaved(false);
                setError("");
              }}
            >
              {Object.entries(names).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p className="mn-muted">
            Bank limit:{" "}
            {card.bankLimits[field] == null
              ? "No fixed ceiling"
              : fmt(card.bankLimits[field])}
            . A personal limit cannot override a lower bank limit.
          </p>
          <label>
            Amount
            <input
              className="mn-input"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setSaved(false);
              }}
              disabled={busy}
            />
          </label>
          {error && (
            <p className="mn-formerr" role="alert">
              {error}
            </p>
          )}
          {saved && <p role="status">Personal limit saved.</p>}
          <div className="mn-actions">
            <button className="btn clay sm" disabled={busy}>
              Save personal limit
            </button>
            <button
              type="button"
              className="btn ghost sm"
              disabled={busy}
              onClick={() => save(null)}
            >
              Use bank limit
            </button>
          </div>
        </form>
      ) : (
        <p className="mn-muted">
          Contact the bank to change limits on this connection.
        </p>
      )}
    </div>
  );
}
