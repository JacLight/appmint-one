/**
 * A Setup is one business running on the portal: its brand, which modules are on,
 * the words its trade uses, the nav per role, its home page and its legal entity.
 * Plain data only — safe to import from server AND client code. The ACTIVE setup is
 * picked at runtime on the server (see src/lib/setup.ts, env PORTAL_SETUP).
 */

import type { RentalsConfig } from "./rentals-config";
import type { SchedulingConfig } from "./scheduling-config";
import type { StoreConfig } from "./store-config";
import type { PropertyConfig } from "./property-config";

export type ModuleId = "scheduling" | "logistics" | "rentals" | "store" | "events" | "money" | "lms" | "property";

/** customer: every setup. provider: host / driver / coach / door staff. No staff role —
 *  back office stays in Studio. A setup offering only "customer" shows no role switch. */
export type Role = "customer" | "provider";

/** Core colour tokens. Everything else (soft/strong variants, borders 2, shadows) is
 *  derived in globals.css with color-mix unless the setup pins it in `theme.extra`. */
export interface BrandColors {
  bg: string;          // page background
  surface: string;     // cards / panels
  text: string;        // primary text (also the dark ink used for footer + dark buttons)
  muted: string;       // secondary text
  primary: string;     // main action colour
  primaryInk: string;  // text on primary
  accent: string;      // secondary brand colour (avatars, success, highlights)
  accentInk?: string;  // text on accent (default #fff)
  border: string;      // hairlines
}

export interface Brand {
  name: string;
  tagline: string;
  description: string;
  /** Path under /public or an absolute URL. Omit for a typographic wordmark. */
  logo?: string;
  /** Logo height in the header (px). */
  logoHeight?: number;
  /** Path under /public or an absolute URL (svg/png/ico). */
  favicon?: string;
  colors: BrandColors;
  /** Pin extra/derived tokens exactly (e.g. "--primary-strong": "#b5552c"). */
  extraTokens?: Record<`--${string}`, string>;
  radius: string;
  fonts: {
    display: string;   // CSS font-family stack
    body: string;
    /** Google Fonts css2 `family=` params, e.g. "Space+Grotesk:wght@500;600;700". */
    google?: string[];
  };
  themeColor?: string;
}

/** Lexicon keys — shared with the mobile portal (appmint_portal/lib/config/setup.dart).
 *  Screens use these, never literal nouns. Unset keys fall back to the neutral word. */
export const LEXICON_KEYS = ["booking", "bookings", "customer", "provider", "item", "items", "job", "jobs", "plan", "course", "account"] as const;
export type LexiconKey = (typeof LEXICON_KEYS)[number];
export type Lexicon = Partial<Record<LexiconKey, string>>;

export interface NavLink {
  label: string;
  href: string;
  /** Only shown when this module is on. */
  module?: ModuleId;
}

export interface FooterColumn {
  title: string;
  items: NavLink[];
}

export interface Cta { label: string; href: string }

/** A small "product preview" card shown in the hero — makes the home look like the
 *  product, not a template. */
export interface PreviewCard {
  label: string;     // small eyebrow, e.g. "Delivery #MV-2041"
  title: string;     // e.g. "Out for delivery"
  detail?: string;   // e.g. "ETA 2:40 PM · Deep Ellum"
  badge?: string;    // e.g. "Live"
  progress?: number; // 0..1 — draws a progress bar
}

export type HomeSection =
  | { type: "hero"; eyebrow?: string; title: string; subtitle: string; primary: Cta; secondary?: Cta; preview?: PreviewCard[]; image?: string; points?: string[] }
  | { type: "modules"; eyebrow?: string; title: string; subtitle?: string }
  | { type: "steps"; eyebrow?: string; title: string; steps: { title: string; body: string }[] }
  | { type: "highlights"; eyebrow?: string; title: string; subtitle?: string; items: { title: string; body: string }[] }
  | { type: "stats"; items: { value: string; label: string }[] }
  | { type: "quote"; quote: string; by: string; role?: string }
  | { type: "faq"; title: string; items: { q: string; a: string }[] }
  | { type: "cta"; title: string; subtitle?: string; primary: Cta; secondary?: Cta };

/* ───────────── generic public pages (help, legal) — rendered with Stowbo's page markup ───────────── */

/** Inline rich text: **bold** and [label](/href). Everything else is plain text. */
export type Rich = string;
export interface SectionHead { eyebrow?: string; title: string; sub?: Rich }
export interface Action { label: string; href: string; kind?: "clay" | "lime" | "ink" | "ghost" | "ghost-light" }
export type LegalNode = { p: Rich } | { ul: Rich[] } | { h3: string } | { table: { head: string[]; rows: Rich[][] } };

/** Each block renders the exact markup of a Stowbo page section. `flush` drops the
 *  section's top padding (Stowbo's `style={{ paddingTop: 0 }}` on follow-on sections). */
export type PageBlock =
  | { type: "pagehead"; eyebrow?: string; title: string; sub?: Rich; updated?: string }
  | { type: "helphero"; title: string; sub: Rich; searchPlaceholder?: string }
  | { type: "topics"; items: { icon: string; title: string; body: Rich; href: string; linkLabel?: string }[] }
  | { type: "tgrid"; flush?: boolean; head?: SectionHead; items: { icon: string; title: string; body: Rich }[] }
  | { type: "band"; flush?: boolean; eyebrow?: string; title: string; leads?: Rich[]; steps?: { title: string; body: Rich }[]; link?: { label: string; href: string } }
  | { type: "hsteps"; flush?: boolean; head?: SectionHead; items: { icon: string; title: string; body: Rich }[] }
  | { type: "checklist"; flush?: boolean; head?: SectionHead; columns: { title: string; items: Rich[] }[] }
  | { type: "faq"; flush?: boolean; head?: SectionHead; bare?: boolean; groups: { id?: string; title?: string; items: { q: string; a: Rich }[] }[] }
  | { type: "cta"; flush?: boolean; eyebrow?: string; title: string; body?: Rich; actions: Action[] }
  | { type: "legal"; toc: { id: string; label: string }[]; callout?: { title: string; body: Rich }; sections: { id?: string; title: string; body: LegalNode[] }[]; contact?: Rich };

export interface SitePage {
  /** URL slug: "how-it-works" → /how-it-works. Must not clash with a module path. */
  slug: string;
  /** <title> */
  title: string;
  description?: string;
  /** Draft copy written for the setup — the page shows a "draft" strip until replaced. */
  draft?: boolean;
  blocks: PageBlock[];
}

export interface ModuleCopy {
  label?: string;   // nav/tile label, e.g. "Deliveries"
  blurb?: string;   // one line on the tile
  cta?: string;     // tile button
}

export interface Setup {
  id: string;
  brand: Brand;
  /** Which modules are on. */
  modules: ModuleId[];
  moduleCopy?: Partial<Record<ModuleId, ModuleCopy>>;
  /** The module the app opens into (home page focus). Must be in `modules`. */
  homeModule: ModuleId;
  lexicon: Lexicon;
  /** Roles this setup offers. Only ["customer"] → no role switch anywhere. */
  roles: Role[];
  /** How the engine marks someone as a provider. Today: a customer benefit (rentals
   *  hosts carry `stowbo-host`). Other modules will add their own signals. */
  provider?: {
    benefit?: string;
    home: string;
    /** The module that owns the provider area at `home` (logistics → the driver app at
     *  /provider). Omitted → the provider area is not built yet (coming-soon page). */
    module?: ModuleId;
  };
  nav: {
    public: NavLink[];
    customer: NavLink[];
    provider?: NavLink[];
  };
  /** Header call-to-action shown next to Sign in (e.g. "List your space"). */
  headerCta?: Cta;
  /** Words on the customer ⇄ provider switch (derived from the lexicon when omitted). */
  roleSwitch?: { toProvider: string; toCustomer: string; badge: string };
  /** Account dropdown (derived from the nav when omitted). `providerAfter` follows the
   *  "switch back" link in provider mode. */
  menu?: { customer: NavLink[]; provider: NavLink[]; providerAfter?: NavLink[] };
  home: {
    /** "sections" (default) renders `sections`; "stowbo" renders the Stowbo marketplace home. */
    variant?: "sections" | "stowbo" | "muvmnt" | "events" | "academy" | "bank" | "market" | "store" | "scheduling" | "property";
    sections: HomeSection[];
  };
  footer: {
    blurb: string;
    columns: FooterColumn[];
    bottomNote?: string;
    appStoreUrl?: string;
    appCta?: { title: string; body: string };
  };
  /** Blank fields mean the business has not supplied them yet: the legal pages say
   *  so instead of inventing an entity (same rule as the mobile portal). */
  legal: {
    entityName: string;      // "Stowbo, Inc." — "" = not supplied
    shortName?: string;      // "Stowbo"
    jurisdiction: string;    // governing law, e.g. "the State of Texas"
    address?: string;
    email: string;
    phone?: string;
    effectiveDate: string;   // "October 20, 2026"
    /** "stowbo" renders Stowbo's own legal pages; otherwise the templated ones. */
    variant?: "template" | "stowbo";
  };
  support: {
    email: string;           // "" = not supplied (hidden)
    phone?: string;
    hours?: string;
    /** Chat widget config (optional; env PORTAL_CHAT_CONFIG_ID / PORTAL_CHAT_APP_ID win). */
    chat?: { configId: string; appId: string };
  };
  /** Copy on the sign-in / sign-up cards (derived from brand + lexicon when omitted). */
  auth?: {
    loginLead?: string;
    signupLead?: string;
    roleNote?: string;
    providerCta?: { prompt: string; label: string; href: string };
  };
  seo?: { keywords?: string[] };
  /** Rentals module: what is rented and how it reads (listing types, units, fields,
   *  search, copy). Omitted → Stowbo's storage marketplace. See rentals-config.ts. */
  rentals?: RentalsConfig;
  /** Scheduling module: how this business books and the facts about its place. See scheduling-config.ts. */
  scheduling?: SchedulingConfig;
  /** Store module: retail shop, food ordering ("Eat") or both, and its catalog slice.
   *  See store-config.ts. Omitted → a retail shop of the products tagged with the setup id. */
  store?: StoreConfig;
  /** Property module: the homes, application form, repair promise and office. See property-config.ts. */
  property?: PropertyConfig;
}
