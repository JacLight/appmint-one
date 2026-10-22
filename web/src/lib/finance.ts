/**
 * Finance API — wallet + payouts, over appengine `client/finance/*`.
 * Contract from /Users/imzee/projects/appengine/src/finance.
 * Every customer has (lazily) a wallet; GET wallet returns null until first credit/method.
 */
import { apiReq, type Envelope, type Paged } from "./api";

const P = "client/finance";

export interface Wallet {
  status: "active" | "frozen" | "closed";
  currency: string;
  balance: number;
  pendingBalance: number;
  heldBalance: number;
  reservedBalance: number;
  lifetimeCredits: number;
  lifetimeDebits: number;
  lifetimeFees: number;
  payoutMethods?: PayoutMethod[];
  limits?: { minimumPayout?: number; maximumPayout?: number; dailyLimit?: number; dailyUsed?: number };
}
export interface WalletTransaction {
  transactionNumber?: string;
  type?: string;
  category?: string;
  amount: number;
  balanceBefore?: number;
  balanceAfter?: number;
  reference?: string;
  referenceType?: string;
  description?: string;
  wallet?: string;
}
export interface WalletBundle {
  wallet: Envelope<Wallet>;
  transactions: Envelope<WalletTransaction>[];
  summary: {
    balance: number;
    pendingBalance: number;
    availableBalance: number;
    lifetimeCredits: number;
    lifetimeDebits: number;
  };
}

export type PayoutMethodType = "bank" | "paypal" | "venmo" | "cashapp" | "debit_card" | "crypto";
export interface PayoutMethod {
  id?: string;
  type: PayoutMethodType;
  label?: string;
  isDefault?: boolean;
  bank?: { bankName?: string; accountType?: string; routingNumber?: string; accountNumber?: string; accountHolderName?: string; accountHolderType?: string };
  paypal?: { email?: string };
  venmo?: { handle?: string; phoneNumber?: string };
  cashapp?: { cashtag?: string; phoneNumber?: string };
  crypto?: { currency?: string; address?: string; network?: string };
}

export interface Payout { amount: number; status: string; currency?: string; [k: string]: any; }

export const finance = {
  /** null until the wallet exists (first credit or payout-method action). */
  wallet: () => apiReq<WalletBundle | null>("GET", `${P}/wallet`),

  requestPayout: (data: { amount: number; methodId?: string; notes?: string }) =>
    apiReq<Envelope<Payout>>("POST", `${P}/payouts/request`, { data }),
  payouts: (query?: { status?: string; page?: number; pageSize?: number }) =>
    apiReq<Paged<Envelope<Payout>>>("GET", `${P}/payouts`, { query }),
  payout: (payoutId: string) => apiReq<Envelope<Payout>>("GET", `${P}/payouts/${payoutId}`),

  payoutMethods: () => apiReq<PayoutMethod[]>("GET", `${P}/payout-methods`),
  addPayoutMethod: (data: PayoutMethod) => apiReq("POST", `${P}/payout-methods`, { data }),
  updatePayoutMethod: (id: string, data: Partial<PayoutMethod>) => apiReq("PUT", `${P}/payout-methods/${id}`, { data }),
  deletePayoutMethod: (id: string) => apiReq("DELETE", `${P}/payout-methods/${id}`),
  setDefaultPayoutMethod: (id: string) => apiReq("PUT", `${P}/payout-methods/${id}/default`, { data: {} }),
  updatePayoutSettings: (data: Record<string, any>) => apiReq("PUT", `${P}/payout-settings`, { data }),
};

export type FinanceApi = typeof finance;
