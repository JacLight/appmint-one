/**
 * SAMPLE DATA — the only place it lives. Used by ./sample.ts in dev (or with
 * PORTAL_MONEY_SAMPLE=1) so the screens can be seen before the banking API exists.
 * Every screen in sample mode shows the "Sample data — banking API not connected" banner.
 *
 * Dates are generated relative to today so the data always looks current; the
 * pseudo-random parts are seeded, so the same day always renders the same data.
 */
import type {
  Account, Card, MoneyRequest, Recipient, Statement, Transaction, TxCategory, TxKind,
} from "./types";

export const SAMPLE_BANK = {
  name: "Tidewell",
  address: "1900 N Akard St, Dallas, TX 75201",
  routingNumber: "511924772",
  phoneMasked: "(•••) •••-0142",
};

/** Fictional routing numbers (valid ABA checksums; the 5xx prefix is unassigned, so none is a real bank) → bank names, for the routing lookup. */
export const SAMPLE_ROUTING: Record<string, string> = {
  "511924772": "Tidewell",
  "513024586": "Prairie National Bank",
  "511000612": "Bayou City Bank",
  "514923754": "Lone Star Credit Union",
  "516002149": "Harbor Federal Savings",
};

/** Members of the sample bank, for "someone at Tidewell" lookups. */
export const SAMPLE_MEMBERS = [
  { name: "Ama Kusi", handle: "@ama.kusi", email: "ama.kusi@test.local", phone: "2145550188" },
  { name: "Kwame Mensah", handle: "@kwame.m", email: "kwame.mensah@test.local", phone: "4695550123" },
  { name: "Priya Raman", handle: "@priya.r", email: "priya.raman@test.local", phone: "9725550147" },
  { name: "Diego Alvarez", handle: "@diego.a", email: "diego.alvarez@test.local", phone: "2145550199" },
];

const CHK = "acc_chk_4021";
const SAV = "acc_sav_8830";

/* ───────────── helpers (fixture construction only) ───────────── */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const usd = (amount: number) => ({ amount: Math.round(amount), currency: "USD" as const });
const iso = (d: Date) => d.toISOString();
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
function dayAt(base: Date, daysAgo: number, hour: number, minute: number) {
  // Hours are Dallas local time (UTC−5 in daylight time).
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() - daysAgo, hour + 5, minute));
  return d;
}

type Draft = Omit<Transaction, "id" | "reference" | "balanceAfter" | "postedAt" | "status" | "amount" | "createdAt"> & {
  cents: number; at: Date; pending?: boolean;
};

const MERCHANTS: Record<string, { name: string; cat: TxCategory; min: number; max: number; loc: string; desc: string }[]> = {
  groceries: [
    { name: "Whole Foods Market", cat: "groceries", min: 3800, max: 14200, loc: "Dallas, TX", desc: "WHOLEFDS DAL 10245" },
    { name: "Tom Thumb", cat: "groceries", min: 2200, max: 9800, loc: "Dallas, TX", desc: "TOM THUMB #2581" },
    { name: "Trader Joe's", cat: "groceries", min: 2600, max: 8900, loc: "Dallas, TX", desc: "TRADER JOE S #403" },
  ],
  dining: [
    { name: "Starbucks", cat: "dining", min: 485, max: 940, loc: "Dallas, TX", desc: "STARBUCKS STORE 09841" },
    { name: "Chipotle", cat: "dining", min: 1180, max: 1690, loc: "Dallas, TX", desc: "CHIPOTLE 2210" },
    { name: "Tacos y Más", cat: "dining", min: 1800, max: 3200, loc: "Dallas, TX", desc: "SQ *TACOS Y MAS" },
    { name: "Pecan Lodge", cat: "dining", min: 2800, max: 5600, loc: "Dallas, TX", desc: "PECAN LODGE DEEP ELLUM" },
    { name: "Ascension Coffee", cat: "dining", min: 520, max: 1450, loc: "Dallas, TX", desc: "ASCENSION COFFEE DESIGN" },
  ],
  transport: [
    { name: "Uber", cat: "transport", min: 1100, max: 2800, loc: "San Francisco, CA", desc: "UBER *TRIP" },
    { name: "Shell", cat: "transport", min: 3800, max: 5600, loc: "Dallas, TX", desc: "SHELL OIL 57444" },
    { name: "DART", cat: "transport", min: 300, max: 600, loc: "Dallas, TX", desc: "DART GOPASS" },
  ],
  shopping: [
    { name: "Target", cat: "shopping", min: 1900, max: 11800, loc: "Dallas, TX", desc: "TARGET 00012345" },
    { name: "Amazon", cat: "shopping", min: 1500, max: 8900, loc: "Seattle, WA", desc: "AMAZON MKTPL*2K4" },
    { name: "CVS Pharmacy", cat: "health", min: 900, max: 4200, loc: "Dallas, TX", desc: "CVS/PHARMACY #07211" },
  ],
};

/* ───────────── the fixture ───────────── */

export interface SampleFixture {
  accounts: Account[];
  transactions: Transaction[];
  recipients: Recipient[];
  cards: Card[];
  requests: MoneyRequest[];
  statements: Statement[];
}

const cache = new Map<string, SampleFixture>();

/** The sample bank as of `today`, for a customer called `holder`. */
export function sampleFixture(holder: { firstName: string; lastName: string }, today = new Date()): SampleFixture {
  const key = `${dateOnly(today)}|${holder.firstName}|${holder.lastName}`;
  const hit = cache.get(key);
  if (hit) return structuredClone(hit);

  const DAYS = 200;
  const seedDay = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / 864e5);
  const r = rng(seedDay);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const between = (min: number, max: number) => Math.round(min + r() * (max - min));
  const drafts: Draft[] = [];

  for (let ago = DAYS; ago >= 0; ago--) {
    const d = dayAt(today, ago, 12, 0);
    const dow = d.getUTCDay();
    const dom = d.getUTCDate();
    const add = (x: Omit<Draft, "at"> & { hour?: number; minute?: number }) =>
      drafts.push({ ...x, at: dayAt(today, ago, x.hour ?? between(8, 21), x.minute ?? between(0, 59)) });

    // Payroll every other Friday.
    if (dow === 5 && Math.floor(ago / 7) % 2 === 0) {
      add({ accountId: CHK, direction: "credit", cents: 236840, kind: "deposit", category: "income", description: "Calder & Finch Design",
        statementDescriptor: "CALDER FINCH DES PAYROLL PPD", counterparty: { name: "Calder & Finch Design", type: "merchant" }, memo: "Payroll", hour: 6, minute: 2 });
    }
    // Rent on the 1st to a saved recipient at another bank.
    if (dom === 1) {
      add({ accountId: CHK, direction: "debit", cents: 165000, kind: "ach", category: "housing", description: "Bishop Arts Lofts",
        statementDescriptor: "ACH DEBIT BISHOP ARTS LOFTS", counterparty: { name: "Bishop Arts Lofts", type: "bank_account", bankName: "Bayou City Bank", mask: "2290" }, memo: "Rent", hour: 9, minute: 0 });
    }
    // Move to savings on the 2nd.
    if (dom === 2) {
      add({ accountId: CHK, direction: "debit", cents: 50000, kind: "own", category: "transfers", description: "To High-Yield Savings",
        counterparty: { name: "High-Yield Savings", type: "own_account", mask: "8830" }, memo: "Monthly savings", hour: 7, minute: 30 });
      add({ accountId: SAV, direction: "credit", cents: 50000, kind: "own", category: "transfers", description: "From Everyday Checking",
        counterparty: { name: "Everyday Checking", type: "own_account", mask: "4021" }, memo: "Monthly savings", hour: 7, minute: 30 });
    }
    // Savings interest on the last day of the month.
    const lastDom = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    if (dom === lastDom) {
      add({ accountId: SAV, direction: "credit", cents: between(5400, 6100), kind: "interest", category: "interest", description: "Interest paid",
        counterparty: { name: "Tidewell", type: "bank" }, hour: 23, minute: 50 });
    }
    // Bills.
    if (dom === 6) add({ accountId: CHK, direction: "debit", cents: between(8400, 13200), kind: "ach", category: "bills", description: "Oncor Electric",
      statementDescriptor: "ONCOR ELEC DELIVERY WEB PMT", counterparty: { name: "Oncor Electric", type: "merchant" }, hour: 10 });
    if (dom === 9) add({ accountId: CHK, direction: "debit", cents: 6500, kind: "card", category: "bills", description: "AT&T Wireless",
      statementDescriptor: "ATT*BILL PAYMENT", counterparty: { name: "AT&T Wireless", type: "merchant", location: "Dallas, TX" }, hour: 4 });
    if (dom === 12) add({ accountId: CHK, direction: "debit", cents: 1549, kind: "card", category: "entertainment", description: "Netflix",
      statementDescriptor: "NETFLIX.COM", counterparty: { name: "Netflix", type: "merchant", location: "Los Gatos, CA" }, hour: 3 });
    if (dom === 15) add({ accountId: CHK, direction: "debit", cents: 1199, kind: "card", category: "entertainment", description: "Spotify",
      statementDescriptor: "SPOTIFY USA", counterparty: { name: "Spotify", type: "merchant", location: "New York, NY" }, hour: 3 });
    if (dom === 18) add({ accountId: CHK, direction: "debit", cents: 7900, kind: "card", category: "health", description: "Trinity Climbing Gym",
      statementDescriptor: "TRINITY CLIMBING DALLAS", counterparty: { name: "Trinity Climbing Gym", type: "merchant", location: "Dallas, TX" }, hour: 5 });

    // Everyday spending.
    const spend = (group: string, p: number) => {
      if (r() < p) {
        const m = pick(MERCHANTS[group]);
        add({ accountId: CHK, direction: "debit", cents: between(m.min, m.max), kind: "card", category: m.cat, description: m.name,
          statementDescriptor: `${m.desc} ${m.loc.toUpperCase().replace(",", "")}`, counterparty: { name: m.name, type: "merchant", location: m.loc } });
      }
    };
    spend("groceries", dow === 0 || dow === 3 ? 0.85 : 0.08);
    spend("dining", 0.55);
    spend("transport", 0.35);
    spend("shopping", 0.22);
  }

  // People and one-offs, placed on fixed days.
  const one = (ago: number, x: Omit<Draft, "at">, hour = 18, minute = 12) => drafts.push({ ...x, at: dayAt(today, ago, hour, minute) });
  one(3, { accountId: CHK, direction: "debit", cents: 12000, kind: "internal", category: "transfers", description: "Ama Kusi",
    counterparty: { name: "Ama Kusi", type: "person" }, memo: "Leon Bridges tickets" }, 20, 41);
  one(9, { accountId: CHK, direction: "credit", cents: 4500, kind: "internal", category: "transfers", description: "Kwame Mensah",
    counterparty: { name: "Kwame Mensah", type: "person" }, memo: "Dinner split" }, 22, 5);
  one(16, { accountId: CHK, direction: "debit", cents: 25000, kind: "ach", category: "transfers", description: "Jordan Ellis",
    counterparty: { name: "Jordan Ellis", type: "bank_account", bankName: "Prairie National Bank", mask: "7781" }, memo: "Road trip share" }, 11, 20);
  one(23, { accountId: CHK, direction: "debit", cents: 6000, kind: "atm", category: "cash", description: "ATM cash · Deep Ellum",
    statementDescriptor: "ATM TIDEWELL 2700 ELM ST DALLAS TX", counterparty: { name: "Tidewell ATM", type: "bank", location: "Dallas, TX" } }, 23, 2);
  one(27, { accountId: CHK, direction: "credit", cents: 3499, kind: "refund", category: "shopping", description: "Amazon",
    statementDescriptor: "AMAZON MKTPL REFUND", counterparty: { name: "Amazon", type: "merchant", location: "Seattle, WA" }, memo: "Return" }, 14, 9);
  one(38, { accountId: CHK, direction: "debit", cents: 30000, kind: "ach", category: "transfers", description: "Grace Owusu",
    counterparty: { name: "Grace Owusu", type: "bank_account", bankName: "Lone Star Credit Union", mask: "4410" }, memo: "Happy birthday Mom" }, 9, 15);
  one(44, { accountId: SAV, direction: "debit", cents: 30000, kind: "own", category: "transfers", description: "To Everyday Checking",
    counterparty: { name: "Everyday Checking", type: "own_account", mask: "4021" }, memo: "Car repair" }, 16, 0);
  one(44, { accountId: CHK, direction: "credit", cents: 30000, kind: "own", category: "transfers", description: "From High-Yield Savings",
    counterparty: { name: "High-Yield Savings", type: "own_account", mask: "8830" }, memo: "Car repair" }, 16, 0);
  one(45, { accountId: CHK, direction: "debit", cents: 41285, kind: "card", category: "transport", description: "Firestone Complete Auto Care",
    statementDescriptor: "FIRESTONE #024580 DALLAS TX", counterparty: { name: "Firestone Complete Auto Care", type: "merchant", location: "Dallas, TX" } }, 15, 32);
  one(61, { accountId: CHK, direction: "debit", cents: 250, kind: "fee", category: "fees", description: "Out-of-network ATM fee",
    counterparty: { name: "Tidewell", type: "bank" } }, 21, 10);
  one(72, { accountId: CHK, direction: "debit", cents: 38940, kind: "card", category: "travel", description: "Southwest Airlines",
    statementDescriptor: "SOUTHWES 5262412345678", counterparty: { name: "Southwest Airlines", type: "merchant", location: "Dallas, TX" } }, 19, 47);

  // Most recent two card purchases are still pending.
  drafts.sort((a, b) => a.at.getTime() - b.at.getTime());
  const now = today.getTime();
  const lastCard = drafts.filter((x) => x.kind === "card" && x.at.getTime() <= now).slice(-2);
  lastCard.forEach((x) => { x.pending = true; });
  const visible = drafts.filter((x) => x.at.getTime() <= now);

  // Running balances, oldest first, from each account's opening balance.
  const opening: Record<string, number> = { [CHK]: 231270, [SAV]: 1622000 };
  const ledger: Record<string, number> = { ...opening };
  const history: Record<string, { date: string; balance: number }[]> = { [CHK]: [], [SAV]: [] };
  const transactions: Transaction[] = [];
  let n = 0;
  for (const x of visible) {
    n++;
    const signed = x.direction === "credit" ? x.cents : -x.cents;
    if (!x.pending) ledger[x.accountId] += signed;
    const { cents, at, pending, ...rest } = x;
    transactions.push({
      ...rest,
      id: `tx_${seedDay}_${n}`,
      amount: usd(cents),
      status: pending ? "pending" : "posted",
      createdAt: iso(at),
      postedAt: pending ? null : iso(new Date(at.getTime() + (x.kind === "card" ? 864e5 : 0))),
      balanceAfter: pending ? undefined : usd(ledger[x.accountId]),
      reference: `TW${(seedDay * 7919 + n * 104729).toString(36).toUpperCase().slice(-9)}`,
      cardId: x.kind === "card" || x.kind === "atm" ? (x.description === "Amazon" || x.description === "Netflix" || x.description === "Spotify" ? "card_virtual_5108" : "card_debit_7733") : undefined,
      cardMask: x.kind === "card" || x.kind === "atm" ? (x.description === "Amazon" || x.description === "Netflix" || x.description === "Spotify" ? "5108" : "7733") : undefined,
    });
  }
  // Daily closing balance history (last 90 days).
  for (const acc of [CHK, SAV]) {
    let bal = opening[acc];
    const byDay = new Map<string, number>();
    for (const t of transactions.filter((t) => t.accountId === acc && t.status === "posted")) {
      bal += t.direction === "credit" ? t.amount.amount : -t.amount.amount;
      byDay.set(t.createdAt.slice(0, 10), bal);
    }
    let running = opening[acc];
    for (let ago = DAYS; ago >= 0; ago--) {
      const day = dateOnly(dayAt(today, ago, 12, 0));
      if (byDay.has(day)) running = byDay.get(day)!;
      if (ago <= 90) history[acc].push({ date: day, balance: running });
    }
  }
  transactions.reverse(); // newest first

  const pendingOut = (acc: string) => transactions.filter((t) => t.accountId === acc && t.status === "pending" && t.direction === "debit").reduce((s, t) => s + t.amount.amount, 0);
  const last30 = (acc: string, dir: "credit" | "debit") => {
    const since = now - 30 * 864e5;
    return transactions.filter((t) => t.accountId === acc && t.direction === dir && new Date(t.createdAt).getTime() >= since).reduce((s, t) => s + t.amount.amount, 0);
  };
  const yearStart = Date.UTC(today.getUTCFullYear(), 0, 1);
  const interestYtd = transactions.filter((t) => t.accountId === SAV && t.kind === "interest" && new Date(t.createdAt).getTime() >= yearStart).reduce((s, t) => s + t.amount.amount, 0);

  const accounts: Account[] = [
    {
      id: CHK, type: "checking", name: "Everyday Checking", mask: "4021", status: "open", currency: "USD",
      balances: { current: usd(ledger[CHK]), available: usd(ledger[CHK] - pendingOut(CHK)), pending: usd(pendingOut(CHK)) },
      last30Days: { moneyIn: usd(last30(CHK, "credit")), moneyOut: usd(last30(CHK, "debit")) },
      balanceHistory: history[CHK], openedAt: dateOnly(dayAt(today, 900, 12, 0)),
    },
    {
      id: SAV, type: "savings", name: "High-Yield Savings", mask: "8830", status: "open", currency: "USD",
      balances: { current: usd(ledger[SAV]), available: usd(ledger[SAV]) },
      apy: 3.8, interestYtd: usd(interestYtd),
      last30Days: { moneyIn: usd(last30(SAV, "credit")), moneyOut: usd(last30(SAV, "debit")) },
      balanceHistory: history[SAV], openedAt: dateOnly(dayAt(today, 610, 12, 0)),
    },
  ];

  const holderName = `${holder.firstName} ${holder.lastName}`.trim();
  const usedToday = (cardId: string, kinds: TxKind[]) => transactions.filter((t) => t.cardId === cardId && kinds.includes(t.kind) && t.createdAt.slice(0, 10) === dateOnly(today)).reduce((s, t) => s + t.amount.amount, 0);
  const monthStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1);
  const spentMonth = (cardId: string) => transactions.filter((t) => t.cardId === cardId && t.direction === "debit" && new Date(t.createdAt).getTime() >= monthStart).reduce((s, t) => s + t.amount.amount, 0);
  const cards: Card[] = [
    {
      id: "card_debit_7733", accountId: CHK, type: "debit", network: "visa", form: "physical", nameOnCard: holderName.toUpperCase(),
      last4: "7733", expMonth: 8, expYear: today.getUTCFullYear() + 3, status: "active",
      limits: { purchasesDaily: { limit: usd(500000), max: usd(1000000), used: usd(usedToday("card_debit_7733", ["card"])) },
        atmDaily: { limit: usd(50000), max: usd(100000), used: usd(usedToday("card_debit_7733", ["atm"])) } },
      spentThisMonth: usd(spentMonth("card_debit_7733")), issuedAt: dateOnly(dayAt(today, 420, 12, 0)),
    },
    {
      id: "card_virtual_5108", accountId: CHK, type: "debit", network: "visa", form: "virtual", nameOnCard: holderName.toUpperCase(),
      last4: "5108", expMonth: 3, expYear: today.getUTCFullYear() + 2, status: "active",
      limits: { purchasesDaily: { limit: usd(150000), max: usd(500000), used: usd(usedToday("card_virtual_5108", ["card"])) },
        atmDaily: { limit: usd(0), max: usd(0), used: usd(0) } },
      spentThisMonth: usd(spentMonth("card_virtual_5108")), issuedAt: dateOnly(dayAt(today, 180, 12, 0)),
    },
  ];

  const lastSent = (name: string) => transactions.find((t) => t.counterparty?.name === name && t.direction === "debit")?.createdAt ?? null;
  const recipients: Recipient[] = [
    { id: "rcp_bishop", kind: "external", name: "Bishop Arts Lofts", nickname: "Rent", external: { bankName: "Bayou City Bank", routingNumber: "511000612", accountMask: "2290", accountType: "checking" }, createdAt: iso(dayAt(today, 400, 12, 0)), lastSentAt: lastSent("Bishop Arts Lofts") },
    { id: "rcp_jordan", kind: "external", name: "Jordan Ellis", external: { bankName: "Prairie National Bank", routingNumber: "513024586", accountMask: "7781", accountType: "checking" }, createdAt: iso(dayAt(today, 210, 12, 0)), lastSentAt: lastSent("Jordan Ellis") },
    { id: "rcp_grace", kind: "external", name: "Grace Owusu", nickname: "Mom", external: { bankName: "Lone Star Credit Union", routingNumber: "514923754", accountMask: "4410", accountType: "savings" }, createdAt: iso(dayAt(today, 300, 12, 0)), lastSentAt: lastSent("Grace Owusu") },
    { id: "rcp_ama", kind: "internal", name: "Ama Kusi", internal: { handle: "@ama.kusi" }, createdAt: iso(dayAt(today, 150, 12, 0)), lastSentAt: lastSent("Ama Kusi") },
    { id: "rcp_kwame", kind: "internal", name: "Kwame Mensah", internal: { handle: "@kwame.m" }, createdAt: iso(dayAt(today, 120, 12, 0)), lastSentAt: null },
  ];

  const requests: MoneyRequest[] = [
    { id: "req_in_pizza", direction: "incoming", amount: usd(2450), memo: "Pizza night", status: "open", counterparty: { name: "Kwame Mensah", handle: "@kwame.m" },
      createdAt: iso(dayAt(today, 1, 21, 4)), expiresAt: iso(dayAt(today, -13, 21, 4)) },
    { id: "req_out_rangers", direction: "outgoing", amount: usd(6000), memo: "Rangers tickets", status: "open", counterparty: { name: "Ama Kusi", handle: "@ama.kusi" },
      toAccountId: CHK, payUrl: "https://pay.tidewell.example/r/7QK2M9", createdAt: iso(dayAt(today, 2, 13, 30)), expiresAt: iso(dayAt(today, -12, 13, 30)) },
    { id: "req_out_book", direction: "outgoing", amount: usd(4000), memo: "Book club dues", status: "open", counterparty: null,
      toAccountId: CHK, payUrl: "https://pay.tidewell.example/r/X4D81B", createdAt: iso(dayAt(today, 5, 9, 12)), expiresAt: iso(dayAt(today, -9, 9, 12)) },
    { id: "req_out_lunch", direction: "outgoing", amount: usd(3500), memo: "Lunch at Pecan Lodge", status: "paid", counterparty: { name: "Kwame Mensah", handle: "@kwame.m" },
      toAccountId: CHK, createdAt: iso(dayAt(today, 12, 14, 0)), expiresAt: iso(dayAt(today, -2, 14, 0)), paidAt: iso(dayAt(today, 9, 22, 5)) },
    { id: "req_in_gift", direction: "incoming", amount: usd(2000), memo: "Gift for Priya", status: "paid", counterparty: { name: "Diego Alvarez", handle: "@diego.a" },
      createdAt: iso(dayAt(today, 20, 10, 0)), expiresAt: iso(dayAt(today, 6, 10, 0)), paidAt: iso(dayAt(today, 19, 8, 30)) },
  ];

  // Monthly statements for every full month covered by the data.
  const statements: Statement[] = [];
  for (let m = 1; m <= 6; m++) {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - m, 1));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - m + 1, 0, 23, 59, 59));
    if (start.getTime() < now - DAYS * 864e5) break;
    for (const acc of accounts) {
      const inPeriod = transactions.filter((t) => t.accountId === acc.id && t.status === "posted" && new Date(t.createdAt) >= start && new Date(t.createdAt) <= end);
      const before = transactions.filter((t) => t.accountId === acc.id && t.status === "posted" && new Date(t.createdAt) < start);
      const openBal = before.length ? before[0].balanceAfter!.amount : opening[acc.id];
      const closeBal = inPeriod.length ? inPeriod[0].balanceAfter!.amount : openBal;
      statements.push({
        id: `stm_${acc.mask}_${dateOnly(start).slice(0, 7)}`, accountId: acc.id, period: dateOnly(start).slice(0, 7),
        periodStart: dateOnly(start), periodEnd: dateOnly(end), openingBalance: usd(openBal), closingBalance: usd(closeBal),
        totalIn: usd(inPeriod.filter((t) => t.direction === "credit").reduce((s, t) => s + t.amount.amount, 0)),
        totalOut: usd(inPeriod.filter((t) => t.direction === "debit").reduce((s, t) => s + t.amount.amount, 0)),
        generatedAt: iso(new Date(end.getTime() + 2 * 864e5)),
      });
    }
  }

  const fx: SampleFixture = { accounts, transactions, recipients, cards, requests, statements };
  cache.clear();
  cache.set(key, fx);
  return structuredClone(fx);
}
