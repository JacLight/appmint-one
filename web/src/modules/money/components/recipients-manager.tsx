"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  confirmPayeeVerificationAction,
  startPayeeVerificationAction,
  removeRecipientAction,
  updateRecipientAction,
} from "../actions/banking";
import type { Recipient, RecipientKind } from "../api/types";
import { parseAmount, fmtDate } from "../lib/format";
import { PersonAvatar } from "./bits";
import { Icon } from "./icons";
import { ExternalRecipientForm, MemberRecipientForm } from "./recipient-forms";

/** Saved people and accounts you send money to. */
export function RecipientsManager({
  recipients: initial,
  bank,
  sample,
  engine = false,
}: {
  recipients: Recipient[];
  bank: string;
  sample: boolean;
  engine?: boolean;
}) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [tab, setTab] = useState<RecipientKind>("external");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [nick, setNick] = useState("");
  const [removing, setRemoving] = useState<Recipient | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const shown = list.filter(
    (r) =>
      r.kind === tab &&
      (!q ||
        `${r.name} ${r.nickname || ""} ${r.internal?.handle || ""} ${
          r.external?.bankName || ""
        }`
          .toLowerCase()
          .includes(q.toLowerCase()))
  );
  const saved = (r: Recipient) => {
    setList((x) => [r, ...x.filter((y) => y.id !== r.id)]);
    setAdding(false);
    router.refresh();
  };

  return (
    <section className="mn-panel">
      <div className="mn-rhead">
        <div className="mn-seg" role="tablist">
          <button
            type="button"
            aria-pressed={tab === "external"}
            onClick={() => {
              setTab("external");
              setAdding(false);
            }}
          >
            Other banks · {list.filter((r) => r.kind === "external").length}
          </button>
          {!engine && (
            <button
              type="button"
              aria-pressed={tab === "internal"}
              onClick={() => {
                setTab("internal");
                setAdding(false);
              }}
            >
              At {bank} · {list.filter((r) => r.kind === "internal").length}
            </button>
          )}
        </div>
        <div
          className="mn-search"
          style={{ minWidth: 0, flex: 1, maxWidth: 280 }}
        >
          <Icon name="search" size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search recipients"
            aria-label="Search recipients"
          />
        </div>
        {engine && <Link className="btn ghost sm" href="/account/banking/send/internal">Pay an opted-in member</Link>}
        {!adding && (
          <button
            type="button"
            className="btn clay sm"
            onClick={() => setAdding(true)}
          >
            <Icon name="plus" size={16} />
            Add recipient
          </button>
        )}
      </div>

      {adding && (
        <div className="mn-addbox">
          <h3>
            {tab === "external"
              ? "Add someone at another bank"
              : `Add someone at ${bank}`}
          </h3>
          {tab === "external" ? (
            <ExternalRecipientForm
              engine={engine}
              sample={sample}
              onSaved={saved}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <MemberRecipientForm
              bank={bank}
              onSaved={saved}
              onCancel={() => setAdding(false)}
            />
          )}
        </div>
      )}

      {err && (
        <div className="mn-formerr" role="alert">
          <Icon name="alert" size={16} />
          {err}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="mn-empty">
          <b>
            {q
              ? "No one matches"
              : tab === "external"
              ? "No bank recipients yet"
              : `No one from ${bank} saved yet`}
          </b>
          <p>
            {tab === "external"
              ? "Save a name with a routing and account number to pay them in a couple of taps."
              : "Save people by @handle and pay them instantly."}
          </p>
        </div>
      ) : (
        <ul className="mn-rlist">
          {shown.map((r, i) => (
            <li key={r.id}>
              <div className="mn-rrow">
                <PersonAvatar name={r.name} tone={i} />
                <span>
                  {editing === r.id ? (
                    <form
                      style={{ display: "flex", gap: 6 }}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setBusy(true);
                        const res = await updateRecipientAction(r.id, nick);
                        setBusy(false);
                        if (res.ok) {
                          setList((x) =>
                            x.map((y) => (y.id === r.id ? res.data : y))
                          );
                          setEditing(null);
                        } else setErr(res.error);
                      }}
                    >
                      <input
                        className="mn-input"
                        style={{ padding: "7px 10px", fontSize: 14 }}
                        value={nick}
                        onChange={(e) => setNick(e.target.value)}
                        placeholder="Nickname"
                        maxLength={30}
                        autoFocus
                      />
                      <button className="btn clay xs" disabled={busy}>
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn ghost xs"
                        onClick={() => setEditing(null)}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <b>{r.nickname ? `${r.nickname} · ${r.name}` : r.name}</b>
                  )}
                  <small>
                    {r.kind === "external"
                      ? `${r.external!.bankName} · ${
                          r.external!.accountType === "savings"
                            ? "Savings"
                            : "Checking"
                        } ••${r.external!.accountMask} · Routing ${
                          r.external!.routingNumber
                        }`
                      : `${r.internal!.handle}`}
                    {r.lastSentAt
                      ? ` · last paid ${fmtDate(r.lastSentAt, {
                          month: "short",
                          day: "numeric",
                        })}`
                      : " · not paid yet"}
                  </small>
                </span>
                <span className="mn-rrow-acts">
                  {(!engine || r.verificationStatus === "verified") && (
                    <Link
                      className="btn ghost xs"
                      href={`/account/banking/send/${r.kind}?to=${r.id}`}
                    >
                      Send
                    </Link>
                  )}
                  {engine && (
                    <small>
                      {r.verificationStatus === "pending"
                        ? "Verification requested; bank processing required"
                        : r.verificationStatus}
                    </small>
                  )}
                  {engine && r.verificationStatus !== "verified" && (
                    <button
                      type="button"
                      className="btn ghost xs"
                      disabled={busy}
                      onClick={async () => {
                        setErr(null);
                        let result;
                        if (r.verificationStatus === "pending") {
                          const first = window.prompt(
                            "First deposit amount in dollars, for example 0.12"
                          );
                          if (first === null) return;
                          const second = window.prompt(
                            "Second deposit amount in dollars"
                          );
                          if (second === null) return;
                          const a = parseAmount(first),
                            b = parseAmount(second);
                          if (!a || !b || a > 99 || b > 99) {
                            setErr(
                              "Enter the two deposit amounts under one dollar."
                            );
                            return;
                          }
                          setBusy(true);
                          result = await confirmPayeeVerificationAction(r.id, [
                            a,
                            b,
                          ]);
                        } else {
                          setBusy(true);
                          result = await startPayeeVerificationAction(r.id);
                        }
                        setBusy(false);
                        if (result.ok) {
                          setList((rows) =>
                            rows.map((row) =>
                              row.id === r.id ? result.data : row
                            )
                          );
                          router.refresh();
                        } else setErr(result.error);
                      }}
                    >
                      {r.verificationStatus === "pending"
                        ? "Confirm amounts"
                        : "Request verification"}
                    </button>
                  )}
                  {!engine && (
                    <button
                      type="button"
                      className="mn-iconbtn"
                      aria-label={`Rename ${r.name}`}
                      onClick={() => {
                        setEditing(r.id);
                        setNick(r.nickname || "");
                      }}
                    >
                      <Icon name="edit" size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="mn-iconbtn danger"
                    aria-label={`Remove ${r.name}`}
                    onClick={() => setRemoving(r)}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {removing && (
        <div className="mn-dialog-bg" onClick={() => setRemoving(null)}>
          <div
            className="mn-dialog"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className="mn-dialog-ic"
              style={{
                background: "var(--mn-bad-soft)",
                color: "var(--mn-bad)",
              }}
            >
              <Icon name="trash" size={22} />
            </span>
            <h2>Remove {removing.nickname || removing.name}?</h2>
            <p>
              The saved recipient is removed. Past payments remain in your
              history. Check any pending payments separately.
            </p>
            <div className="mn-actions">
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setRemoving(null)}
              >
                Keep
              </button>
              <button
                type="button"
                className="btn clay sm"
                style={{ background: "var(--mn-bad)" }}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const res = await removeRecipientAction(removing.id);
                  setBusy(false);
                  if (res.ok) {
                    setList((x) => x.filter((y) => y.id !== removing.id));
                    setRemoving(null);
                    router.refresh();
                  } else {
                    setErr(res.error);
                    setRemoving(null);
                  }
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
