import type { Setup } from "./types";

/** Stowbo — storage & parking marketplace. The Rentals module with Stowbo's own
 *  brand, home and legal pages: renders exactly like stowbo-web. */
export const stowbo: Setup = {
  id: "stowbo",
  brand: {
    name: "Stowbo",
    tagline: "Stow it. Go enjoy. Grab it later.",
    description:
      "Store your things or park your car at a trusted local spot nearby. Booked in seconds, dropped off with a code, grabbed whenever you're done.",
    logo: "/brands/stowbo/logo.png",
    logoHeight: 80,
    favicon: "/brands/stowbo/icon.svg",
    colors: {
      bg: "#f5f1e8", surface: "#fffdf8", text: "#181a12", muted: "#6f7362",
      primary: "#cf6a3c", primaryInk: "#ffffff", accent: "#2b5233", border: "#e8e1d0",
    },
    // Stowbo's exact palette — pinned so nothing is derived.
    extraTokens: {
      "--bg-2": "#eee7d8", "--text-2": "#3f4338", "--faint": "#a3a493",
      "--primary-strong": "#b5552c", "--primary-soft": "#f4e2d5",
      "--accent-strong": "#1e3c25", "--accent-soft": "#e5eede",
      "--highlight": "#e3a531", "--pop": "#a7dd39", "--pop-strong": "#93cb22",
      "--border-2": "#f0eadc", "--accent-bright": "#3a7245", "--accent-deep": "#1a331f", "--hosting-bg": "#eef3e9", "--switch-border": "#bcd3b0",
      "--shadow": "0 6px 20px rgba(30,28,15,.08)", "--shadow-lg": "0 22px 54px rgba(30,28,15,.15)", "--shadow-xl": "0 34px 84px rgba(20,20,8,.22)",
    },
    radius: "22px",
    fonts: {
      display: "'Space Grotesk',system-ui,sans-serif",
      body: "'Inter',system-ui,sans-serif",
      google: ["Space+Grotesk:wght@500;600;700", "Inter:wght@400;500;600;700"],
    },
    themeColor: "#2b5233",
  },
  modules: ["rentals"],
  moduleCopy: { rentals: { label: "Spaces", blurb: "Storage and parking at trusted local spots.", cta: "Browse spaces" } },
  homeModule: "rentals",
  lexicon: { item: "Space", items: "Spaces", booking: "Booking", bookings: "Bookings", provider: "Host" },
  roles: ["customer", "provider"],
  provider: { benefit: "stowbo-host", home: "/host" },
  nav: {
    public: [
      { label: "Browse", href: "/browse", module: "rentals" },
      { label: "How it works", href: "/how-it-works", module: "rentals" },
      { label: "Become a host", href: "/host", module: "rentals" },
      { label: "Help", href: "/help", module: "rentals" },
    ],
    customer: [
      { label: "Overview", href: "/account" },
      { label: "Bookings", href: "/account/bookings", module: "rentals" },
      { label: "Your stuff", href: "/account/stuff", module: "rentals" },
      { label: "Wallet", href: "/account/wallet" },
      { label: "Messages", href: "/account/messages" },
      { label: "Documents", href: "/account/documents" },
      { label: "Settings", href: "/account/settings" },
      { label: "Support", href: "/account/support" },
    ],
    provider: [
      { label: "Dashboard", href: "/host" },
      { label: "Listings", href: "/host/listings" },
      { label: "Custody", href: "/host/custody" },
      { label: "Hand-offs", href: "/host/handovers" },
      { label: "Payments", href: "/host/payments" },
      { label: "Coupons", href: "/host/coupons" },
      { label: "Earnings", href: "/host/earnings" },
      { label: "Messages", href: "/host/messages" },
    ],
  },
  headerCta: { label: "List your space", href: "/host" },
  roleSwitch: { toProvider: "Switch to hosting ↗", toCustomer: "Switch to booking ↗", badge: "Hosting" },
  menu: {
    customer: [
      { label: "Account", href: "/account" },
      { label: "Your stuff", href: "/account/stuff" },
      { label: "Wallet", href: "/account/wallet" },
      { label: "Messages", href: "/account/messages" },
    ],
    provider: [
      { label: "Host dashboard", href: "/host" },
      { label: "Listings", href: "/host/listings" },
      { label: "Earnings", href: "/host/earnings" },
      { label: "Messages", href: "/host/messages" },
    ],
    providerAfter: [{ label: "Browse spaces", href: "/browse" }],
  },
  home: { variant: "stowbo", sections: [] },
  footer: {
    blurb: "A network of trusted local spots where people stash their things or park their car — booked in seconds, grabbed whenever. Stow it. Go enjoy. Grab it later.",
    columns: [
      { title: "Explore", items: [
        { label: "Browse spaces", href: "/browse" },
        { label: "Car parking", href: "/browse?c=parking" },
        { label: "Box storage", href: "/browse?c=box" },
        { label: "How it works", href: "/how-it-works" },
      ] },
      { title: "Hosting", items: [
        { label: "List your space", href: "/host" },
        { label: "Become a host", href: "/host" },
        { label: "Host guarantee", href: "/protection" },
        { label: "Host resources", href: "/help" },
      ] },
      { title: "Company", items: [
        { label: "Trust & safety", href: "/trust" },
        { label: "Help center", href: "/help" },
      ] },
      { title: "Legal", items: [
        { label: "Terms", href: "/terms" },
        { label: "Privacy", href: "/privacy" },
        { label: "Cookies", href: "/cookies" },
        { label: "Prohibited items", href: "/prohibited" },
        { label: "Cancellations", href: "/cancellation" },
      ] },
    ],
    bottomNote: "Booked, verified & protected up to $5,000.",
    appStoreUrl: "https://apps.apple.com/us/app/stowbo/id6805764877",
    appCta: { title: "Get the Stowbo app", body: "Find a spot, drop off with a code, and track everything from your phone." },
  },
  legal: {
    entityName: "Stowbo, Inc.", shortName: "Stowbo", jurisdiction: "the State of Delaware", address: "United States",
    email: "support@stowbo.com", effectiveDate: "August 2026", variant: "stowbo",
  },
  support: { email: "support@stowbo.com" },
  auth: {
    loginLead: "Sign in to manage your bookings or your listings.",
    signupLead: "Find storage or parking near you in minutes.",
    roleNote: "One account works for both renting and hosting.",
    providerCta: { prompt: "Want to host?", label: "List your space", href: "/host" },
  },
  seo: {
    keywords: [
      "self storage near me", "car parking near me", "storage marketplace", "peer to peer storage",
      "rent a parking spot", "monthly parking", "luggage storage", "bike storage", "spare room storage",
    ],
  },
};
