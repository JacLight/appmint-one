/**
 * Banking API contract — what the Money module's screens need from the bank's API.
 *
 * This is the web side of /Users/imzee/projects/docs/APPMINT-MONEY-API-CONTRACT.md.
 * The API itself does not exist yet; the screens talk ONLY to `BankingApi` (see
 * ./adapter.ts), so wiring the real one is one class, no screen changes.
 *
 * Conventions (same as the doc):
 * - Money is an integer in MINOR units (cents) plus an ISO-4217 currency. The client
 *   never adds, subtracts or computes fees: every amount it shows comes from the API.
 * - Timestamps are ISO-8601 strings (UTC). Dates without time are `YYYY-MM-DD`.
 * - Full account numbers are returned ONLY by the receive-details reveal, after step-up.
 *   Everything else carries the last four as `mask`.
 * - Lists are cursor paged: `{ items, nextCursor }`.
 * - Errors are `{ error: { code, message, field? } }` with an HTTP status (see BankErrorCode).
 */

export type Currency = "USD";
export type ISODate = string;      // "2026-10-20T14:03:11Z"
export type DateOnly = string;     // "2026-10-20"

export interface Money {
  /** Minor units (cents). Always positive; direction is carried separately. */
  amount: number;
  currency: Currency;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string | null;
  /** Total matching rows, when the API can count them cheaply. */
  total?: number;
}

/* ───────────────────────── profile ───────────────────────── */

export interface BankProfile {
  customerId: string;
  firstName: string;
  lastName: string;
  /** How people at this bank find you: "@ama.kusi". */
  handle: string;
  email: string;
  /** For step-up prompts: "(•••) •••-0142". */
  phoneMasked?: string;
  /** Member since. */
  since: DateOnly;
}

/* ───────────────────────── accounts ───────────────────────── */

export type AccountType = "checking" | "savings";
export type AccountStatus = "open" | "frozen" | "closed";

export interface Account {
  id: string;
  type: AccountType;
  /** Product name: "Everyday Checking". */
  name: string;
  /** Customer's own label, if set. */
  nickname?: string;
  /** Last four of the account number. */
  mask: string;
  status: AccountStatus;
  currency: Currency;
  balances: {
    /** What can be spent or sent right now. */
    available: Money;
    /** Ledger balance (posted). */
    current: Money;
    /** Sum of pending debits, if any. */
    pending?: Money;
  };
  /** Savings: annual percentage yield, e.g. 3.75 means 3.75%. */
  apy?: number;
  /** Interest paid this year to date. */
  interestYtd?: Money;
  /** Money in / money out over the last 30 days (for the balance card). */
  last30Days?: { moneyIn: Money; moneyOut: Money };
  /** Daily closing balances, oldest first, for the sparkline (≤ 90 points). */
  balanceHistory?: { date: DateOnly; balance: number }[];
  openedAt: DateOnly;
}

/** `GET accounts`: every account plus the bank's own totals (the client never adds balances). */
export interface AccountList {
  items: Account[];
  total: {
    available: Money;
    current: Money;
    /** Money in / out across all accounts, last 30 days. */
    last30Days?: { moneyIn: Money; moneyOut: Money };
    /** Daily total closing balance, oldest first (≤ 90 points). */
    balanceHistory?: { date: DateOnly; balance: number }[];
  };
}

/* ───────────────────────── transactions ───────────────────────── */

export type TxDirection = "credit" | "debit";
export type TxStatus = "pending" | "posted" | "returned" | "canceled";
export type TxKind =
  | "card"          // debit card purchase
  | "atm"           // ATM cash
  | "ach"           // bank transfer in/out (another bank)
  | "internal"      // to/from someone at this bank
  | "own"           // between your own accounts
  | "wire"
  | "deposit"       // direct deposit / payroll
  | "interest"
  | "fee"
  | "refund";

export type TxCategory =
  | "income" | "transfers" | "groceries" | "dining" | "shopping" | "transport"
  | "bills" | "housing" | "health" | "entertainment" | "travel" | "cash" | "fees" | "interest" | "other";

export interface Counterparty {
  name: string;
  /** "merchant" | "person" | "bank_account" | "own_account" | "bank" */
  type: "merchant" | "person" | "bank_account" | "own_account" | "bank";
  /** Bank name for bank_account counterparties. */
  bankName?: string;
  /** Last four of the counterparty account, when relevant. */
  mask?: string;
  /** Square logo for merchants, when the API has one. */
  logoUrl?: string;
  /** City, ST for card purchases. */
  location?: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  direction: TxDirection;
  amount: Money;
  status: TxStatus;
  kind: TxKind;
  category: TxCategory;
  /** Clean display name: "Whole Foods Market". */
  description: string;
  /** Raw statement descriptor: "WHOLEFDS DAL 10245 DALLAS TX". */
  statementDescriptor?: string;
  counterparty?: Counterparty;
  /** Running ledger balance after this transaction (posted only). */
  balanceAfter?: Money;
  /** When it happened (authorization time for card). */
  createdAt: ISODate;
  /** When it posted; null while pending. */
  postedAt?: ISODate | null;
  /** Bank reference for support / disputes. */
  reference: string;
  memo?: string;
  /** Card used (card / atm kinds). */
  cardId?: string;
  cardMask?: string;
  /** Transfer that produced it (ach / internal / own kinds). */
  transferId?: string;
}

export interface TransactionQuery {
  accountId?: string;
  /** Free text over description, counterparty, memo, reference and amount ("42.10"). */
  q?: string;
  direction?: TxDirection;
  status?: TxStatus;
  category?: TxCategory;
  /** Inclusive date range. */
  from?: DateOnly;
  to?: DateOnly;
  cursor?: string;
  /** Default 50, max 200. */
  limit?: number;
}

/* ───────────────────────── recipients ───────────────────────── */

export type RecipientKind = "external" | "internal";

export interface Recipient {
  id: string;
  kind: RecipientKind;
  /** Account holder name (external) or member name (internal). */
  name: string;
  nickname?: string;
  external?: {
    bankName: string;
    routingNumber: string;
    /** Last four only. */
    accountMask: string;
    accountType: AccountType;
  };
  internal?: {
    /** "@ama.kusi" */
    handle: string;
  };
  createdAt: ISODate;
  lastSentAt?: ISODate | null;
}

export interface NewExternalRecipient {
  kind: "external";
  name: string;
  nickname?: string;
  routingNumber: string;
  accountNumber: string;
  accountType: AccountType;
}
export interface NewInternalRecipient {
  kind: "internal";
  /** Handle, email or phone of the member. */
  lookup: string;
  nickname?: string;
}
export type NewRecipient = NewExternalRecipient | NewInternalRecipient;

/** Result of looking up a routing number (bank name) or a member. */
export interface RoutingLookup { routingNumber: string; bankName: string; valid: boolean }
export interface MemberLookup { found: boolean; name?: string; handle?: string }

/* ───────────────────────── transfers ───────────────────────── */

/** external = to another bank (ACH), internal = to someone at this bank, own = between your accounts. */
export type TransferKind = "external" | "internal" | "own";
export type TransferSpeed = "standard" | "same_day" | "instant";
export type TransferStatus = "scheduled" | "pending" | "processing" | "completed" | "returned" | "failed" | "canceled";

export interface TransferInput {
  kind: TransferKind;
  fromAccountId: string;
  /** external / internal: a saved recipient. */
  recipientId?: string;
  /** own: your other account. */
  toAccountId?: string;
  amount: Money;
  memo?: string;
  /** external only. Default "standard". */
  speed?: TransferSpeed;
  /** Send later. Omit to send now. */
  scheduledFor?: DateOnly;
}

export interface TransferParty {
  name: string;
  /** "Everyday Checking ••4021", "Chase ••7781", "@ama.kusi" */
  detail: string;
}

/** Server-priced review of a transfer. Nothing has moved yet. */
export interface TransferPreview {
  previewId: string;
  kind: TransferKind;
  from: TransferParty & { accountId: string };
  to: TransferParty;
  amount: Money;
  /** Fee charged by the bank for this speed (0 when free). */
  fee: Money;
  /** amount + fee, computed by the server. */
  total: Money;
  speed: TransferSpeed;
  /** When the money will arrive. */
  arrivesBy: DateOnly;
  scheduledFor?: DateOnly | null;
  memo?: string;
  /** Available balance after this transfer, as the server sees it. */
  availableAfter?: Money;
  /** Step-up is required to submit (new recipient, large amount, …). */
  stepUp: StepUpRequirement | null;
  expiresAt: ISODate;
  /** Non-blocking notices: "First transfer to this recipient". */
  notices?: string[];
}

export interface Transfer {
  id: string;
  kind: TransferKind;
  status: TransferStatus;
  from: TransferParty & { accountId: string };
  to: TransferParty;
  amount: Money;
  fee: Money;
  total: Money;
  speed: TransferSpeed;
  memo?: string;
  createdAt: ISODate;
  scheduledFor?: DateOnly | null;
  arrivesBy: DateOnly;
  /** Customer-facing confirmation number. */
  reference: string;
}

/** One way a transfer of this kind can travel, priced by the bank. */
export interface TransferSpeedOption {
  speed: TransferSpeed;
  /** "Standard", "Same day", "Instant" */
  label: string;
  /** Fee for this speed (0 when free). */
  fee: Money;
  /** "1–3 business days", "Today if sent by 4 PM CT", "Seconds, any day" */
  timing: string;
}

/** What the customer can send this way today. Shown beside the send form. */
export interface TransferOptions {
  kind: TransferKind;
  /** Largest total the customer may send this way per day. */
  dailyLimit: Money;
  /** Already sent (or scheduled for) today this way. */
  sentToday: Money;
  /** dailyLimit − sentToday, computed by the server. */
  remainingToday: Money;
  speeds: TransferSpeedOption[];
  /** Same-day / processing cut-off in plain words, e.g. "4:00 PM CT on business days". */
  cutoff?: string;
  /** Short plain-language notes the bank wants shown before sending. */
  notes?: string[];
}

/* ───────────────────────── step-up (security) ───────────────────────── */

export type StepUpAction = "transfer" | "add_recipient" | "reveal_account_number" | "card_limits" | "pay_request";
export type StepUpMethod = "sms" | "email" | "totp";

export interface StepUpRequirement {
  /** Ask the API to send a code with `startStepUp`. */
  methods: StepUpMethod[];
}

export interface StepUpChallenge {
  challengeId: string;
  method: StepUpMethod;
  /** "(•••) •••-0142" or "a••@t••.com" */
  destination: string;
  expiresAt: ISODate;
  /** Code length (6). */
  length: number;
}

/** Sent with any action that required step-up. */
export interface StepUpProof { challengeId: string; code: string }

/* ───────────────────────── receive ───────────────────────── */

export interface ReceiveDetails {
  accountId: string;
  accountHolder: string;
  bankName: string;
  bankAddress: string;
  accountType: AccountType;
  routingNumber: string;
  /** Wire routing number if different from ACH routing. */
  wireRoutingNumber?: string;
  accountMask: string;
  /** Present only when revealed with a step-up proof. */
  accountNumber?: string;
}

/* ───────────────────────── requests ───────────────────────── */

export type RequestStatus = "open" | "paid" | "declined" | "canceled" | "expired";

export interface MoneyRequest {
  id: string;
  /** outgoing = you asked someone; incoming = someone asked you. */
  direction: "outgoing" | "incoming";
  amount: Money;
  memo?: string;
  status: RequestStatus;
  /** Who you asked / who asked you. null for an open link anyone can pay. */
  counterparty: { name: string; handle?: string } | null;
  /** outgoing: the account the money lands in. */
  toAccountId?: string;
  /** outgoing: a link anyone can pay through. */
  payUrl?: string;
  createdAt: ISODate;
  expiresAt: ISODate;
  paidAt?: ISODate | null;
}

export interface NewMoneyRequest {
  toAccountId: string;
  amount: Money;
  memo?: string;
  /** Member to ask (handle, email or phone). Omit to create a link only. */
  from?: string;
}

/* ───────────────────────── statements ───────────────────────── */

export interface Statement {
  id: string;
  accountId: string;
  /** "2026-09" */
  period: string;
  periodStart: DateOnly;
  periodEnd: DateOnly;
  openingBalance: Money;
  closingBalance: Money;
  totalIn: Money;
  totalOut: Money;
  /** Signed PDF URL, short-lived. */
  pdfUrl?: string;
  generatedAt: ISODate;
}

export interface StatementDetail extends Statement {
  account: Pick<Account, "id" | "type" | "name" | "mask">;
  accountHolder: string;
  transactions: Transaction[];
  interestPaid?: Money;
  feesCharged?: Money;
}

/* ───────────────────────── cards ───────────────────────── */

export type CardStatus = "active" | "frozen" | "inactive" | "closed";

export interface CardLimit {
  /** Current limit per day. */
  limit: Money;
  /** The most the customer may set. */
  max: Money;
  /** Used so far today. */
  used: Money;
}

export interface Card {
  id: string;
  accountId: string;
  type: "debit";
  network: "visa" | "mastercard";
  /** "physical" | "virtual" */
  form: "physical" | "virtual";
  nameOnCard: string;
  last4: string;
  expMonth: number;
  expYear: number;
  status: CardStatus;
  limits: {
    purchasesDaily: CardLimit;
    atmDaily: CardLimit;
  };
  /** Spent with this card this calendar month. */
  spentThisMonth?: Money;
  issuedAt: DateOnly;
}

export interface CardLimitsInput {
  purchasesDaily?: number;   // minor units
  atmDaily?: number;         // minor units
}

/* ───────────────────────── errors ───────────────────────── */

export type BankErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "VALIDATION"
  | "INSUFFICIENT_FUNDS"
  | "LIMIT_EXCEEDED"
  | "ACCOUNT_FROZEN"
  | "RECIPIENT_NOT_FOUND"
  | "STEP_UP_REQUIRED"
  | "STEP_UP_INVALID"
  | "STEP_UP_EXPIRED"
  | "PREVIEW_EXPIRED"
  | "DUPLICATE"
  | "UNAVAILABLE";

export class BankError extends Error {
  constructor(public code: BankErrorCode, message: string, public field?: string, public status = 400) {
    super(message);
    this.name = "BankError";
  }
}

/* ───────────────────────── the adapter interface ───────────────────────── */

/** Everything the screens may ask of the bank. One implementation per backend. */
/* ───────────── identity (CIP / KYC), the customer's side ───────────── */

/** Where my identity check is. The bank's own findings (risk, screening, notes) are never sent. */
export type IdentityStatus = "not_started" | "submitted" | "in_review" | "verified" | "needs_info" | "rejected";
export type IdentityDocType = "passport" | "national_id" | "drivers_license" | "residence_permit" | "visa" | "voter_id" | "military_id" | "other";
export type IdentityFileKind = "id_front" | "id_back" | "proof_of_address" | "selfie";
export type ProofOfAddressType = "utility_bill" | "bank_statement" | "tax_document" | "government_letter" | "lease_agreement" | "other";

export interface IdentityAddress {
  street1: string | null; street2?: string | null; city: string | null; state?: string | null; postalCode: string | null; country: string | null;
}
export interface IdentityFile { path: string }
export interface IdentityDocumentView {
  documentType: IdentityDocType | null;
  /** Last 4 only, masked by the bank. */
  documentNumber: string | null;
  issuingCountry: string | null; issuingAuthority: string | null;
  issueDate: string | null; expiryDate: string | null; expired: boolean;
  front: IdentityFile | null; back: IdentityFile | null;
}
export interface IdentityDetails {
  firstName: string | null; middleName: string | null; lastName: string | null;
  dateOfBirth: string | null; nationality: string | null;
  address: IdentityAddress;
  tinOnFile: boolean; tinLast4: string | null;
  identityDocuments: IdentityDocumentView[];
  proofOfAddress: IdentityFile | null; selfie: IdentityFile | null;
}
export interface IdentityView {
  status: IdentityStatus;
  statusText: string;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  canEdit: boolean;
  details: IdentityDetails;
  /** What is still needed, in the bank's words. */
  missing: string[];
  /** The bank asked for more: its message. */
  requestedInfo: { message: string; at: string | null } | null;
  changeRequests: { at: string; details: string; done: boolean }[];
  /** My accounts that open once I'm verified, and what each still needs. */
  accountsWaiting: { sk: string; accountNumber: string | null; nickname?: string | null; kind?: string | null; gaps: string[] }[];
  /** Set when a verified customer's update went to the bank as a change request. */
  changeRequest?: { sent: boolean; message: string };
}
export interface IdentityInput {
  firstName?: string; middleName?: string; lastName?: string; dateOfBirth?: string; nationality?: string;
  /** SSN or ITIN, 9 digits. Only sent when typed; never read back in full. */
  taxId?: string;
  address?: { street1: string; street2?: string; city: string; state?: string; postalCode: string; country: string };
  identityDocument?: { documentType: IdentityDocType; documentNumber: string; issuingCountry?: string; issuingAuthority?: string; issueDate?: string; expiryDate: string };
}
export interface IdentityFileInput { kind: IdentityFileKind; path: string; documentType?: IdentityDocType; proofType?: ProofOfAddressType; proofDate?: string }

export interface BankingApi {
  profile(): Promise<BankProfile>;

  listAccounts(): Promise<AccountList>;
  getAccount(id: string): Promise<Account>;

  listTransactions(query: TransactionQuery): Promise<Page<Transaction>>;
  getTransaction(id: string): Promise<Transaction>;

  listRecipients(kind?: RecipientKind): Promise<Recipient[]>;
  getRecipient(id: string): Promise<Recipient>;
  lookupRouting(routingNumber: string): Promise<RoutingLookup>;
  lookupMember(query: string): Promise<MemberLookup>;
  addRecipient(input: NewRecipient, proof?: StepUpProof): Promise<Recipient>;
  updateRecipient(id: string, patch: { nickname?: string }): Promise<Recipient>;
  removeRecipient(id: string): Promise<void>;

  transferOptions(kind: TransferKind): Promise<TransferOptions>;
  previewTransfer(input: TransferInput): Promise<TransferPreview>;
  submitTransfer(previewId: string, idempotencyKey: string, proof?: StepUpProof): Promise<Transfer>;
  getTransfer(id: string): Promise<Transfer>;
  listTransfers(query?: { status?: TransferStatus; limit?: number }): Promise<Page<Transfer>>;
  cancelTransfer(id: string): Promise<Transfer>;

  startStepUp(action: StepUpAction, method?: StepUpMethod): Promise<StepUpChallenge>;

  receiveDetails(accountId: string, proof?: StepUpProof): Promise<ReceiveDetails>;

  listRequests(direction?: "outgoing" | "incoming"): Promise<MoneyRequest[]>;
  createRequest(input: NewMoneyRequest): Promise<MoneyRequest>;
  cancelRequest(id: string): Promise<MoneyRequest>;
  declineRequest(id: string): Promise<MoneyRequest>;
  payRequest(id: string, fromAccountId: string, idempotencyKey: string, proof?: StepUpProof): Promise<Transfer>;

  listStatements(query?: { accountId?: string; year?: number }): Promise<Statement[]>;
  getStatement(id: string): Promise<StatementDetail>;

  listCards(): Promise<Card[]>;
  getCard(id: string): Promise<Card>;
  freezeCard(id: string): Promise<Card>;
  unfreezeCard(id: string): Promise<Card>;
  setCardLimits(id: string, input: CardLimitsInput, proof: StepUpProof): Promise<Card>;

  identity(): Promise<IdentityView>;
  submitIdentity(input: IdentityInput): Promise<IdentityView>;
  attachIdentityFile(input: IdentityFileInput): Promise<IdentityView>;
}
