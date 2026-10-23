import "server-only";
/**
 * Sample-mode implementation of the banking contract. Reads the fixture in
 * ./sample-fixture.ts and behaves like the API would (validation, step-up, errors),
 * but NOTHING MOVES: transfers and request payments return a sample confirmation and
 * balances never change. Card status/limits, recipients and requests are kept in this
 * dev process's memory per customer so the screens respond while you click around.
 */
import { SAMPLE_BANK, SAMPLE_MEMBERS, SAMPLE_ROUTING, sampleFixture, type SampleFixture } from "./sample-fixture";
import {
  BankError,
  type Account, type AccountList, type BankingApi, type BankProfile, type Card, type CardLimitsInput, type IdentityDetails, type IdentityFileInput,
  type IdentityInput, type IdentityView, type MemberLookup, type MoneyRequest,
  type NewMoneyRequest, type NewRecipient, type Page, type ReceiveDetails, type Recipient, type RecipientKind, type RoutingLookup,
  type Statement, type StatementDetail, type StepUpAction, type StepUpChallenge, type StepUpProof, type Transaction,
  type TransactionQuery, type Transfer, type TransferInput, type TransferKind, type TransferOptions, type TransferPreview, type TransferStatus,
} from "./types";
import { isValidRouting } from "../lib/format";

interface Holder { customerId: string; firstName: string; lastName: string; email: string }

interface Overlay {
  cards: Record<string, Partial<Card>>;
  addedRecipients: Recipient[];
  removedRecipients: Set<string>;
  nicknames: Record<string, string>;
  requests: MoneyRequest[];
  requestStatus: Record<string, Partial<MoneyRequest>>;
  previews: Map<string, TransferPreview & { input: TransferInput; recipientIsNew: boolean }>;
  transfers: Transfer[];
  challenges: Map<string, { action: StepUpAction; expiresAt: number }>;
  identity: SampleIdentity | null;
}

/** The sample identity record. The TIN is never kept, only its last 4. */
interface SampleIdentity {
  status: "submitted" | "in_review" | "verified";
  submittedAt: string;
  details: IdentityDetails;
}

const g = globalThis as unknown as { __moneySample?: Map<string, Overlay> };
const overlays = (g.__moneySample ??= new Map());
function overlay(id: string): Overlay {
  let o = overlays.get(id);
  if (!o) {
    o = { cards: {}, addedRecipients: [], removedRecipients: new Set(), nicknames: {}, requests: [], requestStatus: {}, previews: new Map(), transfers: [], challenges: new Map(), identity: null };
    overlays.set(id, o);
  }
  return o;
}

const usd = (amount: number) => ({ amount, currency: "USD" as const });
const rid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const ref = () => `TW${Date.now().toString(36).toUpperCase().slice(-5)}${Math.random().toString(36).toUpperCase().slice(2, 6)}`;

/** Next business day(s) from today. */
function businessDays(n: number, from = new Date()): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}
/** Today in the bank's time zone (Central), as YYYY-MM-DD. */
const CT_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" });
const today = () => CT_DAY.format(new Date());
/** Sample bank policy: daily send limits (cents) and the same-day ACH fee. */
const DAILY_LIMIT: Record<TransferKind, number> = { external: 1000000, internal: 500000, own: 5000000 };
const SAME_DAY_FEE = 300;

export class SampleBankingApi implements BankingApi {
  constructor(private holder: Holder) {}

  private fx(): SampleFixture {
    return sampleFixture({ firstName: this.holder.firstName || "Alex", lastName: this.holder.lastName || "Morgan" });
  }
  private get o() { return overlay(this.holder.customerId); }

  private checkProof(proof: StepUpProof | undefined, action: StepUpAction) {
    if (!proof) throw new BankError("STEP_UP_REQUIRED", "Confirm it’s you with the code we send.", undefined, 403);
    const c = this.o.challenges.get(proof.challengeId);
    if (!c || c.action !== action) throw new BankError("STEP_UP_INVALID", "That code doesn’t match. Request a new one.", "code", 403);
    if (c.expiresAt < Date.now()) throw new BankError("STEP_UP_EXPIRED", "That code expired. We’ll send a new one.", "code", 403);
    if (!/^\d{6}$/.test(proof.code) || proof.code === "000000") throw new BankError("STEP_UP_INVALID", "That code isn’t right. Check the message and try again.", "code", 403);
    this.o.challenges.delete(proof.challengeId);
  }

  async profile(): Promise<BankProfile> {
    const { firstName, lastName, email, customerId } = this.holder;
    const f = firstName || "Alex", l = lastName || "Morgan";
    return { customerId, firstName: f, lastName: l, email, handle: `@${f.toLowerCase()}.${l.toLowerCase().slice(0, 1)}`.replace(/[^@a-z.]/g, ""), phoneMasked: SAMPLE_BANK.phoneMasked, since: this.fx().accounts[0].openedAt };
  }

  async listAccounts(): Promise<AccountList> {
    const items = this.fx().accounts;
    const sum = (k: "available" | "current") => usd(items.reduce((n, a) => n + a.balances[k].amount, 0));
    const hist = items[0]?.balanceHistory?.map((p, i) => ({ date: p.date, balance: items.reduce((n, a) => n + (a.balanceHistory?.[i]?.balance ?? 0), 0) }));
    const l30 = (k: "moneyIn" | "moneyOut") => usd(items.reduce((n, a) => n + (a.last30Days?.[k].amount ?? 0), 0));
    return { items, total: { available: sum("available"), current: sum("current"), last30Days: { moneyIn: l30("moneyIn"), moneyOut: l30("moneyOut") }, balanceHistory: hist } };
  }
  async getAccount(id: string): Promise<Account> {
    const a = this.fx().accounts.find((x) => x.id === id);
    if (!a) throw new BankError("NOT_FOUND", "We couldn’t find that account.", undefined, 404);
    return a;
  }

  async listTransactions(q: TransactionQuery): Promise<Page<Transaction>> {
    let rows = this.fx().transactions;
    if (q.accountId) rows = rows.filter((t) => t.accountId === q.accountId);
    if (q.direction) rows = rows.filter((t) => t.direction === q.direction);
    if (q.status) rows = rows.filter((t) => t.status === q.status);
    if (q.category) rows = rows.filter((t) => t.category === q.category);
    if (q.from) rows = rows.filter((t) => t.createdAt.slice(0, 10) >= q.from!);
    if (q.to) rows = rows.filter((t) => t.createdAt.slice(0, 10) <= q.to!);
    if (q.q) {
      const s = q.q.trim().toLowerCase().replace(/^\$/, "");
      rows = rows.filter((t) =>
        [t.description, t.counterparty?.name, t.memo, t.reference, t.statementDescriptor, (t.amount.amount / 100).toFixed(2)]
          .some((v) => v && String(v).toLowerCase().includes(s)));
    }
    const limit = Math.min(200, q.limit || 50);
    const start = q.cursor ? Number(q.cursor) || 0 : 0;
    const items = rows.slice(start, start + limit);
    return { items, total: rows.length, nextCursor: start + limit < rows.length ? String(start + limit) : null };
  }
  async getTransaction(id: string): Promise<Transaction> {
    const t = this.fx().transactions.find((x) => x.id === id);
    if (!t) throw new BankError("NOT_FOUND", "We couldn’t find that transaction.", undefined, 404);
    return t;
  }

  private recipients(): Recipient[] {
    const all = [...this.o.addedRecipients, ...this.fx().recipients].filter((r) => !this.o.removedRecipients.has(r.id));
    return all.map((r) => (this.o.nicknames[r.id] !== undefined ? { ...r, nickname: this.o.nicknames[r.id] || undefined } : r));
  }
  async listRecipients(kind?: RecipientKind): Promise<Recipient[]> {
    return this.recipients().filter((r) => !kind || r.kind === kind);
  }
  async getRecipient(id: string): Promise<Recipient> {
    const r = this.recipients().find((x) => x.id === id);
    if (!r) throw new BankError("RECIPIENT_NOT_FOUND", "That recipient was removed.", undefined, 404);
    return r;
  }
  async lookupRouting(routingNumber: string): Promise<RoutingLookup> {
    const rn = routingNumber.replace(/\D/g, "");
    if (!isValidRouting(rn)) return { routingNumber: rn, bankName: "", valid: false };
    return { routingNumber: rn, bankName: SAMPLE_ROUTING[rn] || "Community bank", valid: true };
  }
  async lookupMember(query: string): Promise<MemberLookup> {
    const s = query.trim().toLowerCase().replace(/[\s()-]/g, "");
    const handle = s.startsWith("@") ? s : `@${s}`;
    const m = SAMPLE_MEMBERS.find((x) => x.handle === handle || x.email === s || x.phone === s.replace(/^\+?1/, ""));
    return m ? { found: true, name: m.name, handle: m.handle } : { found: false };
  }
  async addRecipient(input: NewRecipient, proof?: StepUpProof): Promise<Recipient> {
    if (input.kind === "external") {
      this.checkProof(proof, "add_recipient");
      const rn = input.routingNumber.replace(/\D/g, "");
      const acct = input.accountNumber.replace(/\D/g, "");
      if (!isValidRouting(rn)) throw new BankError("VALIDATION", "That routing number isn’t valid.", "routingNumber");
      if (acct.length < 4 || acct.length > 17) throw new BankError("VALIDATION", "Account numbers are 4 to 17 digits.", "accountNumber");
      if (!input.name.trim()) throw new BankError("VALIDATION", "Add the account holder’s name.", "name");
      const r: Recipient = { id: rid("rcp"), kind: "external", name: input.name.trim(), nickname: input.nickname?.trim() || undefined,
        external: { bankName: SAMPLE_ROUTING[rn] || "Community bank", routingNumber: rn, accountMask: acct.slice(-4), accountType: input.accountType },
        createdAt: new Date().toISOString(), lastSentAt: null };
      this.o.addedRecipients.unshift(r);
      return r;
    }
    const m = await this.lookupMember(input.lookup);
    if (!m.found) throw new BankError("RECIPIENT_NOT_FOUND", "No one at Tidewell matches that. Check the @handle, email or phone.", "lookup", 404);
    const existing = this.recipients().find((r) => r.internal?.handle === m.handle);
    if (existing) return existing;
    const r: Recipient = { id: rid("rcp"), kind: "internal", name: m.name!, nickname: input.nickname?.trim() || undefined, internal: { handle: m.handle! }, createdAt: new Date().toISOString(), lastSentAt: null };
    this.o.addedRecipients.unshift(r);
    return r;
  }
  async updateRecipient(id: string, patch: { nickname?: string }): Promise<Recipient> {
    await this.getRecipient(id);
    this.o.nicknames[id] = (patch.nickname || "").trim();
    return this.getRecipient(id);
  }
  async removeRecipient(id: string): Promise<void> {
    await this.getRecipient(id);
    this.o.removedRecipients.add(id);
  }

  private sentToday(kind: TransferKind): number {
    const d = today();
    return this.o.transfers.filter((t) => t.kind === kind && CT_DAY.format(new Date(t.createdAt)) === d && t.status !== "canceled").reduce((n, t) => n + t.amount.amount, 0);
  }

  async transferOptions(kind: TransferKind): Promise<TransferOptions> {
    const sent = this.sentToday(kind);
    const limit = DAILY_LIMIT[kind];
    const speeds: TransferOptions["speeds"] = kind === "external"
      ? [
          { speed: "standard", label: "Standard", fee: usd(0), timing: "1–3 business days" },
          { speed: "same_day", label: "Same day", fee: usd(SAME_DAY_FEE), timing: "Today if sent by 4 PM CT" },
        ]
      : [{ speed: "instant", label: "Instant", fee: usd(0), timing: "Seconds, any day" }];
    const notes = kind === "external"
      ? ["Transfers sent after 4 PM CT, on weekends or on bank holidays start the next business day.", "Double-check the account number — money sent to the wrong account can be hard to get back."]
      : kind === "internal"
        ? [`Money arrives in their ${SAMPLE_BANK.name} account in seconds and can’t be pulled back once sent.`, "Only send to people you know."]
        : ["Moves between your own accounts are free and instant, any day."];
    return {
      kind, dailyLimit: usd(limit), sentToday: usd(sent), remainingToday: usd(Math.max(0, limit - sent)), speeds,
      cutoff: kind === "external" ? "4:00 PM CT on business days" : undefined, notes,
    };
  }

  async previewTransfer(input: TransferInput): Promise<TransferPreview> {
    const accounts = this.fx().accounts;
    const from = accounts.find((a) => a.id === input.fromAccountId);
    if (!from) throw new BankError("VALIDATION", "Choose the account to send from.", "fromAccountId");
    const amount = Math.round(input.amount.amount);
    if (!Number.isFinite(amount) || amount < 1) throw new BankError("VALIDATION", "Enter an amount.", "amount");
    let to: TransferPreview["to"];
    let recipientIsNew = false;
    if (input.kind === "own") {
      const dest = accounts.find((a) => a.id === input.toAccountId);
      if (!dest || dest.id === from.id) throw new BankError("VALIDATION", "Choose a different account to move money to.", "toAccountId");
      to = { name: dest.name, detail: `${dest.name} ••${dest.mask}` };
    } else {
      const r = await this.getRecipient(input.recipientId || "");
      if (r.kind !== input.kind) throw new BankError("VALIDATION", "Choose a recipient for this kind of transfer.", "recipientId");
      recipientIsNew = !r.lastSentAt;
      to = { name: r.name, detail: r.kind === "external" ? `${r.external!.bankName} ••${r.external!.accountMask}` : r.internal!.handle };
    }
    const speed = input.kind === "external" ? input.speed || "standard" : "instant";
    const fee = speed === "same_day" ? SAME_DAY_FEE : 0;
    const scheduled = input.scheduledFor && input.scheduledFor > today() ? input.scheduledFor : null;
    if (!scheduled && amount + fee > from.balances.available.amount) {
      throw new BankError("INSUFFICIENT_FUNDS", `That’s more than the ${from.name} available balance.`, "amount", 422);
    }
    const dailyLimit = DAILY_LIMIT[input.kind];
    const left = dailyLimit - this.sentToday(input.kind);
    if (amount > left) throw new BankError("LIMIT_EXCEEDED", left < dailyLimit ? `You can send $${(left / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} more this way today.` : `The most you can send this way in a day is $${(dailyLimit / 100).toLocaleString("en-US")}.`, "amount", 422);
    const base = scheduled ? new Date(`${scheduled}T12:00:00Z`) : new Date();
    const arrivesBy = speed === "standard" ? businessDays(2, base) : (scheduled || today());
    const notices: string[] = [];
    if (recipientIsNew && input.kind !== "own") notices.push(`This is your first transfer to ${to.name}. Check the details before you send.`);
    if (speed === "standard" && input.kind === "external") notices.push("Transfers sent after 4 PM CT or on weekends start the next business day.");
    const previewId = rid("pvw");
    const preview: TransferPreview = {
      previewId, kind: input.kind,
      from: { accountId: from.id, name: from.name, detail: `${from.name} ••${from.mask}` },
      to, amount: usd(amount), fee: usd(fee), total: usd(amount + fee), speed, arrivesBy, scheduledFor: scheduled,
      memo: input.memo?.trim() || undefined,
      availableAfter: scheduled ? undefined : usd(from.balances.available.amount - amount - fee),
      // A real bank decides this server-side; here: every transfer to someone else, and big moves.
      stepUp: input.kind !== "own" || amount >= 500000 ? { methods: ["sms", "email"] } : null,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      notices,
    };
    this.o.previews.set(previewId, { ...preview, input, recipientIsNew });
    return preview;
  }

  async submitTransfer(previewId: string, idempotencyKey: string, proof?: StepUpProof): Promise<Transfer> {
    const done = this.o.transfers.find((t) => (t as Transfer & { key?: string }).key === idempotencyKey);
    if (done) return done;
    const p = this.o.previews.get(previewId);
    if (!p) throw new BankError("PREVIEW_EXPIRED", "This review expired. Check the details again.", undefined, 410);
    if (new Date(p.expiresAt).getTime() < Date.now()) throw new BankError("PREVIEW_EXPIRED", "This review expired. Check the details again.", undefined, 410);
    if (p.stepUp) this.checkProof(proof, "transfer");
    this.o.previews.delete(previewId);
    const status: TransferStatus = p.scheduledFor ? "scheduled" : p.kind === "external" ? "pending" : "completed";
    const t: Transfer & { key?: string } = {
      id: rid("trf"), kind: p.kind, status, from: p.from, to: p.to, amount: p.amount, fee: p.fee, total: p.total, speed: p.speed,
      memo: p.memo, createdAt: new Date().toISOString(), scheduledFor: p.scheduledFor, arrivesBy: p.arrivesBy, reference: ref(), key: idempotencyKey,
    };
    this.o.transfers.unshift(t);
    return t;
  }
  async getTransfer(id: string): Promise<Transfer> {
    const t = this.o.transfers.find((x) => x.id === id);
    if (!t) throw new BankError("NOT_FOUND", "We couldn’t find that transfer.", undefined, 404);
    return t;
  }
  async listTransfers(query?: { status?: TransferStatus; limit?: number }): Promise<Page<Transfer>> {
    const items = this.o.transfers.filter((t) => !query?.status || t.status === query.status).slice(0, query?.limit || 50);
    return { items, nextCursor: null };
  }
  async cancelTransfer(id: string): Promise<Transfer> {
    const t = await this.getTransfer(id);
    if (t.status !== "scheduled") throw new BankError("VALIDATION", "Only scheduled transfers can be canceled.");
    t.status = "canceled";
    return t;
  }

  async startStepUp(action: StepUpAction): Promise<StepUpChallenge> {
    const challengeId = rid("chl");
    const expiresAt = Date.now() + 5 * 60_000;
    this.o.challenges.set(challengeId, { action, expiresAt });
    return { challengeId, method: "sms", destination: SAMPLE_BANK.phoneMasked, expiresAt: new Date(expiresAt).toISOString(), length: 6 };
  }

  async receiveDetails(accountId: string, proof?: StepUpProof): Promise<ReceiveDetails> {
    const a = await this.getAccount(accountId);
    const p = await this.profile();
    const base: ReceiveDetails = {
      accountId: a.id, accountHolder: `${p.firstName} ${p.lastName}`, bankName: SAMPLE_BANK.name, bankAddress: SAMPLE_BANK.address,
      accountType: a.type, routingNumber: SAMPLE_BANK.routingNumber, accountMask: a.mask,
    };
    if (proof) {
      this.checkProof(proof, "reveal_account_number");
      // Sample account numbers: fixed digits ending in the real mask.
      return { ...base, accountNumber: `${a.type === "checking" ? "40381177" : "40385290"}${a.mask}` };
    }
    return base;
  }

  private requests(): MoneyRequest[] {
    return [...this.o.requests, ...this.fx().requests].map((r) => ({ ...r, ...(this.o.requestStatus[r.id] || {}) }));
  }
  async listRequests(direction?: "outgoing" | "incoming"): Promise<MoneyRequest[]> {
    return this.requests().filter((r) => !direction || r.direction === direction);
  }
  async createRequest(input: NewMoneyRequest): Promise<MoneyRequest> {
    const amount = Math.round(input.amount.amount);
    if (!Number.isFinite(amount) || amount < 100) throw new BankError("VALIDATION", "Requests start at $1.00.", "amount");
    if (amount > 500000) throw new BankError("LIMIT_EXCEEDED", "Requests are capped at $5,000.", "amount");
    await this.getAccount(input.toAccountId);
    let counterparty: MoneyRequest["counterparty"] = null;
    if (input.from?.trim()) {
      const m = await this.lookupMember(input.from);
      if (!m.found) throw new BankError("RECIPIENT_NOT_FOUND", "No one at Tidewell matches that. Share a link instead.", "from", 404);
      counterparty = { name: m.name!, handle: m.handle };
    }
    const code = Math.random().toString(36).toUpperCase().slice(2, 8);
    const r: MoneyRequest = {
      id: rid("req"), direction: "outgoing", amount: usd(amount), memo: input.memo?.trim() || undefined, status: "open", counterparty,
      toAccountId: input.toAccountId, payUrl: `https://pay.tidewell.example/r/${code}`, createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14 * 864e5).toISOString(),
    };
    this.o.requests.unshift(r);
    return r;
  }
  private async setRequest(id: string, dir: "outgoing" | "incoming", patch: Partial<MoneyRequest>) {
    const r = this.requests().find((x) => x.id === id);
    if (!r || r.direction !== dir) throw new BankError("NOT_FOUND", "We couldn’t find that request.", undefined, 404);
    if (r.status !== "open") throw new BankError("VALIDATION", "This request is already closed.");
    this.o.requestStatus[id] = { ...(this.o.requestStatus[id] || {}), ...patch };
    return { ...r, ...this.o.requestStatus[id] };
  }
  async cancelRequest(id: string) { return this.setRequest(id, "outgoing", { status: "canceled" }); }
  async declineRequest(id: string) { return this.setRequest(id, "incoming", { status: "declined" }); }
  async payRequest(id: string, fromAccountId: string, idempotencyKey: string, proof?: StepUpProof): Promise<Transfer> {
    const r = this.requests().find((x) => x.id === id && x.direction === "incoming");
    if (!r) throw new BankError("NOT_FOUND", "We couldn’t find that request.", undefined, 404);
    if (r.status !== "open") throw new BankError("VALIDATION", "This request is already closed.");
    const from = await this.getAccount(fromAccountId);
    if (r.amount.amount > from.balances.available.amount) throw new BankError("INSUFFICIENT_FUNDS", `That’s more than the ${from.name} available balance.`, "amount", 422);
    this.checkProof(proof, "pay_request");
    await this.setRequest(id, "incoming", { status: "paid", paidAt: new Date().toISOString() });
    const t: Transfer & { key?: string } = {
      id: rid("trf"), kind: "internal", status: "completed", from: { accountId: from.id, name: from.name, detail: `${from.name} ••${from.mask}` },
      to: { name: r.counterparty?.name || "Request", detail: r.counterparty?.handle || "" }, amount: r.amount, fee: usd(0), total: r.amount,
      speed: "instant", memo: r.memo, createdAt: new Date().toISOString(), arrivesBy: today(), reference: ref(), key: idempotencyKey,
    };
    this.o.transfers.unshift(t);
    return t;
  }

  async listStatements(query?: { accountId?: string; year?: number }): Promise<Statement[]> {
    return this.fx().statements.filter((s) => (!query?.accountId || s.accountId === query.accountId) && (!query?.year || s.period.startsWith(String(query.year))));
  }
  async getStatement(id: string): Promise<StatementDetail> {
    const fx = this.fx();
    const s = fx.statements.find((x) => x.id === id);
    if (!s) throw new BankError("NOT_FOUND", "We couldn’t find that statement.", undefined, 404);
    const a = fx.accounts.find((x) => x.id === s.accountId)!;
    const p = await this.profile();
    const txs = fx.transactions.filter((t) => t.accountId === s.accountId && t.status === "posted" && t.createdAt.slice(0, 10) >= s.periodStart && t.createdAt.slice(0, 10) <= s.periodEnd).reverse();
    const sum = (k: string) => txs.filter((t) => t.kind === k).reduce((n, t) => n + t.amount.amount, 0);
    return { ...s, account: { id: a.id, type: a.type, name: a.name, mask: a.mask }, accountHolder: `${p.firstName} ${p.lastName}`, transactions: txs, interestPaid: usd(sum("interest")), feesCharged: usd(sum("fee")) };
  }

  private cards(): Card[] {
    return this.fx().cards.map((c) => {
      const o = this.o.cards[c.id];
      return o ? { ...c, ...o, limits: { ...c.limits, ...(o.limits || {}) } } : c;
    });
  }
  async listCards(): Promise<Card[]> { return this.cards(); }
  async getCard(id: string): Promise<Card> {
    const c = this.cards().find((x) => x.id === id);
    if (!c) throw new BankError("NOT_FOUND", "We couldn’t find that card.", undefined, 404);
    return c;
  }
  async freezeCard(id: string): Promise<Card> {
    await this.getCard(id);
    this.o.cards[id] = { ...(this.o.cards[id] || {}), status: "frozen" };
    return this.getCard(id);
  }
  async unfreezeCard(id: string): Promise<Card> {
    await this.getCard(id);
    this.o.cards[id] = { ...(this.o.cards[id] || {}), status: "active" };
    return this.getCard(id);
  }
  async setCardLimits(id: string, input: CardLimitsInput, proof: StepUpProof): Promise<Card> {
    const c = await this.getCard(id);
    const check = (v: number | undefined, max: number | undefined, label: string, field: string) => {
      if (v === undefined) return;
      if (max === undefined) throw new BankError("UNAVAILABLE", "This card’s limit settings aren’t available.");
      if (!Number.isFinite(v) || v < 0) throw new BankError("VALIDATION", `Enter a ${label} limit.`, field);
      if (v > max) throw new BankError("LIMIT_EXCEEDED", `The highest ${label} limit for this card is $${(max / 100).toLocaleString("en-US")}.`, field);
    };
    check(input.purchasesDaily, c.limits.purchasesDaily.max?.amount, "daily spending", "purchasesDaily");
    check(input.atmDaily, c.limits.atmDaily.max?.amount, "daily ATM", "atmDaily");
    this.checkProof(proof, "card_limits");
    const limits = {
      purchasesDaily: input.purchasesDaily !== undefined ? { ...c.limits.purchasesDaily, limit: usd(Math.round(input.purchasesDaily)) } : c.limits.purchasesDaily,
      atmDaily: input.atmDaily !== undefined ? { ...c.limits.atmDaily, limit: usd(Math.round(input.atmDaily)) } : c.limits.atmDaily,
    };
    this.o.cards[id] = { ...(this.o.cards[id] || {}), limits };
    return this.getCard(id);
  }

  /* identity — the same rules as the bank's: everything the CIP needs before it is sent */
  private identityMissing(d: IdentityDetails): string[] {
    const out: string[] = [];
    const a = d.address;
    if (!d.firstName || !d.lastName) out.push("Your full legal name (first and last).");
    if (!d.dateOfBirth) out.push("Your date of birth.");
    if (!a.street1 || !a.city || !a.postalCode || !a.country || (/^(us|usa|united states)/i.test(a.country || "") && !a.state)) out.push("Your home address: street, city, state, ZIP code and country.");
    if (!d.tinOnFile) out.push("Your Social Security number or ITIN.");
    const doc = d.identityDocuments.find((x) => x.documentType && x.documentNumber && x.expiryDate);
    if (!doc) out.push("An identity document: its type, number, who issued it and when it expires.");
    else if (doc.expired) out.push("Your identity document has expired — send a current one.");
    return out;
  }

  private identityView(): IdentityView {
    const rec = overlay(this.holder.customerId).identity;
    const blank: IdentityDetails = {
      firstName: this.holder.firstName || null, middleName: null, lastName: this.holder.lastName || null, dateOfBirth: null, nationality: null,
      address: { street1: null, street2: null, city: null, state: null, postalCode: null, country: null },
      tinOnFile: false, tinLast4: null, identityDocuments: [], proofOfAddress: null, selfie: null,
    };
    const text: Record<string, string> = {
      not_started: "You haven’t sent your details yet.",
      submitted: "We have your details and will review them shortly.",
      in_review: "We’re checking your details.",
      verified: "Your identity is verified.",
    };
    if (!rec) return { status: "not_started", statusText: text.not_started, canEdit: true, details: blank, missing: this.identityMissing(blank), requestedInfo: null, changeRequests: [], accountsWaiting: [] };
    return {
      status: rec.status, statusText: text[rec.status], submittedAt: rec.submittedAt, verifiedAt: null,
      canEdit: rec.status !== "verified", details: rec.details, missing: rec.status === "verified" ? [] : this.identityMissing(rec.details),
      requestedInfo: null, changeRequests: [], accountsWaiting: [],
    };
  }

  async identity(): Promise<IdentityView> { return this.identityView(); }

  async submitIdentity(input: IdentityInput): Promise<IdentityView> {
    const o = overlay(this.holder.customerId);
    const d: IdentityDetails = structuredClone(o.identity?.details ?? this.identityView().details);
    for (const k of ["firstName", "middleName", "lastName", "nationality"] as const) if (input[k] !== undefined) d[k] = input[k]?.trim() || null;
    if (input.dateOfBirth !== undefined) {
      const dob = input.dateOfBirth.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) throw new BankError("VALIDATION", "Give your date of birth as YYYY-MM-DD.", "dateOfBirth", 400);
      if (dob > `${Number(today().slice(0, 4)) - 18}${today().slice(4)}`) throw new BankError("VALIDATION", "You must be 18 or older to open an account online.", "dateOfBirth", 400);
      d.dateOfBirth = dob;
    }
    if (input.taxId) {
      const tin = input.taxId.replace(/[\s-]/g, "");
      if (!/^\d{9}$/.test(tin)) throw new BankError("VALIDATION", "Your Social Security number or ITIN is 9 digits (123-45-6789).", "taxId", 400);
      d.tinOnFile = true; d.tinLast4 = tin.slice(-4);
    }
    if (input.address) {
      if (/\bp\.?\s*o\.?\s*box\b/i.test(`${input.address.street1} ${input.address.street2 || ""}`)) throw new BankError("VALIDATION", "Give the street address where you live. A PO box can’t be your home address.", "street1", 400);
      d.address = { ...d.address, ...input.address };
    }
    if (input.identityDocument) {
      const x = input.identityDocument;
      if (!x.expiryDate || x.expiryDate <= today()) throw new BankError("VALIDATION", "That ID has expired. Use one that is still current.", "expiryDate", 400);
      const doc = { documentType: x.documentType, documentNumber: `••${x.documentNumber.slice(-4)}`, issuingCountry: x.issuingCountry || null, issuingAuthority: x.issuingAuthority || null, issueDate: x.issueDate || null, expiryDate: x.expiryDate, expired: false, front: null, back: null };
      const at = d.identityDocuments.findIndex((y) => y.documentType === x.documentType);
      if (at >= 0) d.identityDocuments[at] = { ...d.identityDocuments[at], ...doc, front: d.identityDocuments[at].front, back: d.identityDocuments[at].back };
      else d.identityDocuments.push(doc);
    }
    const missing = this.identityMissing(d);
    if (missing.length) throw new BankError("VALIDATION", `Still needed: ${missing.join(" ")}`, undefined, 400);
    o.identity = { status: o.identity?.status === "in_review" ? "in_review" : "submitted", submittedAt: o.identity?.submittedAt || new Date().toISOString(), details: d };
    return this.identityView();
  }

  async attachIdentityFile(input: IdentityFileInput): Promise<IdentityView> {
    const o = overlay(this.holder.customerId);
    if (!o.identity) throw new BankError("VALIDATION", "Send your details first (your name, date of birth, address, taxpayer ID and ID), then attach the documents.", undefined, 409);
    const d = o.identity.details;
    const file = { path: input.path };
    if (input.kind === "id_front" || input.kind === "id_back") {
      const doc = d.identityDocuments.find((x) => !input.documentType || x.documentType === input.documentType) || d.identityDocuments[d.identityDocuments.length - 1];
      if (!doc) throw new BankError("VALIDATION", "Send the ID’s details first.", undefined, 400);
      if (input.kind === "id_front") doc.front = file; else doc.back = file;
    } else if (input.kind === "proof_of_address") d.proofOfAddress = file;
    else d.selfie = file;
    return this.identityView();
  }
}
