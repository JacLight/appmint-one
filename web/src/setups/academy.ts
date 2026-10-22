import type { Setup } from "./types";
import { accountModuleLink, customerNav, footerColumns, moduleLink } from "./shared";

/** Fieldwork — a standalone online school for hands-on crafts (LMS). The home page is
 *  the catalog (src/modules/lms/academy-home.tsx); `home.sections` is only the
 *  fallback the generic renderer would use. */
export const academy: Setup = {
  id: "academy",
  brand: {
    name: "Fieldwork",
    tagline: "Learn a craft from people who do it for a living.",
    description: "Online courses in ceramics, woodworking, photography, baking and painting — video lessons, quizzes and teacher feedback on your work.",
    colors: {
      bg: "#fbf8f2", surface: "#ffffff", text: "#16221b", muted: "#5f675f",
      primary: "#1f4d36", primaryInk: "#ffffff", accent: "#e8a33d", accentInk: "#2a1a02", border: "#e7e1d4",
    },
    extraTokens: { "--primary-soft": "#e6efe8", "--primary-strong": "#163a28", "--highlight": "#e8a33d" },
    radius: "14px",
    fonts: {
      display: "'Fraunces',Georgia,serif",
      body: "'Inter',system-ui,sans-serif",
      google: ["Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700", "Inter:wght@400;500;600;700"],
    },
    themeColor: "#1f4d36",
  },
  // Paid courses are storefront products: the Store module's bag and checkout sell them
  // (products tagged "academy", category "courses"). No Shop link — the catalog is /learn.
  modules: ["lms", "store"],
  homeModule: "lms",
  moduleCopy: { lms: { label: "Courses", blurb: "Video courses in hands-on crafts, taught by working makers.", cta: "Browse courses" } },
  lexicon: { course: "Course", provider: "Instructor", customer: "Learner" },
  roles: ["customer"],
  nav: {
    public: [moduleLink("lms", "Browse courses"), { label: "My learning", href: "/account/learning", module: "lms" }, { label: "Help", href: "/help" }],
    customer: customerNav([accountModuleLink("lms", "My learning"), accountModuleLink("store", "Orders")]),
  },
  menu: {
    customer: [
      { label: "My learning", href: "/account/learning" },
      { label: "Browse courses", href: "/learn" },
      { label: "Orders", href: "/account/orders" },
      { label: "Account", href: "/account" },
      { label: "Settings", href: "/account/settings" },
    ],
    provider: [],
  },
  home: {
    variant: "academy",
    sections: [
      {
        type: "hero",
        title: "Learn a craft from people who do it for a living.",
        subtitle: "Video courses in ceramics, woodworking, photography, baking and painting.",
        primary: { label: "Browse courses", href: "/learn" },
      },
    ],
  },
  footer: {
    blurb: "Online courses in hands-on crafts — video lessons, quizzes and teacher feedback on your work.",
    columns: footerColumns([moduleLink("lms", "All courses"), { label: "My learning", href: "/account/learning", module: "lms" }]),
  },
  legal: { entityName: "", shortName: "Fieldwork", jurisdiction: "", email: "", effectiveDate: "" },
  support: { email: "" },
  seo: { keywords: ["online courses", "pottery class online", "woodworking course", "photography course", "bread baking class"] },
};
