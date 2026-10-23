"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Account, Card } from "../api/types";
import {
  activateBankCardAction,
  openBankAccountAction,
  orderBankCardAction,
  renameBankAccountAction,
  replaceBankCardAction,
  setBankOverdraftAction,
} from "../actions/banking";
import { accountLabel } from "../lib/format";

export function BankAccountOpening({ products }: { products: any[] }) {
  const router = useRouter();
  const [product, setProduct] = useState(products[0]?.sk || "");
  const [nickname, setNickname] = useState("");
  const [business, setBusiness] = useState(
    products[0]?.holderType === "business"
  );
  const [legalName, setLegalName] = useState("");
  const [ein, setEin] = useState("");
  const [entityType, setEntityType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = products.find((item) => item.sk === product);
  if (!products.length) return null;
  return (
    <details className="mn-panel" style={{ marginTop: 16 }}>
      <summary>Open another account</summary>
      <form
        className="mn-subform"
        onSubmit={async (event) => {
          event.preventDefault();
          const tax = ein.replaceAll("-", "").trim();
          if (business && (!legalName.trim() || (tax && !/^\d{9}$/.test(tax))))
            return setError(
              "Enter the legal business name and, if supplied, a 9-digit EIN."
            );
          setBusy(true);
          setError("");
          const result = await openBankAccountAction({
            product,
            nickname: nickname.trim() || undefined,
            ...(business
              ? {
                  business: {
                    legalName: legalName.trim(),
                    ...(tax ? { ein: tax } : {}),
                    ...(entityType.trim()
                      ? { entityType: entityType.trim() }
                      : {}),
                  },
                }
              : {}),
          });
          setBusy(false);
          if (!result.ok) return setError(result.error);
          const record = result.data?.account || result.data;
          router.refresh();
          if (record?.sk)
            router.push(
              `/account/banking/accounts/${encodeURIComponent(record.sk)}`
            );
        }}
      >
        <label>
          Product
          <select
            className="mn-input"
            value={product}
            onChange={(event) => {
              setProduct(event.target.value);
              const next = products.find(
                (item) => item.sk === event.target.value
              );
              if (next?.holderType === "business") setBusiness(true);
              if (next?.holderType === "individual") setBusiness(false);
            }}
          >
            {products.map((item) => (
              <option key={item.sk} value={item.sk}>
                {item.title || item.name}
              </option>
            ))}
          </select>
        </label>
        {selected?.description && <p>{selected.description}</p>}
        <label>
          Nickname (optional)
          <input
            className="mn-input"
            value={nickname}
            maxLength={40}
            onChange={(event) => setNickname(event.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={business}
            disabled={!!selected?.holderType && selected.holderType !== "any"}
            onChange={(event) => setBusiness(event.target.checked)}
          />{" "}
          Business account
        </label>
        {business && (
          <>
            <label>
              Business legal name
              <input
                className="mn-input"
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
                required
              />
            </label>
            <label>
              EIN (optional)
              <input
                className="mn-input"
                value={ein}
                onChange={(event) => setEin(event.target.value)}
              />
            </label>
            <label>
              Entity type (optional)
              <input
                className="mn-input"
                value={entityType}
                onChange={(event) => setEntityType(event.target.value)}
              />
            </label>
            <p className="mn-muted">
              The bank verifies the business before the account opens.
            </p>
          </>
        )}
        {error && (
          <p className="mn-formerr" role="alert">
            {error}
          </p>
        )}
        <button className="btn clay sm" disabled={busy || !product}>
          {busy ? "Requesting…" : "Request account opening"}
        </button>
      </form>
    </details>
  );
}

export function BankAccountPreferences({ account }: { account: Account }) {
  const router = useRouter();
  const [nickname, setNickname] = useState(account.nickname || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <details className="mn-panel" style={{ marginBottom: 16 }}>
      <summary>Account settings</summary>
      <form
        className="mn-subform"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          const result = await renameBankAccountAction(
            account.id,
            nickname.trim()
          );
          setBusy(false);
          if (!result.ok) setError(result.error);
          else {
            setSaved(true);
            router.refresh();
          }
        }}
      >
        <label>
          Nickname
          <input
            className="mn-input"
            value={nickname}
            maxLength={40}
            onChange={(event) => {
              setNickname(event.target.value);
              setSaved(false);
            }}
          />
        </label>
        <button className="btn ghost sm" disabled={busy}>
          Save nickname
        </button>
      </form>
      {account.overdraft && (
        <label>
          <input
            type="checkbox"
            checked={account.overdraft.optedIn}
            disabled={busy}
            onChange={async (event) => {
              const value = event.target.checked;
              if (
                !window.confirm(
                  value
                    ? "Allow card and ATM overdrafts? Fees may apply."
                    : "Turn off card and ATM overdraft opt-in?"
                )
              )
                return;
              setBusy(true);
              setError("");
              const result = await setBankOverdraftAction(account.id, value);
              setBusy(false);
              if (!result.ok) setError(result.error);
              else router.refresh();
            }}
          />{" "}
          Allow card and ATM overdrafts (fees may apply)
        </label>
      )}
      {error && (
        <p className="mn-formerr" role="alert">
          {error}
        </p>
      )}
      {saved && <p role="status">Account settings saved.</p>}
    </details>
  );
}

function ShippingFields({
  address,
  onChange,
}: {
  address: Record<string, string>;
  onChange: (address: Record<string, string>) => void;
}) {
  return (
    <>
      {Object.entries({
        street1: "Street address",
        city: "City",
        state: "State or region",
        zip: "Postal code",
        country: "Country code",
      }).map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            className="mn-input"
            value={address[key] || ""}
            required
            onChange={(event) =>
              onChange({ ...address, [key]: event.target.value })
            }
          />
        </label>
      ))}
    </>
  );
}

export function BankCardOrder({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [account, setAccount] = useState(accounts[0]?.id || "");
  const [form, setForm] = useState("virtual");
  const [address, setAddress] = useState<Record<string, string>>({
    country: "US",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  if (!accounts.length) return null;
  return (
    <details className="mn-panel" style={{ marginBottom: 16 }}>
      <summary>Request a card</summary>
      <form
        className="mn-subform"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          setNotice("");
          const result = await orderBankCardAction(account, {
            form,
            ...(form === "physical" ? { shipping: { address } } : {}),
          });
          setBusy(false);
          if (!result.ok) setError(result.error);
          else {
            setNotice(
              "Card order requested. The bank must issue it before it can be used."
            );
            router.refresh();
          }
        }}
      >
        <label>
          Account
          <select
            className="mn-input"
            value={account}
            onChange={(event) => setAccount(event.target.value)}
          >
            {accounts.map((item) => (
              <option key={item.id} value={item.id}>
                {accountLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Card type
          <select
            className="mn-input"
            value={form}
            onChange={(event) => setForm(event.target.value)}
          >
            <option value="virtual">Virtual — bank issuance required</option>
            <option value="physical">
              Physical — bank issuance and shipping required
            </option>
          </select>
        </label>
        {form === "physical" && (
          <ShippingFields address={address} onChange={setAddress} />
        )}
        {error && (
          <p className="mn-formerr" role="alert">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        <button className="btn clay sm" disabled={busy}>
          {busy ? "Requesting…" : "Request card"}
        </button>
      </form>
    </details>
  );
}

export function BankCardLifecycle({ card }: { card: Card }) {
  const router = useRouter();
  const [last4, setLast4] = useState("");
  const [why, setWhy] = useState("lost");
  const [address, setAddress] = useState<Record<string, string>>({
    country: "US",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const complete = (result: { ok: boolean; error?: string }, text: string) => {
    setBusy(false);
    if (!result.ok)
      setError(result.error || "The bank could not confirm this request.");
    else {
      setNotice(text);
      router.refresh();
    }
  };
  return (
    <section className="mn-panel">
      {card.issuanceStatus === "shipped" && (
        <form
          className="mn-subform"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!/^\d{4}$/.test(last4))
              return setError("Enter the last four digits on your card.");
            setBusy(true);
            setError("");
            complete(
              await activateBankCardAction(card.id, last4),
              "Card activated."
            );
          }}
        >
          <h3>Activate this card</h3>
          <label>
            Last four digits
            <input
              className="mn-input"
              inputMode="numeric"
              value={last4}
              maxLength={4}
              onChange={(event) => setLast4(event.target.value)}
              required
            />
          </label>
          <button className="btn clay sm" disabled={busy}>
            Activate
          </button>
        </form>
      )}
      {!["lost", "stolen", "closed", "expired"].includes(
        card.issuanceStatus || ""
      ) && (
        <details>
          <summary>
            Report lost, stolen or damaged / request replacement
          </summary>
          <form
            className="mn-subform"
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                !window.confirm(
                  "Confirm this report? The old card will be stopped. The replacement requires bank issuance."
                )
              )
                return;
              setBusy(true);
              setError("");
              complete(
                await replaceBankCardAction(
                  card.id,
                  why,
                  card.form === "physical" ? { address } : undefined
                ),
                "Report recorded and replacement requested. The new card requires bank issuance."
              );
            }}
          >
            <label>
              Reason
              <select
                className="mn-input"
                value={why}
                onChange={(event) => setWhy(event.target.value)}
              >
                <option value="lost">Lost</option>
                <option value="stolen">Stolen</option>
                <option value="damaged">Damaged</option>
              </select>
            </label>
            {card.form === "physical" && (
              <ShippingFields address={address} onChange={setAddress} />
            )}
            <button className="btn ghost sm" disabled={busy}>
              Report and request replacement
            </button>
          </form>
        </details>
      )}
      {error && (
        <p className="mn-formerr" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
