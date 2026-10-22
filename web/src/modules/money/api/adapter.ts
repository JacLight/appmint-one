import "server-only";
/**
 * The ONE place the Money screens get banking data from.
 *
 * Modes (decided at request time, `bankingMode()`):
 * - "sample"      — env PORTAL_MONEY_SAMPLE=1, or any non-production run with no API
 *                   configured. Fixture data, nothing moves; every screen shows the
 *                   "Sample data — banking API not connected" banner. Identity still
 *                   goes to the engine unless PORTAL_MONEY_SAMPLE=1.
 * - "live"        — env PORTAL_MONEY_API_URL is set (the bank's API base URL), or
 *                   PORTAL_MONEY_API=engine (the contract served by appengine under
 *                   `client/banking/*`). Calls the contract in
 *                   /Users/imzee/projects/docs/APPMINT-MONEY-API-CONTRACT.md.
 * - "unavailable" — production with no API: the screens say "Not available yet".
 *
 * Deliberately NOT mapped onto the engine's finance / payout / Plaid routes.
 */
import { cache } from "react";
import { getSession } from "@/lib/auth";
import { apiReq } from "@/lib/api";
import { getAppmintAuth } from "@/lib/appmint-auth";
import { runtimeEnv } from "@/lib/runtime-env";
import { SampleBankingApi } from "./sample";
import {
  BankError, type BankErrorCode, type BankingApi, type CardLimitsInput, type IdentityFileInput, type IdentityInput, type NewMoneyRequest, type NewRecipient,
  type RecipientKind, type StepUpAction, type StepUpMethod, type StepUpProof, type TransactionQuery, type TransferInput, type TransferKind, type TransferStatus,
} from "./types";

export type BankingMode = "live" | "sample" | "unavailable";

export function bankingMode(): BankingMode {
  if (runtimeEnv("PORTAL_MONEY_SAMPLE") === "1") return "sample";
  if (runtimeEnv("PORTAL_MONEY_API_URL") || runtimeEnv("PORTAL_MONEY_API") === "engine") return "live";
  if (process.env.NODE_ENV !== "production") return "sample";
  return "unavailable";
}

/* ───────────── live transport ───────────── */

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Transport = <T>(method: Method, path: string, body?: unknown, query?: Record<string, string | number | undefined>) => Promise<T>;

function qs(query?: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== "") p.append(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

function toBankError(e: unknown): BankError {
  if (e instanceof BankError) return e;
  const any = e as { status?: number; response?: { status?: number; data?: any }; body?: any; message?: string };
  const status = any?.status ?? any?.response?.status ?? 500;
  const body = any?.body ?? any?.response?.data;
  const err = body?.error && typeof body.error === "object" ? body.error : body;
  const code = (err?.code as BankErrorCode) || (status === 401 ? "UNAUTHENTICATED" : status === 404 ? "NOT_FOUND" : "UNAVAILABLE");
  const message = (typeof err?.message === "string" && err.message) || "The bank didn’t respond. Try again in a moment.";
  return new BankError(code, message, err?.field, status);
}

/** The bank's own API (PORTAL_MONEY_API_URL): bearer = the customer's AppMint JWT. */
function directTransport(base: string): Transport {
  return async (method, path, body, query) => {
    const { token } = await getAppmintAuth().getClientInfo().catch(() => ({ token: null as string | null }));
    const res = await fetch(`${base.replace(/\/$/, "")}/${path}${qs(query)}`, {
      method,
      headers: { "content-type": "application/json", accept: "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), "x-org-id": runtimeEnv("ORG_ID") || "" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;
    if (!res.ok) throw toBankError({ status: res.status, body: json });
    return json;
  };
}

/** The same contract served by appengine at `client/banking/*` (customer JWT). */
const engineTransport: Transport = async (method, path, body, query) => {
  try {
    return await apiReq(method, `client/banking/${path}`, { data: body, query });
  } catch (e) {
    throw toBankError(e);
  }
};

/** HTTP implementation of the contract. Paths match the contract doc one-to-one. */
class HttpBankingApi implements BankingApi {
  constructor(private t: Transport) {}
  profile() { return this.t<any>("GET", "profile"); }
  listAccounts() { return this.t<any>("GET", "accounts"); }
  getAccount(id: string) { return this.t<any>("GET", `accounts/${encodeURIComponent(id)}`); }
  listTransactions(q: TransactionQuery) { return this.t<any>("GET", "transactions", undefined, q as Record<string, string | number | undefined>); }
  getTransaction(id: string) { return this.t<any>("GET", `transactions/${encodeURIComponent(id)}`); }
  listRecipients(kind?: RecipientKind) { return this.t<any>("GET", "recipients", undefined, { kind }).then((r: any) => r.items ?? r); }
  getRecipient(id: string) { return this.t<any>("GET", `recipients/${encodeURIComponent(id)}`); }
  lookupRouting(rn: string) { return this.t<any>("GET", `routing/${encodeURIComponent(rn)}`); }
  lookupMember(query: string) { return this.t<any>("GET", "members/lookup", undefined, { q: query }); }
  addRecipient(input: NewRecipient, proof?: StepUpProof) { return this.t<any>("POST", "recipients", { ...input, stepUp: proof }); }
  updateRecipient(id: string, patch: { nickname?: string }) { return this.t<any>("PATCH", `recipients/${encodeURIComponent(id)}`, patch); }
  async removeRecipient(id: string) { await this.t("DELETE", `recipients/${encodeURIComponent(id)}`); }
  transferOptions(kind: TransferKind) { return this.t<any>("GET", "transfers/options", undefined, { kind }); }
  previewTransfer(input: TransferInput) { return this.t<any>("POST", "transfers/preview", input); }
  submitTransfer(previewId: string, idempotencyKey: string, proof?: StepUpProof) { return this.t<any>("POST", "transfers", { previewId, idempotencyKey, stepUp: proof }); }
  getTransfer(id: string) { return this.t<any>("GET", `transfers/${encodeURIComponent(id)}`); }
  listTransfers(query?: { status?: TransferStatus; limit?: number }) { return this.t<any>("GET", "transfers", undefined, query); }
  cancelTransfer(id: string) { return this.t<any>("POST", `transfers/${encodeURIComponent(id)}/cancel`); }
  startStepUp(action: StepUpAction, method?: StepUpMethod) { return this.t<any>("POST", "security/step-up", { action, method }); }
  receiveDetails(accountId: string, proof?: StepUpProof) {
    return proof
      ? this.t<any>("POST", `accounts/${encodeURIComponent(accountId)}/receive-details/reveal`, { stepUp: proof })
      : this.t<any>("GET", `accounts/${encodeURIComponent(accountId)}/receive-details`);
  }
  listRequests(direction?: "outgoing" | "incoming") { return this.t<any>("GET", "requests", undefined, { direction }).then((r: any) => r.items ?? r); }
  createRequest(input: NewMoneyRequest) { return this.t<any>("POST", "requests", input); }
  cancelRequest(id: string) { return this.t<any>("POST", `requests/${encodeURIComponent(id)}/cancel`); }
  declineRequest(id: string) { return this.t<any>("POST", `requests/${encodeURIComponent(id)}/decline`); }
  payRequest(id: string, fromAccountId: string, idempotencyKey: string, proof?: StepUpProof) {
    return this.t<any>("POST", `requests/${encodeURIComponent(id)}/pay`, { fromAccountId, idempotencyKey, stepUp: proof });
  }
  listStatements(query?: { accountId?: string; year?: number }) { return this.t<any>("GET", "statements", undefined, query).then((r: any) => r.items ?? r); }
  getStatement(id: string) { return this.t<any>("GET", `statements/${encodeURIComponent(id)}`); }
  listCards() { return this.t<any>("GET", "cards").then((r: any) => r.items ?? r); }
  getCard(id: string) { return this.t<any>("GET", `cards/${encodeURIComponent(id)}`); }
  freezeCard(id: string) { return this.t<any>("POST", `cards/${encodeURIComponent(id)}/freeze`); }
  unfreezeCard(id: string) { return this.t<any>("POST", `cards/${encodeURIComponent(id)}/unfreeze`); }
  setCardLimits(id: string, input: CardLimitsInput, proof: StepUpProof) { return this.t<any>("PATCH", `cards/${encodeURIComponent(id)}/limits`, { ...input, stepUp: proof }); }
  identity() { return this.t<any>("GET", "identity"); }
  submitIdentity(input: IdentityInput) { return this.t<any>("PUT", "identity", input); }
  attachIdentityFile(input: IdentityFileInput) { return this.t<any>("POST", "identity/documents", input); }
}

/** The banking API for the signed-in customer, or null when banking isn't available. */
export const getBanking = cache(async (): Promise<{ mode: BankingMode; api: BankingApi | null }> => {
  const mode = bankingMode();
  if (mode === "unavailable") return { mode, api: null };
  if (mode === "live") {
    const url = runtimeEnv("PORTAL_MONEY_API_URL");
    return { mode, api: new HttpBankingApi(url ? directTransport(url) : engineTransport) };
  }
  const s = await getSession();
  const c = s.customer;
  const api = new SampleBankingApi({ customerId: c?.id || "anon", firstName: c?.firstName || "", lastName: c?.lastName || "", email: c?.email || "" });
  // Identity is real even while the money screens are samples: the engine serves the
  // customer's own KYC check (client/banking/identity), so it goes there unless the
  // whole module was forced to sample (PORTAL_MONEY_SAMPLE=1).
  if (runtimeEnv("PORTAL_MONEY_SAMPLE") !== "1") {
    const live = new HttpBankingApi(engineTransport);
    api.identity = () => live.identity();
    api.submitIdentity = (input) => live.submitIdentity(input);
    api.attachIdentityFile = (input) => live.attachIdentityFile(input);
  }
  return { mode, api };
});

/** Banking API or throw (for server actions). */
export async function bank(): Promise<BankingApi> {
  const { api } = await getBanking();
  if (!api) throw new BankError("UNAVAILABLE", "Banking isn’t available yet.", undefined, 503);
  return api;
}

/** Safe read for pages: the value, or a BankError to render. */
export async function load<T>(fn: (api: BankingApi) => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: BankError }> {
  try {
    return { ok: true, data: await fn(await bank()) };
  } catch (e) {
    return { ok: false, error: toBankError(e) };
  }
}
