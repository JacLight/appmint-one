import type { ModuleId, Setup, LexiconKey, NavLink } from "./types";

/** Static facts about each module: where it lives and what it will do. Built modules
 *  own real routes (rentals, logistics); the rest render the clean "coming soon" page at
 *  `path` (public) and `accountPath` (signed-in), so no link is ever dead. */
export interface ModuleDef {
  id: ModuleId;
  label: string;
  path: string;          // public entry
  accountPath: string;   // customer's own area
  built: boolean;
  /** Icon: a single SVG path (24x24, stroke). */
  icon: string;
  customer: string[];
  provider?: string[];
  engine: string;        // engine area the module will sit on
}

export const MODULES: Record<ModuleId, ModuleDef> = {
  scheduling: {
    id: "scheduling", label: "Scheduling", path: "/book", accountPath: "/account/scheduling", built: true,
    icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    customer: ["Book appointments, classes and sessions", "Memberships and class packs", "Reschedule or cancel in a tap", "Intake forms, stages, notes and follow-ups on every case", "Invoices and messages in one thread"],
    provider: ["Today's schedule", "Check-in", "Notes and follow-ups"],
    engine: "client/scheduling (reservations)",
  },
  logistics: {
    id: "logistics", label: "Logistics", path: "/send", accountPath: "/account/logistics", built: true,
    icon: "M3 7h11v10H3zM14 10h4l3 3v4h-7M7.5 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
    customer: ["Order food from local kitchens", "Delivery fee shown is the fee charged", "Track the courier", "Rate and report an issue", "Ride and send in the app"],
    provider: ["Driving is in the app; the web has the Drive page"],
    engine: "client/logistics",
  },
  rentals: {
    id: "rentals", label: "Rentals", path: "/browse", accountPath: "/account/bookings", built: true,
    icon: "M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 21v-7h6v7",
    customer: ["Browse and map", "Availability calendar", "Deposit and pay", "Pickup, extend, return"],
    provider: ["Listings, pricing and availability", "Booking requests", "Handover and custody", "Coupons and earnings"],
    engine: "client/stowbo",
  },
  store: {
    id: "store", label: "Store", path: "/shop", accountPath: "/account/orders", built: true,
    icon: "M6 2l-3 4v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
    customer: ["Browse the catalog", "Product options", "Cart and checkout", "Order history and returns", "Gift cards"],
    engine: "storefront, client/giftcards",
  },
  events: {
    id: "events", label: "Events", path: "/events", accountPath: "/account/events", built: true,
    icon: "M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4zM13 6v12",
    customer: ["Browse events", "Buy tickets by type", "My tickets with QR", "Transfer a ticket"],
    engine: "client/events",
  },
  money: {
    id: "money", label: "Money", path: "/banking", accountPath: "/account/banking", built: true,
    icon: "M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18",
    customer: ["Accounts and balances", "Transactions and statements", "Send money — to another bank, someone here, or between your accounts", "Receive with your account details", "Request money", "Cards"],
    engine: "client/finance (banking APIs pending)",
  },
  lms: {
    id: "lms", label: "Learning", path: "/learn", accountPath: "/account/learning", built: true,
    icon: "M2 7l10-4 10 4-10 4zM6 9v5c0 1.7 2.7 3 6 3s6-1.3 6-3V9M22 7v6",
    customer: ["Course catalog", "Enroll", "Lessons and quizzes", "Progress", "Certificates"],
    engine: "client/content-studio",
  },
  property: {
    id: "property", label: "Homes", path: "/homes", accountPath: "/account/home", built: true,
    icon: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01",
    customer: ["Browse buildings, apartments, rooms and houses", "Apply online with documents", "Pay rent", "Repair requests with a response promise", "Building notices"],
    engine: "client/stowbo (homes), client/forms (applications), client-data/tickets, client/community (notices)",
  },
};

export const MODULE_IDS = Object.keys(MODULES) as ModuleId[];

export function isOn(setup: Setup, id: ModuleId): boolean {
  return setup.modules.includes(id);
}

export function moduleLabel(setup: Setup, id: ModuleId): string {
  return setup.moduleCopy?.[id]?.label || MODULES[id].label;
}

/** Module whose public path or account path is this slug (for the coming-soon routes). */
export function moduleByPath(path: string): ModuleDef | undefined {
  return Object.values(MODULES).find((m) => m.path === path || m.accountPath === path);
}

/** Neutral words — identical to the mobile portal's Lexicon fallbacks. */
export const LEXICON_FALLBACKS: Record<LexiconKey, string> = {
  booking: "Booking", bookings: "Bookings", customer: "Customer", provider: "Provider",
  item: "Item", items: "Items", job: "Job", jobs: "Jobs", plan: "Plan", course: "Course", account: "Account",
};

/** The word this setup uses: term(setup, "booking") → "Matter". Title case as written. */
export function term(setup: Setup, key: LexiconKey): string {
  return setup.lexicon[key] || LEXICON_FALLBACKS[key];
}
/** Same word lowercased for mid-sentence use ("your 3 matters"). */
export function lower(setup: Setup, key: LexiconKey): string {
  return term(setup, key).toLowerCase();
}

export function hasProviderSide(setup: Setup): boolean {
  return setup.roles.includes("provider");
}

/** Drop links to modules that are off. */
export function visibleNav(setup: Setup, links: NavLink[] | undefined): NavLink[] {
  return (links || []).filter((l) => !l.module || isOn(setup, l.module));
}
