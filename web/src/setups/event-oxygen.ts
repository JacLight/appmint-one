import type { Setup } from "./types";
import { accountModuleLink, customerNav, footerColumns, moduleLink } from "./shared";

/** Event Oxygen — nightlife tickets (Events) with merch (Store). Runs dark: near-black
 *  plum, one loud accent (oxygen coral) for dates and the buy button; the event
 *  posters carry the colour. The home page IS the calendar (variant "events"). */
export const eventOxygen: Setup = {
  id: "event-oxygen",
  brand: {
    name: "Event Oxygen",
    tagline: "The nights worth leaving the house for.",
    description: "Club nights, live music and parties. Tickets in a couple of taps, a QR at the door, and transfers when plans change.",
    colors: {
      bg: "#0b0910", surface: "#15111d", text: "#f4f1fa", muted: "#9b94ad",
      primary: "#ff4d6d", primaryInk: "#ffffff", accent: "#8f73ff", border: "#272133",
    },
    extraTokens: {
      "--bg-2": "#120f19",
      "--surface-2": "#1d1828",
      "--text-2": "#d8d2e4",
      "--faint": "#6f6982",
      "--border-2": "#1d1828",
      "--primary-strong": "#ff2f55",
      "--primary-soft": "#3a1622",
      "--accent-soft": "#221a3a",
      "--accent-strong": "#c3b4ff",
      "--hosting-bg": "#140f1f",
      "--switch-border": "#3a2f55",
      "--pop": "#ff8aa0",
      "--pop-strong": "#ff6d88",
      "--highlight": "#ffcf5a",
    },
    radius: "18px",
    fonts: {
      display: "'Sora',system-ui,sans-serif",
      body: "'Inter',system-ui,sans-serif",
      google: ["Sora:wght@500;600;700;800", "Inter:wght@400;500;600;700"],
    },
    themeColor: "#0b0910",
  },
  modules: ["events", "store"],
  homeModule: "events",
  moduleCopy: {
    events: { label: "Events", blurb: "Club nights, live music, festivals and parties — tickets on your phone.", cta: "Find events" },
    store: { label: "Merch", blurb: "Official merch and add-ons, shipped or picked up at the door.", cta: "Shop merch" },
  },
  lexicon: { item: "Ticket", items: "Tickets", booking: "Event", bookings: "Events" },
  // The web sells and transfers tickets; door staff work in the mobile app, so there
  // is no provider side here.
  roles: ["customer"],
  nav: {
    public: [moduleLink("events", "Events"), moduleLink("store", "Merch"), { label: "Help", href: "/help" }],
    customer: customerNav([accountModuleLink("events", "My tickets"), { label: "Ticket orders", href: "/account/ticket-orders", module: "events" }, accountModuleLink("store", "Merch orders")])
      .filter((l) => l.href !== "/account"), // /account opens on My tickets here
  },
  home: { variant: "events", sections: [] },
  footer: {
    blurb: "Tickets for the nights worth showing up for. QR at the door, transfers when plans change.",
    columns: footerColumns([moduleLink("events", "Events"), { label: "This weekend", href: "/events?when=weekend" }, moduleLink("store", "Merch")]),
  },
  legal: { entityName: "", shortName: "Event Oxygen", jurisdiction: "", email: "", effectiveDate: "" },
  support: { email: "" },
  seo: { keywords: ["event tickets", "club tickets", "concert tickets", "things to do this weekend", "nightlife"] },
};
