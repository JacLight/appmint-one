import type { Setup } from "./types";
import { accountModuleLink, customerNav, footerColumns } from "./shared";

/** muvmnt — food delivery on the web (Store, food variant + Logistics delivery leg).
 *  Rides, package delivery and driving are app-only; the web has a page for each. */
export const muvmnt: Setup = {
  id: "muvmnt",
  brand: {
    name: "muvmnt",
    tagline: "Food from local kitchens, delivered.",
    description: "Food from local kitchens, delivered. See the delivery fee before you order and follow your food on the map to the door. Rides and package delivery in the muvmnt app.",
    colors: {
      bg: "#f6f6f2", surface: "#ffffff", text: "#111111", muted: "#5d5f58",
      primary: "#111111", primaryInk: "#ffffff", accent: "#00e07a", accentInk: "#06281a", border: "#e4e4dc",
    },
    extraTokens: { "--primary-soft": "#e9fbf1", "--pop": "#00e07a", "--pop-strong": "#00c56b", "--highlight": "#00e07a" },
    radius: "18px",
    fonts: {
      display: "'Space Grotesk',system-ui,sans-serif",
      body: "'Inter',system-ui,sans-serif",
      google: ["Space+Grotesk:wght@500;600;700", "Inter:wght@400;500;600;700"],
    },
    themeColor: "#111111",
  },
  modules: ["logistics", "store"],
  store: { variant: "food", foodTag: "muvmnt", defaultAddress: { label: "Downtown Dallas", address: "1500 Marilla St, Dallas, TX 75201" } },
  homeModule: "logistics",
  moduleCopy: { logistics: { label: "Orders", blurb: "Your food orders and deliveries, with receipts and live tracking.", cta: "Order food" } },
  lexicon: { job: "Delivery", jobs: "Orders", provider: "Courier", customer: "Customer" },
  roles: ["customer"],
  nav: {
    public: [
      { label: "Eat", href: "/eat", module: "store" },
      { label: "Ride", href: "/ride", module: "logistics" },
      { label: "Send", href: "/send", module: "logistics" },
      { label: "Drive", href: "/drive", module: "logistics" },
      { label: "Help", href: "/help" },
    ],
    customer: customerNav([accountModuleLink("logistics", "Orders")]),
  },
  headerCta: { label: "Drive with muvmnt", href: "/drive" },
  home: {
    // The product home: food ordering, address + restaurants (src/modules/logistics/muvmnt-home.tsx).
    variant: "muvmnt",
    sections: [],
  },
  footer: {
    blurb: "Food from local kitchens, delivered by vetted local couriers. The delivery fee you see is the fee you pay.",
    columns: footerColumns([{ label: "Eat", href: "/eat", module: "store" }, { label: "Ride (app)", href: "/ride", module: "logistics" }, { label: "Send a package (app)", href: "/send", module: "logistics" }, { label: "Drive with muvmnt", href: "/drive", module: "logistics" }]),
  },
  legal: { entityName: "", shortName: "muvmnt", jurisdiction: "", email: "", effectiveDate: "" },
  support: { email: "" },
  seo: { keywords: ["food delivery", "restaurants near me", "order food online", "ride app", "same day delivery"] },
};
