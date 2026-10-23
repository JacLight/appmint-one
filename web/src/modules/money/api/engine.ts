/** AppEngine's existing customer API is a different contract from the bank HTTP API. */
import {
  BankError,
  type Account,
  type AccountList,
  type BankingApi,
  type BankProfile,
  type Card,
  type IdentityFileInput,
  type IdentityInput,
  type NewMoneyRequest,
  type NewRecipient,
  type Recipient,
  type RecipientKind,
  type Statement,
  type StepUpAction,
  type StepUpMethod,
  type StepUpProof,
  type Transaction,
  type TransactionQuery,
  type TransferInput,
  type TransferKind,
  type TransferStatus,
  type CardLimitsInput,
} from "./types";

export type EngineTransport = <T = any>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  query?: Record<string, string | number | undefined>
) => Promise<T>;
type RecordView = {
  sk: string;
  createdate?: string;
  data: Record<string, any>;
};
const unavailable = (feature: string): never => {
  throw new BankError(
    "UNAVAILABLE",
    `${feature} isn’t available in online banking yet. Contact the bank for help.`,
    undefined,
    503
  );
};
const money = (amount: number) => ({ amount, currency: "USD" as const });
const id = encodeURIComponent;

export function engineAccount(record: RecordView): Account {
  const d = record.data;
  if (d.currency !== "USD") return unavailable("This account currency");
  if (
    !d.balances ||
    !Number.isFinite(d.balances.available) ||
    !Number.isFinite(d.balances.posted)
  )
    return unavailable("Account balances");
  return {
    id: record.sk,
    type: d.kind,
    name: d.nickname || d.kind?.replaceAll("_", " ") || "Account",
    nickname: d.nickname,
    mask: String(d.accountNumber || "").slice(-4),
    status: d.status,
    currency: "USD",
    balances: {
      available: money(d.balances.available),
      current: money(d.balances.posted),
      ...(Number.isFinite(d.balances.held)
        ? { pending: money(d.balances.held) }
        : {}),
    },
    overdraft: { optedIn: d.overdraft?.optedIn === true },
    openedAt: d.openedAt || record.createdate || "",
  };
}

export function engineTransaction(record: RecordView): Transaction {
  const d = record.data;
  if (d.currency !== "USD" || !Number.isFinite(d.amount))
    return unavailable("This transaction currency or amount");
  const card = d.card;
  const kind = card
    ? card.entryMode === "atm"
      ? "atm"
      : "card"
    : d.kind === "transfer"
    ? "internal"
    : d.rail === "wire"
    ? "wire"
    : d.rail === "ach"
    ? "ach"
    : d.kind === "interest"
    ? "interest"
    : d.kind === "fee"
    ? "fee"
    : d.direction === "in"
    ? "deposit"
    : "internal";
  const name = card?.merchantName || d.counterpartyName;
  return {
    id: record.sk,
    accountId: String(d.account),
    direction: d.direction === "in" ? "credit" : "debit",
    amount: money(d.amount),
    status:
      d.status === "cancelled"
        ? "canceled"
        : d.status === "in_review"
        ? "pending"
        : d.status,
    kind,
    category:
      kind === "fee"
        ? "fees"
        : kind === "interest"
        ? "interest"
        : kind === "atm"
        ? "cash"
        : kind === "internal" || kind === "ach" || kind === "wire"
        ? "transfers"
        : "other",
    description: d.description || name || d.kind || "Transaction",
    ...(name
      ? {
          counterparty: {
            name,
            type: card ? "merchant" : "bank_account",
          } as const,
        }
      : {}),
    actions: d.actions,
    createdAt: record.createdate || d.postedAt || "",
    postedAt: d.postedAt,
    reference: d.reference || record.sk,
    memo: d.memo,
    cardId: card?.card,
  };
}

function recipient(record: RecordView): Recipient {
  const d = record.data;
  return {
    id: record.sk,
    kind: "external",
    verificationStatus: d.verification?.status || "unverified",
    name: d.holderName || d.name,
    nickname: d.name,
    external: {
      bankName: d.bankName || "External bank",
      routingNumber: d.routingNumber || "",
      accountMask: d.accountLast4 || "",
      accountType: d.accountType,
    },
    createdAt: record.createdate || "",
  };
}

export function engineCard(record: RecordView): Card {
  const d = record.data;
  const limit = (value: unknown, ceiling: unknown) => {
    const finite =
      typeof value === "number" && Number.isFinite(value) ? money(value) : null;
    return {
      limit: finite,
      max:
        typeof ceiling === "number" && Number.isFinite(ceiling)
          ? money(ceiling)
          : null,
    };
  };
  return {
    id: record.sk,
    accountId: d.account,
    issuanceStatus: d.status,
    type: "debit",
    network: d.network,
    form: d.form,
    nameOnCard: d.nameOnCard,
    last4: d.last4 || "",
    expMonth: d.expMonth,
    expYear: d.expYear,
    status:
      d.status === "locked"
        ? "frozen"
        : d.status === "active"
        ? "active"
        : ["lost", "stolen", "closed", "expired"].includes(d.status)
        ? "closed"
        : "inactive",
    limits: {
      purchasesDaily: limit(d.controls?.dailySpend, d.bankLimits?.dailySpend),
      atmDaily: limit(d.controls?.dailyAtm, d.bankLimits?.dailyAtm),
    },
    controls: d.controls
      ? Object.fromEntries(
          ["perTransaction", "dailySpend", "dailyAtm"].map((key) => [
            key,
            d.controls[key] ?? null,
          ])
        )
      : undefined,
    bankLimits: d.bankLimits,
    limitsEditable: !!d.bankLimits,
    freezeEditable: ["active", "locked"].includes(d.status),
    issuedAt: d.activatedAt || record.createdate || "",
  };
}

export class EngineBankingApi implements BankingApi {
  constructor(
    private t: EngineTransport,
    private readProfile: () => Promise<BankProfile>
  ) {}
  bankReceivingStatus() { return this.t<any>("GET", "receiving"); }
  bankReceivingUpdate(request: Record<string, unknown>) { return this.t<any>("PUT", "receiving", request); }
  bankMemberResolve(username: string) { return this.t<any>("POST", "members/resolve", { username }); }
  bankRequestsList(direction: string, page = 1) { return this.t<any>("GET", "requests", undefined, { direction, page, pageSize: 25 }); }
  bankRequestGet(requestId: string, token?: string) { return this.t<any>("GET", `requests/${id(requestId)}`, undefined, { token }); }
  bankRequestCreate(request: Record<string, unknown>) { return this.t<any>("POST", "requests", request); }
  bankRequestClose(requestId: string, action: "cancel" | "decline") { return this.t<any>("POST", `requests/${id(requestId)}/${action}`, {}); }
  bankRequestShare(requestId: string) { return this.t<any>("POST", `requests/${id(requestId)}/share`, {}); }
  bankRequestPreview(request: Record<string, unknown>) { return this.t<any>("POST", "portal/transfers/preview", { ...request, kind: "request" }); }
  bankMemberPreview(request: Record<string, unknown>) { return this.t<any>("POST", "portal/transfers/preview", { ...request, kind: "internal" }); }
  bankAutopay(loanId: string) { return this.t<any>("GET", `loans/${id(loanId)}/autopay`); }
  bankAutopayAction(action: "agreement" | "confirm" | "revoke", loanId: string, request: Record<string, unknown>) { return this.t<any>("POST", `loans/${id(loanId)}/autopay/${action}`, request); }
  bankSecurityStatus() { return this.t<any>("GET", "security/status"); }
  bankSecurityReview(operation: string, request: Record<string, unknown>) { return this.t<any>("POST", "security/reviews", { operation, request }); }
  bankPortalReview(previewId: string, bankingProof?: string) { return this.t<any>("POST", "portal/transfers/security-review", { previewId, bankingProof }); }
  bankSecurityVerify(challengeId: string, code: string) { return this.t<any>("POST", `security/reviews/${id(challengeId)}/verify`, { code }); }
  bankSecurityRotate(request: Record<string, unknown>) { return this.t<any>("POST", "security/rotate", request); }
  profile() {
    return this.readProfile();
  }
  private async records(): Promise<RecordView[]> {
    return (await this.t<RecordView[]>("GET", "accounts")).filter(
      (r) => !["loan", "internal"].includes(r.data.kind)
    );
  }
  async listAccounts(): Promise<AccountList> {
    const items = (await this.records()).map(engineAccount);
    // This adapter executes on the server; each underlying balance is supplied by the bank ledger.
    return {
      items,
      total: {
        available: money(
          items.reduce((s, a) => s + a.balances.available.amount, 0)
        ),
        current: money(
          items.reduce((s, a) => s + a.balances.current.amount, 0)
        ),
      },
    };
  }
  async getAccount(accountId: string) {
    const response = await this.t<
      RecordView | { account: RecordView; gaps?: string[] }
    >("GET", `accounts/${id(accountId)}`);
    let record = "account" in response ? response.account : response;
    if (["loan", "internal"].includes(record.data.kind))
      throw new BankError("NOT_FOUND", "Deposit account not found.");
    // A still-pending detail is a raw account; use its actual account-list
    // ledger view rather than inventing zero balances for the common UI.
    if (!record.data.balances) {
      const actual = (await this.records()).find(
        (account) => account.sk === accountId
      );
      if (!actual) return unavailable("Account balances");
      record = actual;
    }
    return {
      ...engineAccount(record),
      ...("gaps" in response && Array.isArray(response.gaps)
        ? { gaps: response.gaps }
        : {}),
    };
  }
  private async accountTransactions(accountId: string): Promise<Transaction[]> {
    return (await this.archive(`accounts/${id(accountId)}/transactions`)).map(
      engineTransaction
    );
  }
  async listTransactions(q: TransactionQuery) {
    const accountIds = q.accountId
      ? [q.accountId]
      : (await this.records()).map((r) => r.sk);
    const all = (
      await Promise.all(accountIds.map((a) => this.accountTransactions(a)))
    ).flat();
    const unique = q.accountId
      ? all
      : [...new Map(all.map((t) => [t.id, t])).values()];
    const rows = unique
      .filter(
        (t) =>
          (!q.direction || t.direction === q.direction) &&
          (!q.status || t.status === q.status) &&
          (!q.category || t.category === q.category) &&
          (!q.from || (t.postedAt || t.createdAt).slice(0, 10) >= q.from) &&
          (!q.to || (t.postedAt || t.createdAt).slice(0, 10) <= q.to) &&
          (!q.q ||
            `${t.description} ${t.counterparty?.name || ""} ${t.memo || ""} ${
              t.reference
            } ${(t.amount.amount / 100).toFixed(2)}`
              .toLowerCase()
              .includes(q.q.toLowerCase()))
      )
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) ||
          a.accountId.localeCompare(b.accountId) ||
          a.id.localeCompare(b.id)
      );
    const offset = q.cursor ? Number(q.cursor) : 0;
    if (!Number.isSafeInteger(offset) || offset < 0)
      throw new BankError("VALIDATION", "The transaction page is invalid.");
    const size = Math.min(200, Math.max(1, Math.floor(q.limit || 50)));
    return {
      items: rows.slice(offset, offset + size),
      total: rows.length,
      nextCursor: offset + size < rows.length ? String(offset + size) : null,
    };
  }
  async getTransaction(transactionId: string, accountId?: string) {
    return engineTransaction(
      await this.t<RecordView>(
        "GET",
        `transactions/${id(transactionId)}`,
        undefined,
        { account: accountId }
      )
    );
  }
  async listRecipients(kind?: RecipientKind) {
    return kind === "internal"
      ? []
      : (await this.t<RecordView[]>("GET", "payees")).map(recipient);
  }
  async getRecipient(recipientId: string) {
    const found = (await this.listRecipients()).find(
      (r) => r.id === recipientId
    );
    if (!found) throw new BankError("NOT_FOUND", "Recipient not found.");
    return found;
  }
  async lookupRouting(
    _routingNumber: string
  ): Promise<Awaited<ReturnType<BankingApi["lookupRouting"]>>> {
    return unavailable("Routing-number lookup");
  }
  async lookupMember(
    query: string
  ): Promise<Awaited<ReturnType<BankingApi["lookupMember"]>>> {
    return this.bankMemberResolve(query);
  }
  async addRecipient(
    input: NewRecipient,
    _proof?: StepUpProof
  ): Promise<Recipient> {
    if (input.kind !== "external") return unavailable("Member lookup");
    return recipient(
      await this.t<RecordView>("POST", "payees", {
        holderName: input.name,
        name: input.nickname || input.name,
        routingNumber: input.routingNumber,
        accountNumber: input.accountNumber,
        accountType: input.accountType,
        holderType: "individual",
      })
    );
  }
  async startPayeeVerification(payeeId: string) {
    return recipient(
      await this.t<RecordView>(
        "POST",
        `payees/${id(payeeId)}/micro-deposits`,
        {}
      )
    );
  }
  async confirmPayeeVerification(payeeId: string, amounts: number[]) {
    return recipient(
      await this.t<RecordView>("POST", `payees/${id(payeeId)}/confirm`, {
        amounts,
      })
    );
  }
  async updateRecipient(
    _id: string,
    _patch: { nickname?: string }
  ): Promise<Recipient> {
    return unavailable("Recipient nickname changes");
  }
  async removeRecipient(recipientId: string) {
    await this.t("DELETE", `payees/${id(recipientId)}`);
  }
  transferOptions(kind: TransferKind) {
    return this.t<any>("GET", "portal/transfers/options", undefined, { kind });
  }
  previewTransfer(input: TransferInput) {
    return this.t<any>("POST", "portal/transfers/preview", input);
  }
  submitTransfer(
    previewId: string,
    idempotencyKey: string,
    proof?: StepUpProof
  ) {
    return this.t<any>("POST", "portal/transfers", {
      previewId,
      idempotencyKey,
      stepUp: proof,
    });
  }
  getTransfer(transferId: string) {
    return this.t<any>("GET", `portal/transfers/${id(transferId)}`);
  }
  async listTransfers(_query?: {
    status?: TransferStatus;
    limit?: number;
  }): Promise<Awaited<ReturnType<BankingApi["listTransfers"]>>> {
    return unavailable("A separate transfer-history view");
  }
  async cancelTransfer(
    transferId: string
  ): Promise<Awaited<ReturnType<BankingApi["cancelTransfer"]>>> {
    return unavailable("Transfer cancellation from this portal");
  }
  async startStepUp(
    _action: StepUpAction,
    _method?: StepUpMethod
  ): Promise<Awaited<ReturnType<BankingApi["startStepUp"]>>> {
    return unavailable("Security codes for banking actions");
  }
  async receiveDetails(
    accountId: string,
    _proof?: StepUpProof
  ): Promise<Awaited<ReturnType<BankingApi["receiveDetails"]>>> {
    return { ...await this.t<any>("GET", `accounts/${id(accountId)}/receive-details`), revealRequiresVerification: false };
  }
  async listRequests(
    direction: "outgoing" | "incoming" = "outgoing"
  ): Promise<Awaited<ReturnType<BankingApi["listRequests"]>>> {
    const rows = await this.archive("requests", { direction });
    return rows.map(row => ({ ...row, status: row.status === "cancelled" ? "canceled" : row.status })) as any;
  }
  async createRequest(
    input: NewMoneyRequest
  ): Promise<Awaited<ReturnType<BankingApi["createRequest"]>>> {
    const member = input.from ? await this.bankMemberResolve(input.from) : null;
    if (input.from && !member?.found) throw new BankError("NOT_FOUND", "No opted-in member with that exact username.");
    return this.bankRequestCreate({ toAccountId: input.toAccountId, amount: input.amount, memo: input.memo, ...(member?.recipientToken ? { payerToken: member.recipientToken } : {}) });
  }
  async cancelRequest(
    requestId: string
  ): Promise<Awaited<ReturnType<BankingApi["cancelRequest"]>>> {
    return this.bankRequestClose(requestId, "cancel");
  }
  async declineRequest(
    requestId: string
  ): Promise<Awaited<ReturnType<BankingApi["declineRequest"]>>> {
    return this.bankRequestClose(requestId, "decline");
  }
  async payRequest(
    _id: string,
    _from: string,
    _key: string,
    _proof?: StepUpProof
  ): Promise<Awaited<ReturnType<BankingApi["payRequest"]>>> {
    return unavailable("Pay requests through their reviewed confirmation screen");
  }
  private async archive(path: string, query?: Record<string, string | number | undefined>): Promise<any[]> {
    const out: any[] = [];
    for (let page = 1; ; page++) {
      const result = await this.t<any>("GET", path, undefined, {
        ...query,
        page,
        pageSize: 100,
      });
      if (Array.isArray(result)) return result; // older API compatibility
      const rows = result?.data;
      if (!Array.isArray(rows)) return unavailable("The complete archive");
      if (!rows.length) {
        if (out.length < result.total)
          return unavailable("The complete archive");
        return out;
      }
      out.push(...rows);
      if (
        typeof result.total === "number"
          ? out.length >= result.total
          : rows.length < 100
      )
        return out;
    }
  }
  async accountProducts() {
    return (await this.t<RecordView[]>("GET", "products")).map((record) => ({
      sk: record.sk,
      ...record.data,
    }));
  }
  openBankAccount(input: {
    product: string;
    nickname?: string;
    business?: Record<string, unknown>;
  }) {
    return this.t<any>("POST", "accounts", input);
  }
  renameBankAccount(accountId: string, nickname: string) {
    return this.t<any>("PUT", `accounts/${id(accountId)}/nickname`, {
      nickname,
    });
  }
  setBankOverdraft(accountId: string, optedIn: boolean) {
    return this.t<any>("PUT", `accounts/${id(accountId)}/overdraft`, {
      optedIn,
    });
  }
  orderBankCard(
    accountId: string,
    input: { form: string; shipping?: Record<string, unknown> }
  ) {
    return this.t<any>("POST", `accounts/${id(accountId)}/cards`, input);
  }
  activateBankCard(cardId: string, last4: string) {
    return this.t<any>("POST", `cards/${id(cardId)}/activate`, { last4 });
  }
  replaceBankCard(
    cardId: string,
    why: string,
    shipping?: Record<string, unknown>
  ) {
    return this.t<any>("POST", `cards/${id(cardId)}/replace`, {
      why,
      ...(shipping ? { shipping } : {}),
    });
  }
  async listDisputes() {
    return (await this.archive("disputes")).map((r) => ({
      id: r.sk,
      ...r.data,
    }));
  }
  async fileDispute(input: {
    transaction: string;
    reason: string;
    description: string;
  }) {
    return this.t<any>("POST", "disputes", input);
  }
  async withdrawDispute(disputeId: string, verification?: Record<string, unknown>) {
    return this.t<any>("POST", `disputes/${id(disputeId)}/withdraw`, verification || {});
  }
  async cancelTransaction(transactionId: string, verification?: Record<string, unknown>) {
    return this.t<any>("POST", `transactions/${id(transactionId)}/cancel`, verification || {});
  }
  updateLoanApplication(
    applicationId: string,
    changes: Record<string, unknown>
  ) {
    return this.t<any>(
      "PUT",
      `loans/applications/${id(applicationId)}`,
      changes
    );
  }
  attachLoanDocument(
    applicationId: string,
    input: { path: string; kind?: string; note?: string }
  ) {
    return this.t<any>(
      "POST",
      `loans/applications/${id(applicationId)}/documents`,
      input
    );
  }
  respondToLoanCondition(
    applicationId: string,
    index: number,
    input: {
      text?: string;
      documents?: { path: string; kind?: string; note?: string }[];
    }
  ) {
    return this.t<any>(
      "POST",
      `loans/applications/${id(applicationId)}/conditions/${index}/respond`,
      input
    );
  }
  listLoans() {
    return this.archive("loans");
  }
  listLoanApplications() {
    return this.archive("loans/applications");
  }
  loan(loanId: string) {
    return this.t<any>("GET", `loans/${id(loanId)}`);
  }
  loanApplication(applicationId: string) {
    return this.t<any>("GET", `loans/applications/${id(applicationId)}`);
  }
  loanProducts() {
    return this.t<any[]>("GET", "loans/products");
  }
  applyForLoan(input: Record<string, unknown>) {
    return this.t<any>("POST", "loans/applications", input);
  }
  withdrawLoanApplication(applicationId: string) {
    return this.t<any>(
      "POST",
      `loans/applications/${id(applicationId)}/withdraw`,
      {}
    );
  }
  answerLoanCounteroffer(applicationId: string, accept: boolean) {
    return this.t<any>(
      "POST",
      `loans/applications/${id(applicationId)}/counteroffer`,
      { accept }
    );
  }
  payLoan(
    loanId: string,
    input: { from: string; amount: number; idempotencyKey: string; bankingProof?: string }
  ) {
    return this.t<any>("POST", `loans/${id(loanId)}/payments`, input);
  }
  async listStatements(query?: {
    accountId?: string;
    year?: number;
  }): Promise<Statement[]> {
    const accountIds = query?.accountId
      ? [query.accountId]
      : (await this.records()).map((r) => r.sk);
    return (
      await Promise.all(
        accountIds.map(async (accountId) => {
          await this.getAccount(accountId); // Validate currency before labeling the statement figures USD.
          return (
            await this.archive(`accounts/${id(accountId)}/statements`)
          ).map((r) => {
            const d = r.data;
            return {
              id: r.sk,
              accountId,
              period: d.periodStart?.slice(0, 7),
              periodStart: d.periodStart,
              periodEnd: d.periodEnd,
              pdfUrl: `/account/banking/documents/statement/${id(
                r.sk
              )}?account=${id(accountId)}`,
              openingBalance: money(d.openingBalance),
              closingBalance: money(d.closingBalance),
              totalIn: money(d.credits),
              totalOut: money(d.debits),
              generatedAt: r.createdate || "",
            };
          });
        })
      )
    )
      .flat()
      .filter(
        (s) => !query?.year || s.periodStart.startsWith(String(query.year))
      )
      .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  }
  async getStatement(
    _id: string
  ): Promise<Awaited<ReturnType<BankingApi["getStatement"]>>> {
    return unavailable("Detailed printable statements");
  }
  async listCards() {
    return (
      await Promise.all(
        (
          await this.records()
        ).map((r) => this.t<RecordView[]>("GET", `accounts/${id(r.sk)}/cards`))
      )
    )
      .flat()
      .map(engineCard);
  }
  async getCard(cardId: string) {
    const found = (await this.listCards()).find((c) => c.id === cardId);
    if (!found) throw new BankError("NOT_FOUND", "Card not found.");
    return found;
  }
  async freezeCard(cardId: string) {
    return engineCard(
      await this.t<RecordView>("POST", `cards/${id(cardId)}/lock`)
    );
  }
  async unfreezeCard(cardId: string) {
    return engineCard(
      await this.t<RecordView>("POST", `cards/${id(cardId)}/unlock`)
    );
  }
  async setCardLimits(
    _id: string,
    _input: CardLimitsInput,
    _proof: StepUpProof
  ): Promise<Card> {
    return unavailable("Card limit changes with security verification");
  }
  async setPersonalCardLimits(
    cardId: string,
    controls: Record<string, number | null>
  ) {
    return engineCard(
      await this.t<RecordView>("PUT", `cards/${id(cardId)}/controls`, controls)
    );
  }
  identity() {
    return this.t<any>("GET", "identity");
  }
  submitIdentity(input: IdentityInput) {
    return this.t<any>("PUT", "identity", input);
  }
  attachIdentityFile(input: IdentityFileInput) {
    return this.t<any>("POST", "identity/documents", input);
  }
}
