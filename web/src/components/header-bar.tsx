"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/lib/nav";
import type { HeaderModel } from "@/lib/chrome";
import { AccountMenu } from "./account-menu";
import { CartButton } from "@/modules/rentals/components/cart-button";
import { BagButton } from "@/modules/store/components/bag";

function Brand({ brand }: { brand: HeaderModel["brand"] }) {
  return brand.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={brand.logo} alt={brand.name} style={brand.logoHeight ? { height: brand.logoHeight } : undefined} />
  ) : (
    <span className="wordmark">{brand.name}<i aria-hidden /></span>
  );
}

/**
 * Config-driven top bar. Inside the provider area an approved provider is in
 * PROVIDER mode: the public links are replaced by a mode badge + "switch back".
 * Setups that only offer the customer role never show a switch.
 * On mobile the nav collapses into a working burger menu (never a dead button).
 */
export function HeaderBar({ model, signedIn, host, email }: { model: HeaderModel; signedIn: boolean; host: boolean; email: string }) {
  const path = usePathname() || "/";
  const providerMode = model.providerSide && host && (path === model.providerHome || path.startsWith(model.providerHome + "/"));
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const links = providerMode
    ? model.providerNav
    : model.nav.filter((n) => !(host && n.href === model.providerHome));

  const wide = model.wideListing && /^\/listing\//.test(path);
  const cta = model.cta;

  return (
    <header className={`hdr solid${providerMode ? " hosting" : ""}`} id="hdr">
      <div className={`wrap in${wide ? " wrap-pd" : ""}`}>
        <Link className="brand" href={providerMode ? model.providerHome : routes.home} onClick={close}>
          <Brand brand={model.brand} />
          {providerMode && <span className="mode-badge">{model.roleSwitch.badge}</span>}
        </Link>

        {!providerMode && (
          <nav className="nav">
            {links.map((n) => (
              <Link key={n.href + n.label} href={n.href}>{n.label}</Link>
            ))}
          </nav>
        )}

        <div className="sp" />
        <div className="acts">
          {signedIn ? (
            <>
              {model.providerSide && (providerMode ? (
                <Link className="lnk switch" href={routes.account}>{model.roleSwitch.toCustomer}</Link>
              ) : host ? (
                <Link className="lnk switch" href={model.providerHome}>{model.roleSwitch.toProvider}</Link>
              ) : cta ? (
                <Link className="lnk" href={cta.href}>{cta.label}</Link>
              ) : null)}
              {!providerMode && model.cart && <CartButton />}
              {!providerMode && model.storeCart && <BagButton kind={model.storeCart} />}
              <AccountMenu email={email} host={host} providerMode={providerMode} model={model} />
            </>
          ) : (
            <>
              {cta && <Link className="lnk" href={cta.href}>{cta.label}</Link>}
              {model.storeCart && <BagButton kind={model.storeCart} />}
              <Link className="btn ink sm" href={routes.login}>Sign in</Link>
            </>
          )}
        </div>

        <button className="burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && (
        <div className="hdr-mobile">
          <nav>
            {links.map((n) => (
              <Link key={n.href + n.label} href={n.href} onClick={close}>{n.label}</Link>
            ))}
            <div className="hdr-mobile-sep" />
            {signedIn ? (
              <>
                {model.providerSide && (providerMode ? (
                  <>
                    <Link href={routes.account} onClick={close}>{model.roleSwitch.toCustomer}</Link>
                    {model.menu.providerAfter.map((n) => <Link key={n.href} href={n.href} onClick={close}>{n.label}</Link>)}
                  </>
                ) : host ? (
                  <Link href={model.providerHome} onClick={close}>{model.roleSwitch.toProvider}</Link>
                ) : cta ? (
                  <Link href={cta.href} onClick={close}>{cta.label}</Link>
                ) : null)}
                {!model.providerSide && <Link href={routes.account} onClick={close}>Your account</Link>}
              </>
            ) : (
              <>
                {cta && <Link href={cta.href} onClick={close}>{cta.label}</Link>}
                <Link href={routes.login} onClick={close}>Sign in</Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
