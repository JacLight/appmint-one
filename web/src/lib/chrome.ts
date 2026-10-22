import "server-only";
import type { Setup } from "@/setups/types";
import { hasProviderSide, isOn, term, visibleNav } from "@/setups/modules";
import type { NavItem } from "./nav";

/** Everything the client header needs from the setup — plain, serialisable data. */
export interface HeaderModel {
  brand: { name: string; logo?: string; logoHeight?: number };
  nav: NavItem[];
  providerNav: NavItem[];
  providerSide: boolean;
  providerHome: string;
  cta?: NavItem;
  roleSwitch: { toProvider: string; toCustomer: string; badge: string };
  menu: { customer: NavItem[]; provider: NavItem[]; providerAfter: NavItem[] };
  becomeProvider: string;  // "Become a host"
  cart: boolean;           // Rentals cart button
  storeCart?: "bag" | "food"; // Store module bag (shop) or food basket (food-only setups)
  wideListing: boolean;    // Rentals listing page is wider
}

const strip = (l: { label: string; href: string }): NavItem => ({ label: l.label, href: l.href });

export function headerModel(setup: Setup): HeaderModel {
  const providerSide = hasProviderSide(setup);
  const provider = term(setup, "provider");
  const providerHome = setup.provider?.home || "/provider";
  const providerNav = providerSide ? visibleNav(setup, setup.nav.provider).map(strip) : [];
  const customerNav = visibleNav(setup, setup.nav.customer).map(strip);
  const derivedCustomerMenu = [
    { label: "Account", href: "/account" },
    ...customerNav.filter((n) => n.href !== "/account" && !/\/(settings|support|notifications)$/.test(n.href)).slice(0, 4),
  ];
  return {
    brand: { name: setup.brand.name, logo: setup.brand.logo, logoHeight: setup.brand.logoHeight },
    nav: visibleNav(setup, setup.nav.public).map(strip),
    providerNav,
    providerSide,
    providerHome,
    cta: providerSide && setup.headerCta ? strip(setup.headerCta) : undefined,
    roleSwitch: setup.roleSwitch || {
      toProvider: `Switch to ${provider.toLowerCase()} mode ↗`,
      toCustomer: `Switch to ${term(setup, "customer").toLowerCase()} view ↗`,
      badge: provider,
    },
    menu: {
      customer: (setup.menu?.customer ? visibleNav(setup, setup.menu.customer).map(strip) : derivedCustomerMenu),
      provider: setup.menu?.provider ? visibleNav(setup, setup.menu.provider).map(strip) : providerNav.slice(0, 4),
      providerAfter: setup.menu?.providerAfter ? visibleNav(setup, setup.menu.providerAfter).map(strip) : [],
    },
    becomeProvider: `Become a ${provider.toLowerCase()}`,
    cart: isOn(setup, "rentals"),
    storeCart: isOn(setup, "store") ? (setup.store?.variant === "food" ? "food" : "bag") : undefined,
    wideListing: isOn(setup, "rentals"),
  };
}
