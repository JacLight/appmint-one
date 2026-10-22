"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

const B = "/account/banking";
const TABS: { label: string; href: string; icon: IconName }[] = [
  { label: "Home", href: `${B}/home`, icon: "home" },
  { label: "Accounts", href: `${B}/accounts`, icon: "accounts" },
  { label: "Send", href: `${B}/send`, icon: "sendUp" },
  { label: "Cards", href: `${B}/cards`, icon: "card" },
];
const MORE: { label: string; href: string; icon: IconName }[] = [
  { label: "Transactions", href: `${B}/transactions`, icon: "search" },
  { label: "Receive", href: `${B}/receive`, icon: "receive" },
  { label: "Request money", href: `${B}/request`, icon: "request" },
  { label: "Recipients", href: `${B}/recipients`, icon: "recipients" },
  { label: "Statements", href: `${B}/statements`, icon: "statement" },
  { label: "Messages", href: "/account/messages", icon: "mail" },
  { label: "Settings", href: "/account/settings", icon: "user" },
  { label: "Support", href: "/account/support", icon: "info" },
];

/** Phone-width bottom tab bar for the banking screens (the sidebar hides there). */
export function BankTabBar() {
  const path = usePathname() || "";
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  const on = (href: string) => path === href || path.startsWith(href + "/");
  const moreOn = MORE.some((m) => on(m.href));
  return (
    <>
      <nav className="mn-tabbar" aria-label="Banking">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={`${on(t.href) ? "on" : ""}${t.label === "Send" ? " send" : ""}`} aria-current={on(t.href) ? "page" : undefined}>
            <span className="ic"><Icon name={t.icon} size={t.label === "Send" ? 22 : 21} /></span>
            <span>{t.label}</span>
          </Link>
        ))}
        <button type="button" className={moreOn || open ? "on" : ""} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="ic"><Icon name="grid" size={20} /></span>
          <span>More</span>
        </button>
      </nav>
      {open && (
        <div className="mn-sheet-bg" onClick={() => setOpen(false)}>
          <div className="mn-sheet" role="dialog" aria-label="More" onClick={(e) => e.stopPropagation()}>
            <i className="mn-sheet-grab" aria-hidden />
            <div className="mn-sheet-grid">
              {MORE.map((m) => (
                <Link key={m.href} href={m.href} className={on(m.href) ? "on" : ""}>
                  <span className="ic"><Icon name={m.icon} size={20} /></span>
                  {m.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
