import type { NavLink, Setup } from "./types";
import { footerColumns } from "./shared";

const B = "/account/banking";

/** The signed-in bank's sidebar: banking first, then the common features. The wallet
 *  (store credit) is left out on purpose — next to real bank accounts it would confuse. */
const bankNav: NavLink[] = [
  { label: "Home", href: `${B}/home`, module: "money" },
  { label: "Accounts", href: `${B}/accounts`, module: "money" },
  { label: "Transactions", href: `${B}/transactions`, module: "money" },
  { label: "Send money", href: `${B}/send`, module: "money" },
  { label: "Receive", href: `${B}/receive`, module: "money" },
  { label: "Request money", href: `${B}/request`, module: "money" },
  { label: "Cards", href: `${B}/cards`, module: "money" },
  { label: "Statements", href: `${B}/statements`, module: "money" },
  { label: "Recipients", href: `${B}/recipients`, module: "money" },
  { label: "Verification", href: `${B}/identity`, module: "money" },
  { label: "Messages", href: "/account/messages" },
  { label: "Documents", href: "/account/documents" },
  { label: "Settings", href: "/account/settings" },
  { label: "Support", href: "/account/support" },
];

/** Tidewell — a personal bank on the Money module. The banking API is not built yet:
 *  in dev the screens run on sample data with a banner; in production they say
 *  "Not available yet" until the API is connected. */
export const bank: Setup = {
  id: "bank",
  brand: {
    name: "Tidewell",
    tagline: "Banking, made clear.",
    description: "Checking, savings and a debit card in one app. Send money to any bank, to anyone at Tidewell, or between your own accounts — and see every transaction the moment it happens.",
    logo: "/brands/tidewell/logo.svg",
    logoHeight: 30,
    favicon: "/brands/tidewell/icon.svg",
    colors: {
      bg: "#ffffff", surface: "#ffffff", text: "#0b1c24", muted: "#5b6b72",
      primary: "#0b5563", primaryInk: "#ffffff", accent: "#bff0dd", accentInk: "#073b44", border: "#e2e8ea",
    },
    extraTokens: { "--bg-2": "#f1f4f5", "--border-2": "#edf1f2", "--primary-soft": "#e3eff1" },
    radius: "14px",
    fonts: {
      display: "'Instrument Sans','Inter',system-ui,sans-serif",
      body: "'Inter',system-ui,sans-serif",
      google: ["Instrument+Sans:wght@500;600;700", "Inter:wght@400;500;600;700"],
    },
    themeColor: "#0b5563",
  },
  modules: ["money"],
  homeModule: "money",
  moduleCopy: { money: { label: "Banking", blurb: "Accounts, transfers, cards and statements.", cta: "Open banking" } },
  lexicon: { account: "Account" },
  roles: ["customer"],
  nav: {
    public: [
      { label: "Checking", href: "/#checking" },
      { label: "Savings", href: "/#savings" },
      { label: "Debit card", href: "/#card" },
      { label: "Send money", href: "/#send" },
      { label: "Help", href: "/help" },
    ],
    customer: bankNav,
  },
  menu: {
    customer: [
      { label: "Banking home", href: `${B}/home` },
      { label: "Accounts", href: `${B}/accounts` },
      { label: "Send money", href: `${B}/send` },
      { label: "Cards", href: `${B}/cards` },
      { label: "Statements", href: `${B}/statements` },
      { label: "Settings", href: "/account/settings" },
    ],
    provider: [],
  },
  home: {
    variant: "bank",
    // The bank home is its own page (src/modules/money/components/home); these are unused.
    sections: [],
  },
  footer: {
    blurb: "Personal checking, savings and debit cards. Send, receive and request money in one app.",
    columns: footerColumns(
      [{ label: "Checking", href: "/#checking" }, { label: "Savings", href: "/#savings" }, { label: "Debit card", href: "/#card" }, { label: "Send money", href: "/#send" }],
      [{ label: "Security", href: "/#security" }],
    ),
    bottomNote: "Tidewell is a demonstration bank brand. Deposit products are offered only once the bank’s legal entity and partner bank are named here.",
  },
  legal: { entityName: "", jurisdiction: "", email: "", effectiveDate: "" },
  support: { email: "" },
  auth: {
    loginLead: "Sign in to see your balances, move money and manage your card.",
    signupLead: "Open your Tidewell profile in a couple of minutes.",
  },
  seo: { keywords: ["online banking", "checking account", "high-yield savings", "send money", "debit card"] },
};
