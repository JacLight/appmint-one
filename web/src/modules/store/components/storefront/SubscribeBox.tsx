'use client';

// from base-app/src/components/storefront/SubscribeBox.tsx — ported verbatim; only import paths rewired.
import React, { useEffect, useState } from 'react';
import { activeSession } from '@/modules/store/lib/active-session';
import { pendingCardPage, perPeriod, periodWords, serverWords, subscriptionService, type ShopPlan } from '@/modules/store/services/subscription-service';

const money = (v: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(v) || 0);

/**
 * The buy box of a product that sells a subscription plan (product.data.plan): the plan's price
 * per period and a Subscribe button instead of Add to cart. A shopper signs in first (the
 * subscription is theirs, in My Account › Subscriptions); then the store's payment provider
 * keeps their card on its own secure page, and the first period is charged when they come back.
 */
export const SubscribeBox: React.FC<{ productId: string; planName: string; fallbackPrice?: number }> = ({ productId, planName, fallbackPrice }) => {
  const [plan, setPlan] = useState<ShopPlan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let live = true;
    subscriptionService.plans().then(ps => {
      if (live) {
        setPlan(ps.find(p => p.name === planName) || null);
        setLoaded(true);
      }
    });
    return () => {
      live = false;
    };
  }, [planName]);

  const subscribe = async () => {
    setProblem('');
    const here = window.location.pathname + window.location.search;
    if (!activeSession.getToken()) {
      window.location.assign(`/login?callbackUrl=${encodeURIComponent(here)}`);
      return;
    }
    setBusy(true);
    try {
      const origin = window.location.origin;
      const urls = { successUrl: `${origin}/account/subscriptions`, cancelUrl: `${origin}${here}` };
      // Came back from the card page without finishing: carry on with that subscription, don't start a second one.
      const waiting = (await subscriptionService.mine().catch(() => [])).find(x => x.data?.status === 'new' && x.data?.plan === planName);
      const sub = waiting ? await subscriptionService.act(waiting.sk, 'payment-method', urls) : await subscriptionService.subscribe({ productId, ...urls });
      if (sub?.setup?.redirectUrl) {
        pendingCardPage.set({ sk: sub.sk, kind: 'subscribe', plan: sub.data?.planTitle, at: Date.now() });
        window.location.assign(sub.setup.redirectUrl);
        return;
      }
      window.location.assign('/account/subscriptions');
    } catch (e) {
      setProblem(serverWords(e, 'The subscription could not be started. Please try again.'));
      setBusy(false);
    }
  };

  const price = plan ? plan.price : Number(fallbackPrice) || 0;
  const currency = plan?.currency || 'USD';
  return (
    <div className="border border-gray-200 bg-gray-50 p-5" data-testid="subscribe-box">
      <div className="flex items-baseline gap-2">
        {!loaded && <span className="inline-block h-8 w-40 animate-pulse rounded bg-gray-200" aria-label="Loading price" />}
        {loaded && <span className="text-2xl font-semibold text-gray-900">{money(price, currency)}</span>}
        {plan && <span className="text-gray-600">{perPeriod(plan.duration, plan.durationUnit)}</span>}
      </div>
      {plan && (
        <p className="mt-1 text-sm text-gray-600">
          {plan.trial > 0 ? `Free for ${plan.trial} days, then ${money(price, currency)} ${periodWords(plan.duration, plan.durationUnit)}.` : `Charged ${periodWords(plan.duration, plan.durationUnit)} to your card. Change or cancel any time in your account.`}
        </p>
      )}
      {plan?.features?.length ? (
        <ul className="mt-3 space-y-1 text-sm text-gray-700">
          {plan.features.map((f, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-emerald-600">✓</span>
              {[f.name, f.value].filter(Boolean).join(': ')}
            </li>
          ))}
        </ul>
      ) : null}
      {problem && (
        <p role="alert" className="mt-3 bg-red-50 px-3 py-2 text-sm text-red-700">
          {problem}
        </p>
      )}
      <button
        type="button"
        data-testid="subscribe-button"
        onClick={subscribe}
        disabled={busy}
        className="mt-4 w-full bg-gray-900 py-4 font-medium tracking-wide text-white transition-colors hover:bg-black disabled:bg-gray-400"
      >
        {busy ? 'ONE MOMENT…' : 'SUBSCRIBE'}
      </button>
    </div>
  );
};
