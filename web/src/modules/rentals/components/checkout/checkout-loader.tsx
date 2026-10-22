"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { routes } from "@/lib/nav";
import { loadCheckoutAction } from "@/modules/rentals/actions/checkout";
import { CheckoutClient, type CheckoutData } from "./checkout-client";

type Load = { status: "loading" } | { status: "empty" } | { status: "unavailable" } | { status: "error" } | { status: "ready"; data: CheckoutData };

/** Loads the checkout from the SERVER cart (source of truth) so it survives
 *  back/forward, reload and device switches — the reservation never lives only
 *  in the tab. Titles + amounts come straight from the server quote. */
export function CheckoutLoader() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  // Bumping this re-runs the load — used after the cart is re-priced (a promo code
  // applied or removed), since the server won't re-price held lines: the action
  // releases the hold and saves the cart, then this takes a fresh hold at the new price.
  const [gen, setGen] = useState(0);
  const reload = useCallback(() => { setLoad({ status: "loading" }); setGen((g) => g + 1); }, []);

  useEffect(() => {
    let live = true;
    loadCheckoutAction().then((res) => {
      if (!live) return;
      if (res.ok) {
        const d = res.data;
        setLoad({
          status: "ready",
          data: {
            checkoutId: d.checkoutId,
            quote: d.quote ?? null,
            holdExpiresAt: d.holdExpiresAt ?? null,
            currency: d.currency,
            dueNow: d.dueNow, dueUpfront: d.dueUpfront, dueDeposit: d.dueDeposit,
            returnTo: d.returnTo,
            lines: d.lines.map((l) => ({ title: l.title, startDate: l.startDate, endDate: l.endDate, quantity: l.quantity, amount: l.amount })),
          },
        });
      } else {
        setLoad({ status: res.reason === "empty" ? "empty" : res.reason });
      }
    });
    return () => { live = false; };
  }, [gen]);

  if (load.status === "loading") {
    return <section className="sec cosec"><div className="wrap"><p className="muted">Loading your checkout…</p></div></section>;
  }
  if (load.status === "ready") return <CheckoutClient data={load.data} onReload={reload} />;

  const copy = load.status === "unavailable"
    ? { h: "That space just got taken", p: "The spot you were holding is no longer free for those dates. Pick another and try again." }
    : load.status === "error"
      ? { h: "Something went wrong", p: "We couldn’t load your checkout. Head back and try again." }
      : { h: "Your cart is empty", p: "Add a space to your cart and it’ll show up here to check out." };
  return (
    <section className="sec cosec"><div className="wrap co-empty">
      <h1>{copy.h}</h1>
      <p className="muted">{copy.p}</p>
      <Link className="btn clay lg" href={routes.browse}>Browse spaces</Link>
    </div></section>
  );
}
