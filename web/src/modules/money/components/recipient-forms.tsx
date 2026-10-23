"use client";

import { useEffect, useState } from "react";
import {
  addRecipientAction,
  lookupMemberAction,
  lookupRoutingAction,
} from "../actions/banking";
import type { AccountType, MemberLookup, Recipient } from "../api/types";
import { isValidRouting } from "../lib/format";
import { Icon } from "./icons";
import { StepUpDialog } from "./step-up";

/** Add someone at another bank: name, routing + account number, account type.
 *  Saving needs the security code (new payees are where fraud happens). */
export function ExternalRecipientForm({
  engine = false,
  sample,
  onSaved,
  onCancel,
  submitLabel = "Save recipient",
}: {
  engine?: boolean;
  sample?: boolean;
  onSaved: (r: Recipient) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [routing, setRouting] = useState("");
  const [bankName, setBankName] = useState<string | null>(null);
  const [acct, setAcct] = useState("");
  const [acct2, setAcct2] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [err, setErr] = useState<{ msg: string; field?: string } | null>(null);
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);

  const rn = routing.replace(/\D/g, "");
  const rnBad = rn.length === 9 && !isValidRouting(rn);
  useEffect(() => {
    setBankName(null);
    if (engine || rn.length !== 9 || !isValidRouting(rn)) return;
    let live = true;
    lookupRoutingAction(rn).then((r) => {
      if (live && r.ok && r.data.valid) setBankName(r.data.bankName);
    });
    return () => {
      live = false;
    };
  }, [rn, engine]);

  const digits = acct.replace(/\D/g, "");
  const mismatch = acct2.length > 0 && acct2.replace(/\D/g, "") !== digits;

  const check = () => {
    if (!name.trim())
      return (
        setErr({
          msg: "Add the account holder’s name, as the bank has it.",
          field: "name",
        }),
        false
      );
    if (!isValidRouting(rn))
      return (
        setErr({
          msg: "Routing numbers are 9 digits. Check the number on their check or banking app.",
          field: "routingNumber",
        }),
        false
      );
    if (digits.length < 4 || digits.length > 17)
      return (
        setErr({
          msg: "Account numbers are 4 to 17 digits.",
          field: "accountNumber",
        }),
        false
      );
    if (digits !== acct2.replace(/\D/g, ""))
      return (
        setErr({
          msg: "The account numbers don’t match.",
          field: "accountNumber2",
        }),
        false
      );
    setErr(null);
    return true;
  };

  return (
    <form
      className="mn-subform"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!check()) return;
        if (!engine) return setStepUp(true);
        setBusy(true);
        const result = await addRecipientAction({
          kind: "external",
          name: name.trim(),
          nickname: nickname.trim() || undefined,
          routingNumber: rn,
          accountNumber: digits,
          accountType: type,
        });
        setBusy(false);
        if (result.ok) onSaved(result.data);
        else setErr({ msg: result.error, field: result.field });
      }}
    >
      <div className={`mn-field${err?.field === "name" ? " invalid" : ""}`}>
        <label htmlFor="rc-name">Account holder’s name</label>
        <input
          id="rc-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          placeholder="Full name or business name"
        />
      </div>
      <div className="mn-row2">
        <div
          className={`mn-field${
            err?.field === "routingNumber" || rnBad ? " invalid" : ""
          }`}
        >
          <label htmlFor="rc-rn">Routing number</label>
          <input
            id="rc-rn"
            value={routing}
            onChange={(e) =>
              setRouting(e.target.value.replace(/[^\d]/g, "").slice(0, 9))
            }
            inputMode="numeric"
            placeholder="9 digits"
            autoComplete="off"
          />
          {bankName ? (
            <span className="ok">
              <Icon name="check" size={14} />
              {bankName}
            </span>
          ) : rnBad ? (
            <span className="bad">That routing number isn’t valid.</span>
          ) : (
            <span className="hint">
              The first 9 digits on the bottom of a check.
            </span>
          )}
        </div>
        <div className="mn-field">
          <label htmlFor="rc-type">Account type</label>
          <select
            id="rc-type"
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
          >
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
          </select>
        </div>
      </div>
      <div className="mn-row2">
        <div
          className={`mn-field${
            err?.field === "accountNumber" ? " invalid" : ""
          }`}
        >
          <label htmlFor="rc-acct">Account number</label>
          <input
            id="rc-acct"
            value={acct}
            onChange={(e) =>
              setAcct(e.target.value.replace(/[^\d]/g, "").slice(0, 17))
            }
            inputMode="numeric"
            autoComplete="off"
            type="password"
            placeholder="4–17 digits"
          />
        </div>
        <div
          className={`mn-field${
            err?.field === "accountNumber2" || mismatch ? " invalid" : ""
          }`}
        >
          <label htmlFor="rc-acct2">Confirm account number</label>
          <input
            id="rc-acct2"
            value={acct2}
            onChange={(e) =>
              setAcct2(e.target.value.replace(/[^\d]/g, "").slice(0, 17))
            }
            inputMode="numeric"
            autoComplete="off"
            placeholder="Type it again"
          />
          {mismatch && <span className="bad">Doesn’t match yet.</span>}
        </div>
      </div>
      <div className="mn-field">
        <label htmlFor="rc-nick">
          Nickname <span className="mn-muted">(optional)</span>
        </label>
        <input
          id="rc-nick"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="e.g. Rent, Mom"
          maxLength={30}
        />
      </div>
      {err && (
        <div className="mn-formerr" role="alert">
          <Icon name="alert" size={16} />
          {err.msg}
        </div>
      )}
      <div className="mn-actions" style={{ marginTop: 6 }}>
        {onCancel && (
          <button type="button" className="btn ghost sm" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn clay sm" disabled={busy}>
          <Icon name="lock" size={15} />
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
      {stepUp && (
        <StepUpDialog
          action="add_recipient"
          title="Confirm new recipient"
          body={`You’re adding ${name.trim()}${
            bankName ? ` at ${bankName}` : ""
          }.`}
          confirmLabel="Add recipient"
          sample={sample}
          onCancel={() => setStepUp(false)}
          onConfirm={async (proof) => {
            const r = await addRecipientAction(
              {
                kind: "external",
                name: name.trim(),
                nickname: nickname.trim() || undefined,
                routingNumber: rn,
                accountNumber: digits,
                accountType: type,
              },
              proof
            );
            if (r.ok) {
              setStepUp(false);
              onSaved(r.data);
            } else if (!r.code.startsWith("STEP_UP"))
              setErr({ msg: r.error, field: r.field });
            return r;
          }}
        />
      )}
    </form>
  );
}

/** Find someone at this bank by @handle, email or phone, then save them. */
export function MemberRecipientForm({
  bank,
  onSaved,
  onCancel,
}: {
  bank: string;
  onSaved: (r: Recipient) => void;
  onCancel?: () => void;
}) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<MemberLookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const find = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setErr(null);
    setFound(null);
    const r = await lookupMemberAction(q.trim());
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    if (!r.data.found)
      return setErr(
        `No one at ${bank} matches “${q.trim()}”. Check the spelling, or send to their bank account instead.`
      );
    setFound(r.data);
  };
  const save = async () => {
    setBusy(true);
    const r = await addRecipientAction({ kind: "internal", lookup: q.trim() });
    setBusy(false);
    if (r.ok) onSaved(r.data);
    else setErr(r.error);
  };

  return (
    <div className="mn-subform">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          find();
        }}
        className="mn-field"
      >
        <label htmlFor="mb-q">Their @handle, email or phone</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            id="mb-q"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setFound(null);
            }}
            placeholder="@name, name@email.com or phone"
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn ghost sm"
            disabled={busy || !q.trim()}
          >
            {busy && !found ? "Finding…" : "Find"}
          </button>
        </div>
        <span className="hint">
          Money to someone at {bank} arrives instantly, any day.
        </span>
      </form>
      {found?.found && (
        <div className="mn-found">
          <span
            className="mn-av person"
            style={{ width: 42, height: 42, background: "#e3ecf7" }}
          >
            {(found.name || "?")
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)}
          </span>
          <span>
            <b>{found.name}</b>
            <small>
              {found.handle} · {bank} member
            </small>
          </span>
          <button
            type="button"
            className="btn clay sm"
            onClick={save}
            disabled={busy}
          >
            {busy ? "Adding…" : "Choose"}
          </button>
        </div>
      )}
      {err && (
        <div className="mn-formerr" role="alert">
          <Icon name="alert" size={16} />
          {err}
        </div>
      )}
      {onCancel && (
        <div className="mn-actions" style={{ marginTop: 0 }}>
          <button type="button" className="btn ghost sm" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
