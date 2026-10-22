import type { Setup } from "./types";
import { accountModuleLink, customerNav, footerColumns, moduleLink } from "./shared";
import { FERNWOOD_CATEGORIES } from "./shop";

/** Every module on — for showing the platform, never for a customer build. Also the
 *  fallback when PORTAL_SETUP is missing or unknown. */
export const demo: Setup = {
  id: "demo",
  brand: {
    name: "Appmint One",
    tagline: "One account for everything you book, buy and track.",
    description: "Appointments, deliveries, rentals, shopping, events, banking and courses — one sign-in, one wallet, one inbox.",
    colors: {
      bg: "#f5f7fa", surface: "#ffffff", text: "#14213d", muted: "#5a6478",
      primary: "#14213d", primaryInk: "#ffffff", accent: "#4dd4e8", accentInk: "#062a31", border: "#e0e5ee",
    },
    radius: "18px",
    fonts: {
      display: "'Space Grotesk',system-ui,sans-serif",
      body: "'Inter',system-ui,sans-serif",
      google: ["Space+Grotesk:wght@500;600;700", "Inter:wght@400;500;600;700"],
    },
    themeColor: "#14213d",
  },
  modules: ["scheduling", "logistics", "rentals", "store", "events", "money", "lms"],
  homeModule: "scheduling",
  lexicon: {},
  roles: ["customer", "provider"],
  provider: { benefit: "stowbo-host", home: "/host" },
  nav: {
    public: [
      moduleLink("scheduling", "Book"),
      moduleLink("logistics", "Send"),
      moduleLink("rentals", "Rent"),
      moduleLink("store", "Shop"),
      moduleLink("events", "Events"),
      { label: "Help", href: "/help" },
    ],
    customer: customerNav([
      accountModuleLink("scheduling", "Bookings"),
      accountModuleLink("logistics", "Jobs"),
      { label: "Rentals", href: "/account/bookings", module: "rentals" },
      accountModuleLink("store", "Orders"),
      accountModuleLink("events", "Tickets"),
      accountModuleLink("money", "Banking"),
      accountModuleLink("lms", "Courses"),
    ]),
    provider: [
      { label: "Dashboard", href: "/host" },
      { label: "Listings", href: "/host/listings" },
      { label: "Earnings", href: "/host/earnings" },
      { label: "Messages", href: "/host/messages" },
    ],
  },
  home: {
    sections: [
      {
        type: "hero",
        eyebrow: "One account",
        title: "Everything you book, buy and track.",
        subtitle: "Book an appointment, send a package, rent what you need, grab tickets and keep learning — with one sign-in, one wallet and one inbox for all of it.",
        primary: { label: "Create your account", href: "/signup" },
        secondary: { label: "Sign in", href: "/login" },
        points: ["One wallet", "One inbox", "Documents in one place"],
        preview: [
          { label: "Booking", title: "Thu, Oct 23 · 10:30 AM", detail: "Consultation · 45 min", badge: "Confirmed" },
          { label: "Delivery", title: "Out for delivery", detail: "ETA 2:40 PM", badge: "Live", progress: 0.7 },
          { label: "Ticket", title: "Saturday Session", detail: "QR ready" },
        ],
      },
      { type: "modules", eyebrow: "What's inside", title: "Switch on what your business needs", subtitle: "Every module shares the same account, wallet, messages and documents." },
      {
        type: "highlights", eyebrow: "Common to every setup", title: "The basics, done properly",
        items: [
          { title: "Sign in your way", body: "Password, magic link, Google, Facebook and two-step verification." },
          { title: "Wallet and payouts", body: "Balances, history and payout destinations in one place." },
          { title: "Messages and support", body: "Threads with attachments and live chat with the business." },
          { title: "Documents", body: "Upload files and keep what you share with the business together." },
        ],
      },
      { type: "cta", title: "Try it with a free account.", primary: { label: "Create account", href: "/signup" }, secondary: { label: "Sign in", href: "/login" } },
    ],
  },
  footer: {
    blurb: "One account for appointments, deliveries, rentals, shopping, events, banking and courses.",
    columns: footerColumns([
      moduleLink("scheduling", "Book"), moduleLink("logistics", "Send"), moduleLink("rentals", "Rent"),
      moduleLink("store", "Shop"), moduleLink("events", "Events"), moduleLink("money", "Banking"), moduleLink("lms", "Learn"),
    ]),
  },
  // Store: both the retail shop (Fernwood's catalog) and food ordering (muvmnt's restaurants).
  store: { variant: "both", tags: ["shop"], foodTag: "muvmnt", categories: FERNWOOD_CATEGORIES, perks: ["Free returns for 60 days"], defaultAddress: { label: "Downtown Dallas", address: "1500 Marilla St, Dallas, TX 75201" } },
  legal: { entityName: "", shortName: "Appmint One", jurisdiction: "", email: "", effectiveDate: "" },
  support: { email: "" },
};
