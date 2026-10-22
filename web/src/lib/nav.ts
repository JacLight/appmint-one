/**
 * Single source of truth for every route in the app.
 * Components link ONLY through `routes` / the nav groups below — so a link can
 * never point at a route that doesn't exist (no more dead links / 404s).
 */
export const routes = {
  // public
  home: "/",
  browse: "/browse",
  listing: (id: string) => `/listing/${id}`,
  howItWorks: "/how-it-works",
  help: "/help",
  trust: "/trust",
  login: "/login",
  pickup: "/pickup",
  signup: "/signup",

  // legal
  terms: "/terms",
  privacy: "/privacy",
  cookies: "/cookies",
  prohibited: "/prohibited",
  protection: "/protection",
  cancellation: "/cancellation",

  // customer (auth) — common to every setup
  account: "/account",
  documents: "/account/documents",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",

  // rentals module (customer)
  bookings: "/account/bookings",
  stuff: "/account/stuff",
  wallet: "/account/wallet",
  messages: "/account/messages",
  thread: (id: string) => `/account/messages/${id}`,
  settings: "/account/settings",
  support: "/account/support",

  // rentals module — host (auth + approved)
  host: "/host",
  hostListings: "/host/listings",
  hostListingNew: "/host/listings/new",
  hostListing: (id: string) => `/host/listings/${id}`,
  hostCustody: "/host/custody",
  hostHandovers: "/host/handovers",
  hostPayments: "/host/payments",
  hostCoupons: "/host/coupons",
  hostEarnings: "/host/earnings",
  hostMessages: "/host/messages",
  hostThread: (id: string) => `/host/messages/${id}`,
} as const;

export type NavItem = { label: string; href: string };

// Nav arrays are no longer static: every setup defines its own per role
// (src/setups/*). Server code reads them through getNav() in lib/nav-server.ts.
