'use client';

// from base-app/src/components/my-account/GiftCards.tsx — ported verbatim; only import paths rewired.
import React, { useEffect, useState } from 'react';
import { IconRenderer } from '@/modules/store/components/ui/icon-renderer';
import { StatCard } from './components/StatCard';
import { SlidePanel } from './components/SlidePanel';
import { useCartStore } from '@/modules/store/store/cart-store';
import { GIFT_CARD_OPTION_NAMES } from '@/modules/store/components/storefront/gift-card/GiftCardOptions';
import { giftCardService, type CustomerGiftCard, type GiftCardReloadProduct } from '@/modules/store/services/gift-card-service';

const money = (v: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(v) || 0);
const when = (v?: string) => (v ? new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const lastFour = (code?: string) => String(code || '').slice(-4);
const serverWords = (err: any, fallback: string) => {
  const e = err?.response?.data?.error ?? err?.response?.data?.message;
  return (typeof e === 'string' ? e : e?.message) || err?.message || fallback;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Ready to use', cls: 'bg-emerald-100 text-emerald-700' },
  inactive: { label: 'Not activated', cls: 'bg-gray-100 text-gray-600' },
  suspended: { label: 'On hold', cls: 'bg-amber-100 text-amber-700' },
  used: { label: 'Fully used', cls: 'bg-gray-100 text-gray-500' },
  expired: { label: 'Expired', cls: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-rose-100 text-rose-700' },
};

/** What each ledger row means to the holder. */
const MOVE: Record<string, string> = {
  redeem: 'Spent',
  refund: 'Refunded to card',
  reload: 'Topped up',
  adjust: 'Adjusted',
  transfer_out: 'Sent to another card',
  transfer_in: 'Received from another card',
};

type Panel = { kind: 'topup' | 'share'; card: CustomerGiftCard } | null;

/**
 * The customer's gift cards.
 *
 * Grouped by what they can do with each: cards that are theirs to spend (with
 * the code, top-up and "send some to someone"), their spent or expired ones,
 * and cards they bought for other people — listed so they can see the gift went
 * out, with only the last four of a code that belongs to the recipient. Which is
 * which is the server's call (`holder`), not worked out here.
 */
export function GiftCards() {
  const [cards, setCards] = useState<CustomerGiftCard[]>([]);
  const [usable, setUsable] = useState(0);
  const [reloadProduct, setReloadProduct] = useState<GiftCardReloadProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);

  const load = async () => {
    const dto = await giftCardService.getMyCards();
    setCards(dto.data);
    setUsable(dto.usableBalance);
    setReloadProduct(dto.reloadProduct || null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const mine = cards.filter(c => c.holder !== false && c.data.status === 'active');
  const past = cards.filter(c => c.holder !== false && c.data.status !== 'active');
  const given = cards.filter(c => c.holder === false);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked — the code is on screen */
    }
  };

  const Card = ({ card }: { card: CustomerGiftCard }) => {
    const d = card.data;
    const st = STATUS[d.status] || STATUS.inactive;
    const expanded = open === card.sk;
    const live = card.holder !== false && d.status === 'active';
    const dark = live;
    const moves = d.uses || [];
    const gift = card.holder === false;
    return (
      <div className={`rounded-2xl border ${dark ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-900'} p-5 transition`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`text-xs tracking-[0.18em] uppercase ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{d.name || 'Gift card'}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">{money(gift ? d.initialAmount : d.balance, d.currency)}</p>
            <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              {gift ? (
                <>
                  For {d.recipientName || d.recipientEmail || d.recipientPhone || 'someone'}
                  {d.deliveredAt ? ` · sent ${when(d.deliveredAt)}` : ' · not sent yet'}
                </>
              ) : (
                <>
                  of {money(d.initialAmount, d.currency)}
                  {d.expirationDate ? ` · valid until ${when(d.expirationDate)}` : ' · never expires'}
                </>
              )}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <code className={`rounded-lg px-3 py-2 font-mono text-sm tracking-widest ${dark ? 'bg-white/10' : 'bg-gray-100'}`}>{gift ? `•••• ${lastFour(d.code)}` : d.code}</code>
          {!gift && (
            <button type="button" onClick={() => copy(d.code)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${dark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'border border-gray-300 hover:border-gray-900'}`}>
              {copied === d.code ? 'Copied' : 'Copy code'}
            </button>
          )}
          {(moves.length > 0 || d.recipientMessage || d.purchaseOrderNumber) && (
            <button type="button" onClick={() => setOpen(expanded ? null : card.sk)} className={`ml-auto inline-flex items-center gap-1 text-xs ${dark ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
              {expanded ? 'Hide details' : 'Details'}
              <IconRenderer icon={expanded ? 'ChevronUp' : 'ChevronDown'} className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {live && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <a href={`/gift-card?code=${encodeURIComponent(d.code)}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20">
              <IconRenderer icon="CreditCard" className="h-3.5 w-3.5" />
              Open card
            </a>
            {reloadProduct && (
              <button type="button" onClick={() => setPanel({ kind: 'topup', card })} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20">
                <IconRenderer icon="Plus" className="h-3.5 w-3.5" />
                Top up
              </button>
            )}
            {d.balance > 0 && (
              <button type="button" onClick={() => setPanel({ kind: 'share', card })} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20">
                <IconRenderer icon="Send" className="h-3.5 w-3.5" />
                Send some to someone
              </button>
            )}
          </div>
        )}

        {expanded && (
          <div className={`mt-4 space-y-2 border-t pt-4 text-sm ${dark ? 'border-white/10 text-gray-300' : 'border-gray-100 text-gray-600'}`}>
            {d.recipientMessage && <p className="italic">“{d.recipientMessage}”</p>}
            {!gift && d.purchasedBy && d.recipientEmail && d.purchasedBy !== d.recipientEmail && <p>From {d.purchasedBy}</p>}
            {d.purchaseOrderNumber && <p>Order {d.purchaseOrderNumber}</p>}
            {!gift && moves.length > 0 && (
              <ul className="space-y-1">
                {moves.map(u => (
                  <li key={u.transactionId} className="flex justify-between gap-4">
                    <span>
                      {when(u.date)} · {MOVE[u.kind] || u.kind}
                      {u.orderNumber && u.kind === 'redeem' ? ` · order ${u.orderNumber}` : ''}
                    </span>
                    <span>{u.amount > 0 ? `−${money(u.amount, d.currency)}` : `+${money(-u.amount, d.currency)}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  };

  const Section = ({ title, list, note }: { title: string; list: CustomerGiftCard[]; note?: string }) =>
    list.length === 0 ? null : (
      <section>
        <h2 className="mb-1 text-xs font-semibold tracking-[0.18em] text-gray-500 uppercase">{title}</h2>
        {note && <p className="mb-3 text-xs text-gray-500">{note}</p>}
        <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${note ? '' : 'mt-2'}`}>
          {list.map(c => (
            <Card key={c.sk} card={c} />
          ))}
        </div>
      </section>
    );

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gift cards</h1>
        <p className="mt-1 text-sm text-gray-500">What is left on your cards, and the cards you have given. Enter a code at checkout, or pick the card there, to pay with it.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Ready to spend" value={money(usable)} icon="Wallet" color="green" />
        <StatCard title="Your cards" value={String(mine.length + past.length)} icon="Gift" />
        <StatCard title="Given as gifts" value={String(given.length)} icon="Send" />
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading your cards…</p>
      ) : cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <IconRenderer icon="Gift" className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 font-medium text-gray-700">No gift cards yet</p>
          <p className="mt-1 text-sm text-gray-500">A card bought with this email, or sent to it, will show up here automatically.</p>
        </div>
      ) : (
        <>
          <Section title="Ready to use" list={mine} />
          <Section title="Past cards" list={past} />
          <Section title="Given as gifts" list={given} note="Cards you bought for someone else. The code is theirs, so only its last four are shown." />
        </>
      )}

      <SlidePanel isOpen={!!panel} onClose={() => setPanel(null)} title={panel?.kind === 'topup' ? 'Top up your card' : 'Send some to someone'} width="520px">
        {panel?.kind === 'topup' && reloadProduct && <TopUpForm card={panel.card} product={reloadProduct} onDone={() => setPanel(null)} />}
        {panel?.kind === 'share' && (
          <ShareForm
            card={panel.card}
            onDone={async () => {
              setPanel(null);
              await load();
            }}
          />
        )}
      </SlidePanel>
    </div>
  );
}

/**
 * Buying more value onto a card you hold. It goes through the cart like any
 * purchase, as the store's gift-card product with the card named on the line;
 * the value lands on this card when the order is paid instead of a new card
 * being issued.
 */
function TopUpForm({ card, product, onDone }: { card: CustomerGiftCard; product: GiftCardReloadProduct; onDone: () => void }) {
  const d = card.data;
  const [picked, setPicked] = useState<number | null>(product.denominations[0] ?? null);
  const [custom, setCustom] = useState('');
  const addItem = useCartStore(s => s.addItem);
  const isCartOpen = useCartStore(s => s.isOpen);
  const toggleCart = useCartStore(s => s.toggleCart);

  const value = custom !== '' ? Math.round(Number(custom) * 100) / 100 : picked;
  const problem =
    !value || !(value > 0)
      ? 'Choose an amount'
      : product.minAmount && value < product.minAmount
        ? `The minimum is ${money(product.minAmount, d.currency)}`
        : product.maxAmount && value > product.maxAmount
          ? `The maximum is ${money(product.maxAmount, d.currency)}`
          : null;

  const add = () => {
    if (problem || !value) return;
    addItem({
      id: `reload-${d.serial}`,
      name: `${product.name} — top-up for card ending ${lastFour(d.code)}`,
      sku: product.sku,
      unitPrice: value,
      quantity: 1,
      image: product.image || '',
      options: [
        { name: GIFT_CARD_OPTION_NAMES.amount, value: String(value), type: 'text' },
        { name: GIFT_CARD_OPTION_NAMES.reloadSerial, value: d.serial, type: 'text' },
      ],
    } as any);
    onDone();
    if (!isCartOpen) toggleCart();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-xl bg-gray-900 p-5 text-white">
        <p className="text-xs tracking-[0.18em] text-gray-400 uppercase">Card ending {lastFour(d.code)}</p>
        <p className="mt-1 text-2xl font-semibold">{money(d.balance, d.currency)} now</p>
      </div>

      <div>
        <p className="mb-3 text-xs font-medium tracking-wide text-gray-500 uppercase">Add</p>
        {product.denominations.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {product.denominations.map(v => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setPicked(v);
                  setCustom('');
                }}
                className={`min-w-[84px] rounded-lg border px-4 py-2.5 text-sm font-medium ${custom === '' && picked === v ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 hover:border-gray-900'}`}
              >
                {money(v, d.currency)}
              </button>
            ))}
          </div>
        )}
        {(product.allowCustomAmount || product.denominations.length === 0) && (
          <div className="mt-3">
            <label className="mb-1 block text-xs text-gray-500">{product.denominations.length ? 'Or another amount' : 'Amount'}</label>
            <input
              type="number"
              inputMode="decimal"
              min={product.minAmount || 1}
              max={product.maxAmount || undefined}
              value={custom}
              onChange={e => setCustom(e.target.value)}
              placeholder="0.00"
              className="w-44 rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900"
            />
          </div>
        )}
      </div>

      {problem && custom !== '' && <p className="text-sm text-red-600">{problem}</p>}

      <button type="button" onClick={add} disabled={!!problem} className="w-full rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
        {value && !problem ? `Add ${money(value, d.currency)} to cart` : 'Add to cart'}
      </button>
      <p className="text-xs text-gray-500">You pay for it at checkout like anything else. The value goes onto this card as soon as the order is paid — the code stays the same.</p>
    </div>
  );
}

/**
 * Giving part of a card away. The server takes the amount off this card, puts
 * it on a new card for the other person and sends it to them; nothing here
 * decides whether that is allowed.
 */
function ShareForm({ card, onDone }: { card: CustomerGiftCard; onDone: () => void }) {
  const d = card.data;
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [sent, setSent] = useState<{ amount: number; sentTo: string; remainingBalance: number } | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem('');
    try {
      const r = await giftCardService.shareCard(d.serial, {
        amount: Number(amount),
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        message: message.trim() || undefined,
      });
      setSent(r);
    } catch (err) {
      setProblem(serverWords(err, 'That could not be sent'));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4 p-6">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <IconRenderer icon="Check" className="h-6 w-6" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900">Sent {money(sent.amount, d.currency)}</h3>
        <p className="text-sm text-gray-600">
          A new card is on its way to <span className="font-medium text-gray-900">{sent.sentTo}</span>. Your card ending {lastFour(d.code)} now holds {money(sent.remainingBalance, d.currency)}.
        </p>
        <button type="button" onClick={onDone} className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="space-y-5 p-6">
      <div className="rounded-xl bg-gray-900 p-5 text-white">
        <p className="text-xs tracking-[0.18em] text-gray-400 uppercase">Card ending {lastFour(d.code)}</p>
        <p className="mt-1 text-2xl font-semibold">{money(d.balance, d.currency)} available</p>
      </div>

      <div>
        <label htmlFor="gc-share-amount" className="mb-1 block text-sm font-medium text-gray-700">
          How much
        </label>
        <input
          id="gc-share-amount"
          type="number"
          inputMode="decimal"
          min={1}
          max={d.balance}
          step="0.01"
          required
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-44 rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900"
        />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Who to</p>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Their name" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Their email" className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900" />
          <input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Or their mobile" className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900" />
        </div>
        <textarea value={message} onChange={e => setMessage(e.target.value.slice(0, 400))} rows={3} placeholder="Add a message (optional)" className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900" />
      </div>

      {problem && (
        <p role="alert" className="text-sm text-red-600">
          {problem}
        </p>
      )}

      <button type="submit" disabled={busy || !amount || (!email.trim() && !phone.trim())} className="w-full rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
        {busy ? 'Sending…' : amount ? `Send ${money(Number(amount) || 0, d.currency)}` : 'Send'}
      </button>
      <p className="text-xs text-gray-500">They get a card of their own with its own code. The amount comes off this card straight away.</p>
    </form>
  );
}

export default GiftCards;
