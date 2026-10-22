import type { Setup } from "./types";
import { accountModuleLink, customerNav, footerColumns, moduleLink } from "./shared";

const U = (id: string, w = 1600) => `https://images.unsplash.com/${id}?w=${w}&q=75&auto=format&fit=crop`;

/** Lumen Pilates — a reformer studio in Bishop Arts, Dallas. Scheduling (classes,
 *  private sessions, class packs and memberships) + on-demand courses (LMS). The home is
 *  the timetable (src/modules/scheduling/components/home/studio-home.tsx); classes,
 *  coaches, times and prices all come from the engine. */
export const studio: Setup = {
  id: "studio",
  brand: {
    name: "Lumen Pilates",
    tagline: "Reformer Pilates in Bishop Arts.",
    description: "Small reformer, tower and mat classes in Bishop Arts, Dallas. Book a class, buy a pack or membership, and keep your bookings in one place.",
    colors: {
      bg: "#f4eee7", surface: "#fffcf8", text: "#1f1a19", muted: "#776b66",
      primary: "#1f1a19", primaryInk: "#fffcf8", accent: "#c4664f", accentInk: "#ffffff", border: "#e6dcd3",
    },
    extraTokens: { "--primary-strong": "#000000", "--primary-soft": "#efe4da", "--highlight": "#c4664f", "--bg-2": "#ece3d9" },
    radius: "6px",
    fonts: {
      display: "'Instrument Serif',Georgia,serif",
      body: "'DM Sans',system-ui,sans-serif",
      google: ["Instrument+Serif:ital@0;1", "DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700"],
    },
    themeColor: "#1f1a19",
  },
  modules: ["scheduling", "store", "lms"],
  homeModule: "scheduling",
  moduleCopy: {
    scheduling: { label: "Schedule", blurb: "Reformer, tower and mat classes, and private sessions.", cta: "Book a class" },
    store: { label: "Shop", blurb: "Grip socks, mats and studio gear.", cta: "Shop" },
    lms: { label: "On demand", blurb: "Mat programmes from our coaches, for the days you can't make it in.", cta: "Browse programmes" },
  },
  lexicon: { booking: "Class", bookings: "Classes", plan: "Membership", course: "Programme", provider: "Coach", customer: "Member" },
  roles: ["customer", "provider"],
  provider: { home: "/provider", module: "scheduling" },
  headerCta: { label: "Book a class", href: "/book" },
  nav: {
    public: [moduleLink("scheduling", "Schedule"), { label: "Pricing", href: "/memberships", module: "scheduling" }, { label: "Coaches", href: "/team", module: "scheduling" }, moduleLink("lms", "On demand")],
    customer: customerNav([
      accountModuleLink("scheduling", "My classes"),
      accountModuleLink("lms", "On demand"),
    ]),
    provider: [
      { label: "Today", href: "/provider" },
      { label: "Week", href: "/provider/schedule" },
      { label: "Messages", href: "/account/messages" },
    ],
  },
  roleSwitch: { toProvider: "Coach view", toCustomer: "Member view", badge: "Coach" },
  home: {
    variant: "scheduling",
    sections: [
      { type: "hero", title: "Reformer Pilates in Bishop Arts.", subtitle: "Small classes, real coaching.", primary: { label: "Book a class", href: "/book" } },
    ],
  },
  scheduling: {
    style: "studio",
    prefix: "studio-",
    planPrefix: "studio-",
    timezone: "America/Chicago",
    hero: {
      kicker: "Lumen Pilates · Bishop Arts, Dallas",
      title: "Stronger,",
      em: "slowly.",
      sub: "Ten reformers, one coach who knows your name, and fifty minutes you'll feel tomorrow.",
      image: U("photo-1747238415033-b74eec07eb59", 2000),
      imageAlt: "A client working on a reformer in a bright arched studio",
      cta: "Book a class",
    },
    place: {
      name: "Lumen Pilates",
      street: "412 W Davis St",
      city: "Dallas, TX 75208",
      phone: "(214) 555-0142",
      hours: [["Mon–Fri", "6:30 AM – 8:30 PM"], ["Sat–Sun", "8:00 AM – 12:00 PM"]],
      note: "Free street parking on Davis and Bishop. Grip socks required on the reformer.",
      image: U("photo-1783841193384-4269c68aa050", 1400),
    },
    lines: ["Ten reformers per class", "Move or cancel online", "First class? Arrive 10 minutes early"],
    policy: "Can’t make it? Please cancel or move your class at least 12 hours ahead so someone else can take the reformer.",
    words: { types: "Classes", team: "Coaches", bookCta: "Book a class" },
  },
  footer: {
    blurb: "Reformer, tower and mat Pilates in Bishop Arts, Dallas.",
    columns: footerColumns(
      [moduleLink("scheduling", "Class schedule"), { label: "Pricing", href: "/memberships", module: "scheduling" }, { label: "Coaches", href: "/team", module: "scheduling" }, moduleLink("lms", "On demand")],
      [{ label: "Coach sign in", href: "/provider" }],
    ),
  },
  legal: { entityName: "", shortName: "Lumen Pilates", jurisdiction: "", email: "", effectiveDate: "" },
  support: { email: "", phone: "(214) 555-0142", hours: "Front desk Mon–Fri 6:30 AM – 8:30 PM" },
  seo: { keywords: ["reformer pilates dallas", "pilates bishop arts", "pilates class pack", "private pilates session"] },
};
