'use client';

// from base-app/src/services/subscription-service.ts — ported verbatim; only import paths rewired.
import { getAppEngineClient } from '@/modules/store/lib/appmint-client';

/**
 * Storefront subscriptions for the signed-in shopper (appengine storefront.subscription.controller.ts).
 * The server computes every status, date, charge and allowed action; these calls only ask for them.
 */

/** A plan as a shop shows it (GET storefront/subscriptions/plans, public). */
export interface ShopPlan {
  name: string;
  title: string;
  description?: string;
  price: number;
  displayPrice?: string;
  currency: string;
  duration?: number;
  durationUnit?: string;
  trial: number;
  features?: { name?: string; value?: string; description?: string }[];
}

export type SubscriptionAction = 'pause' | 'resume' | 'change-plan' | 'renew' | 'cancel' | 'reactivate' | 'payment-method' | 'record-payment' | 'refund';

export interface CustomerSubscription {
  sk: string;
  data: {
    name: string;
    plan: string;
    planTitle?: string;
    amount: number;
    currency?: string;
    email?: string;
    status: string;
    startDate?: string;
    periodStart?: string;
    renewalDate?: string | null;
    cancelAtPeriodEnd?: boolean;
    cancelDate?: string;
    endDate?: string;
    pendingPlan?: string;
    lastPaymentError?: string;
    nextRetry?: string;
    failedAttempts?: number;
    renewals?: { date: string; plan?: string; amount: number; paymentRef?: string; paymentGateway?: string }[];
    history?: { date?: string; at?: string; event?: string; action?: string; status?: string; from?: string; note?: string }[];
  };
  allowedActions?: SubscriptionAction[];
  nextChargeDate?: string | null;
  paymentMethodSaved?: { provider: string } | null;
  setup?: { provider: string; redirectUrl?: string; checkoutSessionId?: string; clientSecret?: string };
  payment?: { outcome: string };
}

/** A hosted card page we sent the shopper to, kept until they come back with its session id. */
const PENDING_KEY = 'appmint-subscription-card-page';
export type PendingCardPage = { sk: string; kind: 'subscribe' | 'card'; plan?: string; at: number };

export const pendingCardPage = {
  set(p: PendingCardPage) {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    } catch {
      /* private window: the return still lists the subscription */
    }
  },
  take(): PendingCardPage | null {
    try {
      const v = localStorage.getItem(PENDING_KEY);
      localStorage.removeItem(PENDING_KEY);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  },
};

/** "every month", "every 3 months", "every week" */
export const periodWords = (duration?: number, unit?: string) => {
  const n = Number(duration) || 1;
  const u = String(unit || 'month');
  if (u === 'forever') return 'once';
  return n === 1 ? `every ${u}` : `every ${n} ${u}s`;
};

/** "/ month", "/ 3 months" */
export const perPeriod = (duration?: number, unit?: string) => {
  const n = Number(duration) || 1;
  const u = String(unit || 'month');
  if (u === 'forever') return '';
  return n === 1 ? `/ ${u}` : `/ ${n} ${u}s`;
};

class SubscriptionService {
  private client = getAppEngineClient();

  async plans(): Promise<ShopPlan[]> {
    try {
      const r = await this.client.processRequest('get', 'storefront/subscriptions/plans');
      return Array.isArray(r) ? r : r?.data || [];
    } catch (e) {
      console.error('Get plans error:', e);
      return [];
    }
  }

  /** The shopper's subscriptions, each with what it allows next. */
  async mine(): Promise<CustomerSubscription[]> {
    const r = await this.client.processRequest('get', 'storefront/subscriptions/get/me');
    const rows: any[] = Array.isArray(r) ? r : r?.data || [];
    const full = await Promise.all(rows.filter(x => x?.sk).map(x => this.get(String(x.sk)).catch(() => x)));
    return full.sort((a, b) => String(b?.data?.startDate || '').localeCompare(String(a?.data?.startDate || '')));
  }

  get(id: string): Promise<CustomerSubscription> {
    return this.client.processRequest('get', `storefront/subscriptions/${encodeURIComponent(id)}`);
  }

  /** Subscribe to the plan a product sells. With no card yet, the answer's `setup.redirectUrl` is the provider's card page. */
  subscribe(body: { productId?: string; plan?: string; successUrl?: string; cancelUrl?: string }): Promise<CustomerSubscription> {
    return this.client.processRequest('post', 'storefront/subscriptions/subscribe', body);
  }

  act(id: string, action: SubscriptionAction, body: any = {}): Promise<CustomerSubscription> {
    return this.client.processRequest('post', `storefront/subscriptions/${encodeURIComponent(id)}/${action}`, body);
  }
}

export const subscriptionService = new SubscriptionService();

export const serverWords = (err: any, fallback: string) => {
  const e = err?.response?.data?.message ?? err?.response?.data?.error;
  return (typeof e === 'string' ? e : e?.message) || err?.message || fallback;
};
