import type { FooterColumn, ModuleId, NavLink } from "./types";
import { MODULES } from "./modules";

/** The signed-in customer's sidebar every setup shares. Module entries go between
 *  Overview and the common features. */
export function customerNav(moduleLinks: NavLink[] = []): NavLink[] {
  return [
    { label: "Overview", href: "/account" },
    ...moduleLinks,
    { label: "Wallet", href: "/account/wallet" },
    { label: "Messages", href: "/account/messages" },
    { label: "Documents", href: "/account/documents" },
    { label: "Settings", href: "/account/settings" },
    { label: "Support", href: "/account/support" },
  ];
}

/** Public link to a module's entry page. */
export function moduleLink(id: ModuleId, label: string): NavLink {
  return { label, href: MODULES[id].path, module: id };
}
/** Signed-in link to a module's "mine" page. */
export function accountModuleLink(id: ModuleId, label: string): NavLink {
  return { label, href: MODULES[id].accountPath, module: id };
}

/** Footer: the setup's own explore column + company + legal. */
export function footerColumns(explore: NavLink[], company: NavLink[] = []): FooterColumn[] {
  return [
    { title: "Explore", items: explore },
    { title: "Company", items: [...company, { label: "Help center", href: "/help" }, { label: "Contact", href: "/help#contact" }] },
    { title: "Account", items: [{ label: "Sign in", href: "/login" }, { label: "Create account", href: "/signup" }, { label: "Your account", href: "/account" }] },
    { title: "Legal", items: [{ label: "Terms", href: "/terms" }, { label: "Privacy", href: "/privacy" }, { label: "Cookies", href: "/cookies" }] },
  ];
}
