import type { Setup } from "./types";
import { accountModuleLink, customerNav, footerColumns, moduleLink } from "./shared";

const U = (id: string, w = 1600) => `https://images.unsplash.com/${id}?w=${w}&q=75&auto=format&fit=crop`;

/** Cedar Family Medicine — a family practice on Lower Greenville, Dallas. Scheduling:
 *  book by visit type and clinician, forms before the visit; each visit is a reservation
 *  (status, what you told us, moves, cancel). Visit types, clinicians, times and prices
 *  come from the engine's reservation definitions. */
export const medical: Setup = {
  id: "medical",
  brand: {
    name: "Cedar Family Medicine",
    tagline: "Family medicine on Lower Greenville.",
    description: "Same-week appointments with a family doctor or physician assistant in Dallas. Book online, do your forms before you arrive, and message your care team.",
    colors: {
      bg: "#f5f7f3", surface: "#ffffff", text: "#0f2a20", muted: "#56685f",
      primary: "#0f4c3a", primaryInk: "#ffffff", accent: "#cfe8d8", accentInk: "#0f4c3a", border: "#dde6df",
    },
    extraTokens: { "--primary-strong": "#0a3a2c", "--primary-soft": "#e3f0e7", "--highlight": "#f2c94c", "--bg-2": "#eaf1ec" },
    radius: "14px",
    fonts: {
      display: "'Newsreader',Georgia,serif",
      body: "'Public Sans',system-ui,sans-serif",
      google: ["Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500", "Public+Sans:wght@400;500;600;700"],
    },
    themeColor: "#0f4c3a",
  },
  modules: ["scheduling"],
  homeModule: "scheduling",
  moduleCopy: { scheduling: { label: "Appointments", blurb: "Book, move or cancel a visit with your clinician.", cta: "Book a visit" } },
  lexicon: { booking: "Appointment", bookings: "Appointments", customer: "Patient", provider: "Clinician" },
  roles: ["customer", "provider"],
  provider: { home: "/provider", module: "scheduling" },
  headerCta: { label: "Book a visit", href: "/book" },
  nav: {
    public: [moduleLink("scheduling", "Book a visit"), { label: "Our clinicians", href: "/team", module: "scheduling" }, { label: "Help", href: "/help" }],
    customer: customerNav([accountModuleLink("scheduling", "Appointments")]),
    provider: [
      { label: "Today", href: "/provider" },
      { label: "Schedule", href: "/provider/schedule" },
      { label: "Messages", href: "/account/messages" },
    ],
  },
  roleSwitch: { toProvider: "Clinician view", toCustomer: "Patient view", badge: "Clinician" },
  home: {
    variant: "scheduling",
    sections: [
      { type: "hero", title: "Family medicine on Lower Greenville.", subtitle: "Same-week appointments.", primary: { label: "Book a visit", href: "/book" } },
    ],
  },
  scheduling: {
    style: "clinic",
    prefix: "medical-",
    timezone: "America/Chicago",
    hero: {
      kicker: "Cedar Family Medicine · Dallas",
      title: "A doctor who has time",
      em: "for you.",
      sub: "Same-week visits with a family doctor or PA, forms done before you arrive, and answers from the person who saw you.",
      image: U("photo-1787496994867-939269b4d323", 1800),
      imageAlt: "The bright hallway of a family medicine clinic",
      cta: "Find a time",
    },
    place: {
      name: "Cedar Family Medicine",
      street: "5620 Lower Greenville Ave, Suite 200",
      city: "Dallas, TX 75206",
      phone: "(214) 555-0187",
      hours: [["Mon–Fri", "8:00 AM – 5:00 PM"], ["Lunch", "12:00 – 1:00 PM"], ["Sat–Sun", "Closed · video visits by appointment"]],
      note: "Free parking behind the building. Elevator to the second floor.",
      image: U("photo-1777269749032-d8d458ae594d", 1400),
    },
    lines: ["Most major insurance accepted", "Same-week appointments", "Video visits from home"],
    insurance: ["Aetna", "Blue Cross Blue Shield of Texas", "Cigna", "UnitedHealthcare", "Humana", "Medicare", "Self-pay"],
    policy: "Please give us 24 hours' notice if you need to cancel or move a visit, so someone else can have the time.",
    words: { types: "Visit types", team: "Our clinicians", bookCta: "Book a visit" },
  },
  footer: {
    blurb: "Family medicine for adults and kids on Lower Greenville, Dallas.",
    columns: footerColumns(
      [moduleLink("scheduling", "Book a visit"), { label: "Our clinicians", href: "/team", module: "scheduling" }, { label: "Patient forms", href: "/account/documents" }],
      [{ label: "Clinician sign in", href: "/provider" }],
    ),
  },
  legal: { entityName: "", shortName: "Cedar Family Medicine", jurisdiction: "", email: "", effectiveDate: "" },
  support: { email: "", phone: "(214) 555-0187", hours: "Mon–Fri 8:00 AM – 5:00 PM" },
  seo: { keywords: ["family doctor dallas", "primary care lower greenville", "same week doctor appointment", "video visit dallas"] },
};
