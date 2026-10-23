"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Account } from "../api/types";
import { accountLabel, fmt, fmtDate, parseAmount } from "../lib/format";
import { useBankVerification } from "./bank-verification";
import { bankReceivingStatusAction, bankReceivingUpdateAction, bankMemberResolveAction, bankMemberPreviewAction, bankRequestsListAction, bankRequestGetAction, bankRequestCreateAction, bankRequestCloseAction, bankRequestShareAction, bankRequestPreviewAction, submitTransferAction } from "../actions/banking";

const eligible = (accounts: Account[]) => accounts.filter(a => a.status === "open" && a.currency === "USD" && ["checking", "savings", "money_market"].includes(a.type));
const ErrorText = ({ error }: { error: string }) => error ? <p role="alert" className="mn-error">{error}</p> : null;
const accountOptions = (accounts: Account[]) => eligible(accounts).map(a => <option key={a.id} value={a.id}>{accountLabel(a)}</option>);
const publicLink = (value: string) => new URL(value, window.location.origin).toString();

export function BankReceivingPreferences({ accounts, onSaved }: { accounts: Account[]; onSaved?: (value: any) => void }) {
  const [saved, setSaved] = useState<any>(null), [enabled, setEnabled] = useState(false), [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const refresh = async () => { setBusy(true); setError(""); try { const r = await bankReceivingStatusAction(); if (!r.ok) throw new Error(r.error); setSaved(r.data); setEnabled(r.data.enabled); setAccount(r.data.account || ""); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  useEffect(() => { void refresh(); }, []);
  const save = async () => { setBusy(true); setError(""); setNotice(""); try { const r = await bankReceivingUpdateAction({ enabled, ...(enabled ? { account } : {}), revision: saved.revision }); if (!r.ok) throw new Error(r.error); setSaved(r.data); setEnabled(r.data.enabled); setAccount(r.data.account || ""); setNotice("Receiving preferences saved."); onSaved?.(r.data); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <section className="mn-panel"><div className="mn-panel-hd"><span>Member receiving preferences</span></div>
    <p>Member lookup is private by default. Opt in only if you want another signed-in member who knows your exact username to find your member name and send money to your designated account.</p>
    <ErrorText error={error} />{!saved ? <button type="button" className="btn ghost sm" disabled={busy} onClick={refresh}>{busy ? "Loading…" : "Retry preferences"}</button> : <>
      <p>Your exact username: <strong>{saved.username || "Not configured"}</strong></p>
      <label className="mn-label"><input type="checkbox" checked={enabled} disabled={busy} onChange={e => { setEnabled(e.target.checked); setNotice(""); }} /> Allow exact-username member lookup and receiving</label>
      {enabled && <div className="mn-field"><label htmlFor="member-receiving-account">Designated receiving account</label><select id="member-receiving-account" value={account} disabled={busy} onChange={e => { setAccount(e.target.value); setNotice(""); }}><option value="">Choose an account you own</option>{accountOptions(accounts)}</select></div>}
      <p className="mn-hint">Changing or turning off this setting invalidates new confirmations using old receiving details. It does not reverse an already accepted payment.</p>
      <button type="button" className="btn clay sm" disabled={busy || (enabled && (!account || !saved.username))} onClick={save}>{busy ? "Saving…" : "Save receiving preferences"}</button>{notice && <p role="status">{notice}</p>}
    </>}
  </section>;
}

export function BankInstructionReview({ preview, onBack, onDone }: { preview: any; onBack: () => void; onDone: (result: any) => void }) {
  const { confirm, keyFor } = useBankVerification();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [attempted, setAttempted] = useState(false);
  const submit = async () => { setBusy(true); setError(""); try {
    const key = await keyFor(`member-review:${preview.previewId}`);
    const proof = await confirm("transfer", { idempotencyKey: key }, preview.previewId);
    setAttempted(true);
    const result = await submitTransferAction(preview.previewId, key, { challengeId: "", code: "", proof } as any);
    if (!result.ok) throw new Error(result.error);
    if (["failed", "canceled", "cancelled", "reversed", "returned"].includes(result.data.status)) throw new Error(`The bank instruction is ${result.data.status}. Review activity before starting another.`);
    onDone(result.data);
  } catch (e) { setError((e as Error).message || "The bank instruction could not be confirmed. Check activity before starting another."); } finally { setBusy(false); } };
  return <section className="mn-panel"><div className="mn-panel-hd"><span>Review bank instruction</span></div><dl className="mn-review"><dt>From</dt><dd>{preview.from?.detail}</dd><dt>To</dt><dd>{preview.to?.name}</dd><dt>Amount</dt><dd>{fmt(preview.amount)}</dd><dt>Fee</dt><dd>{fmt(preview.fee)}</dd><dt>Total</dt><dd>{fmt(preview.total)}</dd>{preview.memo && <><dt>Note</dt><dd>{preview.memo}</dd></>}</dl>
    {(preview.notices || []).map((note: string) => <p key={note}>{note}</p>)}<ErrorText error={error} />
    {error && <p>Retrying this review keeps the same instruction key. <Link href="/account/banking/activity">Check account activity</Link> before creating a different instruction.</p>}
    <div className="mn-actions"><button type="button" className="btn ghost sm" disabled={busy || attempted} onClick={onBack}>Back</button><button type="button" className="btn clay sm" disabled={busy} onClick={submit}>{busy ? "Confirming…" : "Confirm bank instruction"}</button></div>
  </section>;
}

export function BankMembersPanel({ accounts }: { accounts: Account[] }) {
  const [username, setUsername] = useState(""), [member, setMember] = useState<any>(null), [from, setFrom] = useState("");
  const [amount, setAmount] = useState(""), [memo, setMemo] = useState(""), [preview, setPreview] = useState<any>(null), [done, setDone] = useState<any>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lookup = async () => { setBusy(true); setError(""); setMember(null); try { const r = await bankMemberResolveAction(username.trim()); if (!r.ok) throw new Error(r.error); if (!r.data.found) throw new Error("No available member matches that exact username."); setMember(r.data); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const review = async () => { const cents = parseAmount(amount); if (!cents || cents <= 0) return setError("Enter a positive USD amount with at most two decimal places."); setBusy(true); setError(""); try { const r = await bankMemberPreviewAction({ recipientToken: member.recipientToken, fromAccountId: from, amount: { amount: cents, currency: "USD" }, memo: memo.trim() }); if (!r.ok) throw new Error(r.error); setPreview(r.data); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  if (preview) return <BankInstructionReview key={preview.previewId} preview={preview} onBack={() => setPreview(null)} onDone={result => { setPreview(null); setDone(result); }} />;
  return <div className="mn-req"><BankReceivingPreferences accounts={accounts} /><section className="mn-panel"><div className="mn-panel-hd"><span>Send to a same-bank member</span></div>
    {done ? <><h2>{done.status === "completed" ? "Transfer completed" : "Bank instruction received"}</h2><p>{done.status === "completed" ? `${fmt(done.amount)} transferred.` : "The instruction is processing or waiting for bank review. No delivery is confirmed."}</p><Link className="btn clay sm" href="/account/banking/activity">View activity</Link><button type="button" className="btn ghost sm" onClick={() => { setDone(null); setMember(null); setUsername(""); setAmount(""); setMemo(""); }}>New transfer</button></> : <>
      <p>Use the exact username of a member who opted in. A lookup never returns their account number.</p>
      <div className="mn-field"><label htmlFor="bank-member-username">Exact member username</label><input id="bank-member-username" value={username} disabled={busy} autoComplete="off" onChange={e => { setUsername(e.target.value); setMember(null); }} /></div><button type="button" className="btn ghost sm" disabled={busy || !username.trim()} onClick={lookup}>Look up member</button>
      {member && <><p role="status">Member: <strong>{member.name}</strong> · {member.handle}</p><div className="mn-field"><label htmlFor="bank-member-from">From account</label><select id="bank-member-from" value={from} disabled={busy} onChange={e => setFrom(e.target.value)}><option value="">Choose an account you own</option>{accountOptions(accounts)}</select></div><div className="mn-field"><label htmlFor="bank-member-amount">Amount (USD)</label><input id="bank-member-amount" value={amount} disabled={busy} inputMode="decimal" onChange={e => setAmount(e.target.value)} /></div><div className="mn-field"><label htmlFor="bank-member-note">Note (optional)</label><input id="bank-member-note" value={memo} maxLength={200} disabled={busy} onChange={e => setMemo(e.target.value)} /></div><button type="button" className="btn clay sm" disabled={busy || !from} onClick={review}>Review transfer</button></>}
    </>}<ErrorText error={error} />
  </section></div>;
}

export function BankRequestsPanel({ accounts }: { accounts: Account[] }) {
  const [direction, setDirection] = useState<"incoming" | "outgoing">("outgoing"), [page, setPage] = useState(1), [rows, setRows] = useState<any[]>([]), [total, setTotal] = useState(0), [loaded, setLoaded] = useState(false);
  const [amount, setAmount] = useState(""), [memo, setMemo] = useState(""), [username, setUsername] = useState(""), [member, setMember] = useState<any>(null), [made, setMade] = useState<any>(null);
  const [receiving, setReceiving] = useState<any>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const refresh = async () => { setBusy(true); setError(""); setLoaded(false); try { const [r, prefs] = await Promise.all([bankRequestsListAction(direction, page), bankReceivingStatusAction()]); if (!r.ok) throw new Error(r.error); if (!prefs.ok) throw new Error(prefs.error); setRows(r.data.data || []); setTotal(r.data.total || 0); setReceiving(prefs.data); setLoaded(true); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  useEffect(() => { void refresh(); }, [direction, page]);
  const lookup = async () => { setBusy(true); setError(""); setMember(null); try { const r = await bankMemberResolveAction(username.trim()); if (!r.ok) throw new Error(r.error); if (!r.data.found) throw new Error("No available member matches that exact username."); setMember(r.data); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const create = async () => { const cents = parseAmount(amount); if (!cents || cents <= 0) return setError("Enter a positive full USD request amount."); if (username.trim() && !member) return setError("Look up and confirm the exact payer before creating the request."); setBusy(true); setError(""); try { const r = await bankRequestCreateAction({ toAccountId: receiving.account, amount: { amount: cents, currency: "USD" }, memo: memo.trim(), ...(member ? { payerToken: member.recipientToken } : {}) }); if (!r.ok) throw new Error(r.error); setMade(r.data); setAmount(""); setMemo(""); setUsername(""); setMember(null); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <div className="mn-req"><BankReceivingPreferences accounts={accounts} onSaved={setReceiving} /><section className="mn-panel"><div className="mn-panel-hd"><span>New same-bank money request</span></div><p>The full exact USD amount is payable from another member’s eligible bank account. No email or message is sent. Requests expire after seven days unless a shorter expiry is supplied.</p>
    <button type="button" className="btn ghost sm" disabled={busy} onClick={refresh}>Refresh receiving account and requests</button>
    {!receiving ? <p>Receiving preferences are not loaded. Refresh to try again.</p> : !receiving.enabled ? <p>Enable a designated account in Member receiving preferences, then refresh here.</p> : <><p>Receiving account: {accountLabel(accounts.find(a => a.id === receiving.account) || { type: "checking", mask: "", name: "Designated account" } as Account)}</p><div className="mn-field"><label htmlFor="request-payer">Exact payer username (optional; leave blank for a share link)</label><input id="request-payer" value={username} disabled={busy} autoComplete="off" onChange={e => { setUsername(e.target.value); setMember(null); }} /></div>{username.trim() && <button type="button" className="btn ghost sm" disabled={busy} onClick={lookup}>Look up payer</button>}{member && <p>Payer: <strong>{member.name}</strong></p>}<div className="mn-field"><label htmlFor="request-amount">Full amount (USD)</label><input id="request-amount" value={amount} inputMode="decimal" disabled={busy} onChange={e => setAmount(e.target.value)} /></div><div className="mn-field"><label htmlFor="request-note">Note (optional)</label><input id="request-note" value={memo} maxLength={200} disabled={busy} onChange={e => setMemo(e.target.value)} /></div><button type="button" className="btn clay sm" disabled={busy} onClick={create}>Create request</button></>}
    {made && <div role="status"><p>Request created for {fmt(made.amount)}. Nothing was charged or sent.</p><Link href={`/account/banking/requests/${made.id}`}>Open request</Link>{made.payUrl && <p><a href={made.payUrl}>Open share link</a><button type="button" className="btn ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(publicLink(made.payUrl)); } catch { setError("The link could not be copied. Open it and copy its address."); } }}>Copy share link</button></p>}</div>}
    <ErrorText error={error} />
  </section><section className="mn-panel"><div className="mn-panel-hd"><span>Your requests</span></div><div className="mn-seg"><button type="button" disabled={busy} aria-pressed={direction === "incoming"} onClick={() => { setDirection("incoming"); setPage(1); }}>Incoming</button><button type="button" disabled={busy} aria-pressed={direction === "outgoing"} onClick={() => { setDirection("outgoing"); setPage(1); }}>Outgoing</button></div>
    {busy ? <p role="status">Loading requests…</p> : !loaded ? <p>Requests are not loaded. Refresh to try again.</p> : !rows.length ? <p>No {direction} requests.</p> : <ul>{rows.map(row => <li key={row.id}><Link href={`/account/banking/requests/${row.id}`}>{fmt(row.amount)} · {row.counterparty?.name || "Share link"}</Link><p>{row.status === "processing" ? "Processing or bank review" : row.status} · expires {fmtDate(row.expiresAt)}</p></li>)}</ul>}
    <div className="mn-actions"><button type="button" className="btn ghost sm" disabled={busy || page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page}</span><button type="button" className="btn ghost sm" disabled={busy || page * 25 >= total} onClick={() => setPage(p => p + 1)}>Next</button></div>
  </section></div>;
}

export function BankRequestDetail({ requestId, shareToken, accounts }: { requestId: string; shareToken?: string; accounts: Account[] }) {
  const [request, setRequest] = useState<any>(null), [from, setFrom] = useState(""), [preview, setPreview] = useState<any>(null), [link, setLink] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const refresh = async () => { setBusy(true); setError(""); try { const r = await bankRequestGetAction(requestId, shareToken); if (!r.ok) throw new Error(r.error); setRequest(r.data); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  useEffect(() => { void refresh(); }, [requestId, shareToken]);
  const change = async (operation: "cancel" | "decline" | "share") => { setBusy(true); setError(""); try { const r = operation === "share" ? await bankRequestShareAction(requestId) : await bankRequestCloseAction(requestId, operation); if (!r.ok) throw new Error(r.error); if (operation === "share") setLink(publicLink(r.data.payUrl)); else await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const review = async () => { setBusy(true); setError(""); try { const r = await bankRequestPreviewAction({ requestId, shareToken, fromAccountId: from }); if (!r.ok) throw new Error(r.error); setPreview(r.data); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  if (preview) return <BankInstructionReview key={preview.previewId} preview={preview} onBack={() => setPreview(null)} onDone={() => { setPreview(null); void refresh(); }} />;
  return <section className="mn-panel"><div className="mn-panel-hd"><span>Same-bank money request</span></div><ErrorText error={error} />{!request ? <button type="button" className="btn ghost sm" disabled={busy} onClick={refresh}>{busy ? "Loading…" : "Retry request"}</button> : <><h2>{fmt(request.amount)}</h2><p>{request.direction === "outgoing" ? "You requested" : "Requested by"} {request.counterparty?.name || "share link"}</p>{request.memo && <p>{request.memo}</p>}<p role="status">{request.status === "processing" ? "Processing or waiting for bank review. Do not pay this request again." : request.status}</p><p>Expires {fmtDate(request.expiresAt)}</p><button type="button" className="btn ghost sm" disabled={busy} onClick={refresh}>Refresh payment status</button>
    {request.status === "open" && request.direction === "incoming" && <><div className="mn-field"><label htmlFor="request-pay-from">Pay the full exact amount from</label><select id="request-pay-from" disabled={busy} value={from} onChange={e => setFrom(e.target.value)}><option value="">Choose an account you own</option>{accountOptions(accounts)}</select></div><button type="button" className="btn clay sm" disabled={busy || !from} onClick={review}>Review full payment</button>{request.counterparty && !shareToken && <button type="button" className="btn ghost sm" disabled={busy} onClick={() => change("decline")}>Decline request</button>}</>}
    {request.status === "open" && request.direction === "outgoing" && <div className="mn-actions"><button type="button" className="btn ghost sm" disabled={busy} onClick={() => change("cancel")}>Cancel request</button>{!request.counterparty && <button type="button" className="btn ghost sm" disabled={busy} onClick={() => change("share")}>Generate new share link</button>}</div>}
    {link && <p>Previous share links no longer work. <a href={link}>Open new link</a><button type="button" className="btn ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(link); } catch { setError("Copy failed. Open the link and copy its address."); } }}>Copy link</button></p>}
    <p><Link href="/account/banking/request">Your requests</Link> · <Link href="/account/banking/activity">Account activity</Link></p>
  </>}
  </section>;
}
