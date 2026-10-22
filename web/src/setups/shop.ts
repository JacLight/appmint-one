import type { Setup } from "./types";
import type { StoreCategory } from "./store-config";
import { accountModuleLink, customerNav, footerColumns } from "./shared";


/** Fernwood's departments — the values its products carry in `post.categories`.
 *  Pointed at the demo org's real furniture catalog (tag "Designer"), with each
 *  department's image taken from one of its own products. */
const P = (path: string) => `https://fundu-space-sfo3-dev.sfo3.digitaloceanspaces.com/demo/products/${path}`;
export const FERNWOOD_CATEGORIES: StoreCategory[] = [
  { slug: "Living Room", label: "Living", image: P("brass-accent-tv-console/12.jpg") },
  { slug: "Dining", label: "Dining", image: P("round-pedestal-dining-table/10.jpg") },
  { slug: "Bedroom", label: "Bedroom", image: P("modern-stone-top-nightstand/10.jpg") },
  { slug: "Storage", label: "Storage", image: P("minimalist-open-bookshelf/12.jpg") },
  { slug: "Office Furniture", label: "Office", image: P("walnut-storage-cabinet/10.jpg") },
];

/** Fernwood — a home-goods brand (Store, retail). Warm off-white page, a serif headline
 *  face, navy ink for the buy buttons; the colour comes from the product photography.
 *  The home page is the shop (variant "store"). */
export const shop: Setup = {
  id: "shop",
  brand: {
    name: "Fernwood",
    tagline: "Walnut, marble and oak furniture for every room.",
    description: "Dining tables, nightstands, consoles, desks and storage in walnut, marble, oak and travertine — shipped from Dallas.",
    // Appmint One: a 2026 furniture house — near-black on warm paper, one walnut accent,
    // Geist for everything with Geist Mono for the small labels, square-ish corners.
    colors: {
      bg: "#f6f5f2", surface: "#ffffff", text: "#121212", muted: "#6f6c66",
      primary: "#121212", primaryInk: "#ffffff", accent: "#7b5a3c", border: "#e4e2dd",
    },
    extraTokens: {
      "--bg-2": "#ecebe7",
      "--primary-strong": "#000000",
      "--primary-soft": "#ececea",
      "--highlight": "#7b5a3c",
      // Studio furniture photos are landscape (5:4): product cards take that shape.
      "--card-ratio": "5/4",
      "--sf-r": "4px",
      "--sf-btn-r": "6px",
      "--display-w": "500",
      "--font-label": "'Geist Mono',ui-monospace,monospace",
    },
    radius: "6px",
    fonts: {
      display: "'Geist',system-ui,sans-serif",
      body: "'Geist',system-ui,sans-serif",
      google: ["Geist:wght@300;400;500;600;700", "Geist Mono:wght@400;500"],
    },
    themeColor: "#121212",
  },
  modules: ["store"],
  homeModule: "store",
  moduleCopy: { store: { label: "Shop", blurb: "Bedding, bath, kitchen and candles.", cta: "Shop all" } },
  lexicon: { item: "Product", items: "Products", booking: "Order", bookings: "Orders" },
  roles: ["customer"],
  nav: {
    public: [
      { label: "Shop all", href: "/shop", module: "store" },
      ...FERNWOOD_CATEGORIES.map((c) => ({ label: c.label, href: `/shop?category=${encodeURIComponent(c.slug)}`, module: "store" as const })),
      { label: "Gift cards", href: "/shop/gift-cards", module: "store" },
    ],
    customer: customerNav([
      accountModuleLink("store", "Orders"),
      { label: "Returns", href: "/account/returns", module: "store" },
      { label: "Gift cards", href: "/account/gift-cards", module: "store" },
    ]),
  },
  home: { variant: "store", sections: [] },
  store: {
    variant: "retail",
    tags: ["Designer"],
    categories: FERNWOOD_CATEGORIES,
    announcement: "Free shipping on orders over $100 · Free returns for 60 days",
    hero: {
      title: "Pieces built to stay.",
      subtitle: "Walnut, marble, oak and travertine furniture for the rooms you live in.",
      image: P("wood-travertine-nightstand/10.jpg"),
      cta: { label: "Shop dining", href: "/shop?category=Dining" },
      secondary: { label: "Shop all", href: "/shop" },
    },
    editorial: [
      { eyebrow: "The living room", title: "Consoles, coffee tables and side tables in brass, walnut and stone.", image: P("modern-travertine-coffee-table/13.png"), cta: { label: "Shop living", href: "/shop?category=Living%20Room" } },
      { eyebrow: "The table", title: "Marble, walnut and oak dining tables for long dinners.", image: P("mid-century-walnut-dining-table/11.png"), cta: { label: "Shop dining", href: "/shop?category=Dining" } },
    ],
    // Appmint One: the home's "shop the room" — the products' own in-room photos, pins on the piece each one sells.
    rooms: [
      { label: "Dining room", image: P("modern-oval-dining-table/10.jpg"), href: "/shop?category=Dining", pins: [{ slug: "modern-oval-dining-table", x: 47, y: 44 }] },
      { label: "Living room", image: P("brass-accent-tv-console/12.jpg"), href: "/shop?category=Living%20Room", pins: [{ slug: "brass-accent-tv-console", x: 60, y: 58 }] },
      { label: "Bedroom", image: P("oak-brass-nightstand/10.jpg"), href: "/shop?category=Bedroom", pins: [{ slug: "oak-brass-nightstand", x: 84, y: 58 }] },
      { label: "Dresser", image: P("mid-century-6-drawer-dresser/10.jpg"), href: "/shop?category=Bedroom", pins: [{ slug: "mid-century-6-drawer-dresser", x: 62, y: 70 }] },
    ],
    materials: [
      { label: "Walnut", keyword: "walnut", image: P("round-modern-bookshelf/12.jpg") },
      { label: "Oak", keyword: "oak", image: P("japanese-style-square-dining-table/12.jpg") },
      { label: "Marble", keyword: "marble", image: P("walnut-storage-cabinet/12.jpg") },
      { label: "Travertine", keyword: "travertine", image: P("metal-base-coffee-table/10.jpg") },
    ],
    spotlight: { slug: "mid-century-walnut-dining-table", image: P("mid-century-walnut-dining-table/13.png"), eyebrow: "The table" },
    perks: ["Free shipping over $100", "Free returns for 60 days", "Ships from Dallas in 1–2 days"],
  },
  footer: {
    blurb: "Walnut, marble, oak and travertine furniture for every room. Shipped from Dallas.",
    columns: footerColumns(
      [{ label: "Shop all", href: "/shop", module: "store" }, ...FERNWOOD_CATEGORIES.map((c) => ({ label: c.label, href: `/shop?category=${encodeURIComponent(c.slug)}`, module: "store" as const })), { label: "Gift cards", href: "/shop/gift-cards", module: "store" }],
      [{ label: "Orders & returns", href: "/account/orders", module: "store" }],
    ),
  },
  legal: { entityName: "", shortName: "Fernwood", jurisdiction: "", email: "", effectiveDate: "" },
  support: { email: "" },
  seo: { keywords: ["walnut dining table", "marble dining table", "nightstands", "modern furniture", "furniture Dallas"] },
};
