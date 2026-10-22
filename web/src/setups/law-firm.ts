import type { Setup } from "./types";
import { accountModuleLink, customerNav, footerColumns, moduleLink } from "./shared";

const U = (id: string, w = 1600) => `https://images.unsplash.com/${id}?w=${w}&q=75&auto=format&fit=crop`;

/** Hale & Mercer — a downtown Dallas firm for business, real estate, estate planning
 *  and employment. Scheduling: book a consultation with intake; a matter IS the
 *  reservation (status, intake, moves, invoices, messages, documents). Practice areas,
 *  attorneys, fees and times come from the engine's reservation definitions. */
export const lawFirm: Setup = {
  id: "law-firm",
  brand: {
    name: "Hale & Mercer",
    tagline: "Attorneys for business, property and family.",
    description: "A Dallas law firm for business contracts, real estate, wills and trusts, and employment. Book a consultation online and follow your matter from intake to close.",
    colors: {
      bg: "#f6f4ef", surface: "#ffffff", text: "#111b2e", muted: "#5b6273",
      primary: "#14284b", primaryInk: "#ffffff", accent: "#b08d57", accentInk: "#ffffff", border: "#e2ddd2",
    },
    extraTokens: { "--primary-strong": "#0c1a33", "--primary-soft": "#e8ecf3", "--highlight": "#b08d57", "--bg-2": "#efebe3" },
    radius: "4px",
    fonts: {
      display: "'Libre Caslon Text',Georgia,serif",
      body: "'Inter',system-ui,sans-serif",
      google: ["Libre+Caslon+Text:ital,wght@0,400;0,700;1,400", "Inter:wght@400;500;600;700"],
    },
    themeColor: "#14284b",
  },
  modules: ["scheduling"],
  homeModule: "scheduling",
  moduleCopy: { scheduling: { label: "Consultations", blurb: "Book a consultation and follow your matter from intake to close.", cta: "Book a consultation" } },
  lexicon: { booking: "Matter", bookings: "Matters", customer: "Client", provider: "Attorney" },
  roles: ["customer", "provider"],
  provider: { home: "/provider", module: "scheduling" },
  headerCta: { label: "Book a consultation", href: "/book" },
  nav: {
    public: [moduleLink("scheduling", "Practice areas"), { label: "Attorneys", href: "/team", module: "scheduling" }, { label: "Help", href: "/help" }],
    customer: customerNav([accountModuleLink("scheduling", "My matters")]),
    provider: [
      { label: "Today", href: "/provider" },
      { label: "Calendar", href: "/provider/schedule" },
      { label: "Messages", href: "/account/messages" },
    ],
  },
  roleSwitch: { toProvider: "Attorney view", toCustomer: "Client view", badge: "Attorney" },
  home: {
    variant: "scheduling",
    sections: [
      { type: "hero", title: "Attorneys for business, property and family.", subtitle: "Book a consultation.", primary: { label: "Book a consultation", href: "/book" } },
    ],
  },
  scheduling: {
    style: "firm",
    prefix: "law-",
    include: ["discovery-call"],
    timezone: "America/Chicago",
    hero: {
      kicker: "Hale & Mercer · Attorneys at law · Dallas",
      title: "Straight answers on contracts, property",
      em: "and family.",
      sub: "Meet the attorney who will handle your matter, not an intake desk. Then see your consultations, what you told us and your invoices in one place.",
      image: U("photo-1775144657610-9a6f171e522f", 1800),
      imageAlt: "A law library with shelves of bound volumes",
      cta: "Book a consultation",
    },
    place: {
      name: "Hale & Mercer",
      street: "2100 Ross Ave, Suite 1450",
      city: "Dallas, TX 75201",
      phone: "(214) 555-0119",
      hours: [["Mon–Fri", "9:00 AM – 5:00 PM"], ["Evenings", "By appointment"]],
      note: "Visitor parking in the Ross Tower garage; we validate.",
      image: U("photo-1431540015161-0bf868a2d407", 1400),
    },
    lines: ["Meet the attorney who handles your matter", "Conflict check before we meet", "Fees agreed in writing"],
    policy: "The consultation fee is shown on each practice area and billed after we meet. If you hire us, it's credited to your first invoice. Ongoing work is billed against the engagement letter you sign.",
    words: { types: "Practice areas", team: "Attorneys", bookCta: "Book a consultation" },
  },
  footer: {
    blurb: "Business, real estate, estate planning and employment law in downtown Dallas.",
    columns: footerColumns(
      [moduleLink("scheduling", "Book a consultation"), { label: "Attorneys", href: "/team", module: "scheduling" }, { label: "Client documents", href: "/account/documents" }],
      [{ label: "Attorney sign in", href: "/provider" }],
    ),
    bottomNote: "Attorney advertising. Contacting us or booking a consultation does not create an attorney–client relationship.",
  },
  legal: { entityName: "", shortName: "Hale & Mercer", jurisdiction: "", email: "", effectiveDate: "" },
  support: { email: "", phone: "(214) 555-0119", hours: "Mon–Fri 9:00 AM – 5:00 PM" },
  seo: { keywords: ["dallas business attorney", "real estate lawyer dallas", "wills and trusts dallas", "employment lawyer dallas"] },
};
