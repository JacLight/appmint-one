"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProductMedia, type MediaItem } from "./product-media";
import { ProductCard } from "./product-card";
import { Icon } from "./icons";
import { money } from "../lib/money";
import type { Product } from "../lib/types";

/** Appmint One: the product page's two faces, laid out over base-app ProductDetail's own
 *  state and handlers (it builds this view model; nothing here prices, stocks or carts).
 *    physical — full-bleed media beside a sticky buy box, details accordion, related.
 *    course   — a course/digital landing page: hero, sticky purchase card, what you'll
 *               learn, overview, FAQ. Sections show only when the product has the data. */

export interface PdpSection { id: string; title: string; html: string }
export interface PdpVM {
  name: string;
  sku?: string;
  slug: string;
  categories: string[];
  media: MediaItem[];
  description?: string;
  price: { settled: boolean; current: number; was: number; rule?: string; discount?: string | number; points?: number | null; plan: boolean; gift: boolean };
  stock: { out: boolean; low: boolean; count?: number };
  quantity: number;
  inc: () => void;
  dec: () => void;
  maxed: boolean;
  busy: boolean;
  add: () => Promise<void> | void;
  inCart: (sku?: string) => boolean;
  wish: { on: boolean; toggle: () => void };
  slots: { gift?: ReactNode; attributes?: ReactNode; custom?: ReactNode; preview?: ReactNode; bundle?: ReactNode; subscribe?: ReactNode; reviews?: ReactNode; badge?: string };
  sections: PdpSection[];
  facts: { label: string; value: string }[];
  delivery?: string;
  perks: string[];
  related: Product[];
}

const plain = (html?: string) => (html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const lede = (html?: string, max = 190) => {
  const t = plain(html);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "));
  return stop > 80 ? cut.slice(0, stop + 1) : cut.replace(/\s\S*$/, "") + "…";
};
/** Bullet items out of a section's HTML (its <li>s, else its lines). */
const bullets = (html: string) => {
  const li = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => plain(m[1])).filter(Boolean);
  return li.length ? li : plain(html.replace(/<br\s*\/?>|<\/p>/gi, "\n")).split(/\n+/).map((s) => s.trim()).filter(Boolean);
};

function Crumbs({ vm }: { vm: PdpVM }) {
  const cat = vm.categories[0];
  return (
    <nav className="sf-crumbs" aria-label="Breadcrumb">
      <Link href={`/${vm.slug}`}>Shop</Link>
      {cat && (<><span aria-hidden="true">/</span><Link href={`/${vm.slug}?category=${encodeURIComponent(cat)}`}>{cat}</Link></>)}
      <span aria-hidden="true">/</span><span className="here">{vm.name}</span>
    </nav>
  );
}

function Price({ vm, big }: { vm: PdpVM; big?: boolean }) {
  const p = vm.price;
  if (p.plan) return null;
  return (
    <div className={`sf-pdp-price${big ? " big" : ""}`}>
      {p.settled ? <span className="now">{money(p.current)}</span> : <span className="sf-skel" aria-label="Loading price" />}
      {p.settled && !p.gift && p.was > p.current && <s>{money(p.was)}</s>}
      {!p.gift && p.discount ? <span className="off">{p.discount}% off</span> : null}
      {p.rule && <span className="rule">{p.rule}</span>}
      {p.settled && !p.gift && p.points ? <span className="pts">or {p.points.toLocaleString("en-US")} points</span> : null}
    </div>
  );
}

function Stock({ vm }: { vm: PdpVM }) {
  const s = vm.stock;
  return (
    <p className={`sf-pdp-stock${s.out ? " out" : s.low ? " low" : ""}`}>
      <i aria-hidden="true" />
      {s.out ? "Out of stock" : s.low ? `Only ${s.count} left` : "In stock, ready to ship"}
    </p>
  );
}

function Qty({ vm }: { vm: PdpVM }) {
  return (
    <div className="sf-qty" role="group" aria-label="Quantity">
      <button type="button" onClick={vm.dec} disabled={vm.quantity <= 1} aria-label="Decrease quantity"><Icon name="minus" size={16} /></button>
      <span aria-live="polite">{vm.quantity}</span>
      <button type="button" onClick={vm.inc} disabled={vm.stock.out || vm.maxed} aria-label="Increase quantity"><Icon name="plus" size={16} /></button>
    </div>
  );
}

const ctaLabel = (vm: PdpVM, word = "Add to bag") =>
  vm.busy ? "Adding…" : vm.stock.out ? "Out of stock" : vm.price.settled && !vm.price.plan ? `${word} · ${money(vm.price.current * vm.quantity)}` : word;

function Heart({ on }: { on: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
      <path d="M12 20s-7.5-4.6-9.2-9.4C1.7 7.3 3.9 4 7.3 4c2 0 3.6 1.1 4.7 2.7C13.1 5.1 14.7 4 16.7 4c3.4 0 5.6 3.3 4.5 6.6C19.5 15.4 12 20 12 20z" />
    </svg>
  );
}

function Accordion({ items, open0 = true }: { items: PdpSection[]; open0?: boolean }) {
  const [open, setOpen] = useState<string | null>(open0 ? items[0]?.id ?? null : null);
  if (!items.length) return null;
  return (
    <div className="sf-acc">
      {items.map((s) => {
        const on = open === s.id;
        return (
          <div key={s.id} className={`sf-acc-item${on ? " on" : ""}`}>
            <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : s.id)}>
              <span>{s.title}</span><i aria-hidden="true" />
            </button>
            {on && <div className="sf-acc-body sf-prose" dangerouslySetInnerHTML={{ __html: s.html }} />}
          </div>
        );
      })}
    </div>
  );
}

/** Phones: once the main button scrolls away, a bar at the bottom keeps it in reach. */
function StickyBar({ vm, anchor, label }: { vm: PdpVM; anchor: React.RefObject<HTMLElement | null>; label?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = anchor.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [anchor]);
  if (vm.price.plan) return null;
  return (
    <div className={`sf-pdp-bar${show ? " on" : ""}`} aria-hidden={!show}>
      <div className="sf-pdp-bar-txt"><b>{vm.name}</b>{vm.price.settled && <span>{money(vm.price.current)}</span>}</div>
      <button type="button" className="sf-btn" onClick={() => vm.add()} disabled={vm.stock.out || vm.busy} tabIndex={show ? 0 : -1}>
        {vm.busy ? "Adding…" : vm.stock.out ? "Out of stock" : label || "Add to bag"}
      </button>
    </div>
  );
}

function Related({ vm, title }: { vm: PdpVM; title: string }) {
  if (!vm.related.length) return null;
  return (
    <section className="sf-pdp-related">
      <div className="sf-sec-hd"><h2>{title}</h2><Link className="sf-link" href={`/${vm.slug}`}>Shop all</Link></div>
      <div className="sf-pdp-related-row">
        {vm.related.slice(0, 4).map((p) => <ProductCard key={p.sk} p={p} />)}
      </div>
    </section>
  );
}

/* ───────────── physical products ───────────── */

export function PdpPhysical({ vm }: { vm: PdpVM }) {
  const cta = useRef<HTMLDivElement>(null);
  const lead = lede(vm.description);
  const shippingPerk = vm.delivery ? vm.perks.filter((p) => !/shipping|delivery/i.test(p)) : vm.perks;
  return (
    <div className="sf-pdp">
      <section className="sf-pdp-top">
        <div className="sf-pdp-media"><ProductMedia items={vm.media} name={vm.name} /></div>
        <aside className="sf-pdp-buy">
          <div className="sf-pdp-buy-in">
            <Crumbs vm={vm} />
            {vm.slots.badge && <span className="sf-pdp-badge">{vm.slots.badge}</span>}
            <h1 className="sf-pdp-title">{vm.name}</h1>
            <Price vm={vm} big />
            {lead && <p className="sf-pdp-lede">{lead}</p>}
            {vm.slots.gift}
            {vm.slots.attributes}
            {vm.slots.custom}
            {vm.slots.preview}
            {vm.slots.bundle}
            {vm.slots.subscribe}
            {!vm.price.plan && (
              <>
                <Stock vm={vm} />
                <div className="sf-pdp-cta" ref={cta}>
                  <Qty vm={vm} />
                  <button type="button" className="sf-btn lg grow" onClick={() => vm.add()} disabled={vm.stock.out || vm.busy}>{ctaLabel(vm)}</button>
                  <button type="button" className={`sf-pdp-wish${vm.wish.on ? " on" : ""}`} onClick={vm.wish.toggle}
                    aria-pressed={vm.wish.on} aria-label={vm.wish.on ? "Remove from wishlist" : "Save to wishlist"}><Heart on={vm.wish.on} /></button>
                </div>
              </>
            )}
            {(vm.delivery || shippingPerk.length > 0) && (
              <ul className="sf-pdp-promise">
                {vm.delivery && <li><Icon name="truck" size={20} /><span>{vm.delivery}</span></li>}
                {shippingPerk.map((p) => <li key={p}><Icon name={/return/i.test(p) ? "ret" : /ship|dallas|day/i.test(p) ? "store" : "check"} size={20} /><span>{p}</span></li>)}
              </ul>
            )}
            {vm.facts.length > 0 && (
              <dl className="sf-pdp-facts">
                {vm.facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
              </dl>
            )}
          </div>
        </aside>
      </section>

      {(vm.description || vm.sections.length > 0) && (
        <section className="sf-pdp-details">
          <div className="sf-pdp-overview">
            <h2>Overview</h2>
            {vm.description ? <div className="sf-prose lg" dangerouslySetInnerHTML={{ __html: vm.description }} /> : null}
            {vm.sku && <p className="sf-pdp-sku">SKU {vm.sku}</p>}
          </div>
          <Accordion items={vm.sections} />
        </section>
      )}

      {vm.slots.reviews && <section className="sf-pdp-reviews" id="reviews">{vm.slots.reviews}</section>}

      <Related vm={vm} title="You may also like" />
      <StickyBar vm={vm} anchor={cta} />
    </div>
  );
}

/* ───────────── courses and digital products ───────────── */

export function PdpCourse({ vm, course }: { vm: PdpVM; course: boolean }) {
  const router = useRouter();
  const cta = useRef<HTMLDivElement>(null);
  const [going, setGoing] = useState(false);
  const learn = vm.sections.find((s) => /learn|outcome/i.test(s.title));
  const faq = vm.sections.find((s) => /faq|question/i.test(s.title));
  const includes = vm.sections.find((s) => /include/i.test(s.title));
  const rest = vm.sections.filter((s) => s !== learn && s !== faq && s !== includes && !/^(shipping|returns)$/i.test(s.id));
  const returns = vm.sections.find((s) => s.id === "returns");
  const faqItems = faq ? [...faq.html.matchAll(/<h[3-6][^>]*>([\s\S]*?)<\/h[3-6]>([\s\S]*?)(?=<h[3-6]|$)/gi)].map((m, i) => ({ id: `faq-${i}`, title: plain(m[1]), html: m[2] })) : [];

  const buyNow = async () => {
    setGoing(true);
    await vm.add();
    if (vm.inCart(vm.sku)) router.push(`/${vm.slug}/checkout`);
    else setGoing(false);
  };

  return (
    <div className="sf-pdp course">
      <header className="sf-course-hero">
        <div className="sf-course-hero-in">
          <Crumbs vm={vm} />
          <span className="sf-course-kind">{course ? "Course" : "Digital product"}</span>
          <h1>{vm.name}</h1>
          {vm.description && <p className="sf-course-lede">{lede(vm.description, 240)}</p>}
          {vm.slots.badge && <span className="sf-pdp-badge light">{vm.slots.badge}</span>}
        </div>
      </header>

      <div className="sf-course-body">
        <aside className="sf-course-card">
          <div className="sf-course-card-in">
            {vm.media.length > 0 && <div className="sf-course-media"><ProductMedia items={vm.media} name={vm.name} rail={false} /></div>}
            <div className="sf-course-card-pad">
              <Price vm={vm} big />
              {vm.slots.gift}
              {vm.slots.attributes}
              {vm.slots.custom}
              {vm.slots.subscribe}
              {!vm.price.plan && (
                <div className="sf-course-cta" ref={cta}>
                  <button type="button" className="sf-btn lg block" onClick={buyNow} disabled={vm.stock.out || vm.busy || going}>{going ? "Opening checkout…" : vm.stock.out ? "Unavailable" : "Buy now"}</button>
                  <button type="button" className="sf-btn lg block ghost" onClick={() => vm.add()} disabled={vm.stock.out || vm.busy}>{vm.busy ? "Adding…" : "Add to bag"}</button>
                </div>
              )}
              {includes && (
                <div className="sf-course-incl">
                  <b>{includes.title}</b>
                  <ul>{bullets(includes.html).map((t) => <li key={t}><Icon name="check" size={16} />{t}</li>)}</ul>
                </div>
              )}
              {returns && returns.html && <p className="sf-fine">{plain(returns.html)}</p>}
            </div>
          </div>
        </aside>

        <main className="sf-course-main">
          {learn && (
            <section className="sf-course-learn">
              <h2>{/learn/i.test(learn.title) ? "What you'll learn" : learn.title}</h2>
              <ul>{bullets(learn.html).map((t) => <li key={t}><Icon name="check" size={18} /><span>{t}</span></li>)}</ul>
            </section>
          )}
          {vm.description && (
            <section className="sf-course-sec">
              <h2>{course ? "About this course" : "About this product"}</h2>
              <div className="sf-prose lg" dangerouslySetInnerHTML={{ __html: vm.description }} />
            </section>
          )}
          {rest.length > 0 && (
            <section className="sf-course-sec">
              <h2>Details</h2>
              <Accordion items={rest} />
            </section>
          )}
          {faq && (
            <section className="sf-course-sec">
              <h2>Frequently asked questions</h2>
              {faqItems.length ? <Accordion items={faqItems} open0={false} /> : <div className="sf-prose" dangerouslySetInnerHTML={{ __html: faq.html }} />}
            </section>
          )}
          {vm.slots.reviews && <section className="sf-course-sec" id="reviews"><h2>Reviews</h2>{vm.slots.reviews}</section>}
        </main>
      </div>

      <Related vm={vm} title={course ? "More courses" : "You may also like"} />
      <StickyBar vm={vm} anchor={cta} label="Add to bag" />
    </div>
  );
}
