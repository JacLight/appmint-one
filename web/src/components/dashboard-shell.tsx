"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

/** Sidebar + content shell for the signed-in areas (/account/*, /host/*).
 *  Desktop: fixed sidebar + fluid content. The content track is minmax(0,1fr)
 *  and the content cell is min-width:0 so wide dashboards never blow the grid out.
 *  Mobile (<=880px): the shell stacks and the sidebar becomes a horizontally
 *  scrollable pill row so nothing is cramped or clipped. */
export function DashboardShell({
  nav,
  title,
  action,
  children,
}: {
  nav: NavItem[];
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const isActive = (href: string) => path === href || (href !== "/account" && href !== "/host" && path.startsWith(href));

  return (
    <div className="dash wrap" style={{ display: "grid", gridTemplateColumns: "228px minmax(0,1fr)", gap: 40, alignItems: "start", padding: "30px 34px 70px" }}>
      <style>{`
        .dash-main{min-width:0}
        .dash-side{position:sticky;top:100px}
        .dash-nav{display:flex;flex-direction:column;gap:2px}
        .dash-nav a{padding:10px 14px;border-radius:12px;font-family:var(--font-display);font-weight:600;font-size:14.5px;white-space:nowrap;transition:.15s}
        @media(max-width:880px){
          .dash{grid-template-columns:minmax(0,1fr) !important;gap:16px !important;padding-top:16px !important}
          .dash-side{position:static !important;top:auto !important;margin:0 -20px;padding:0 20px}
          .dash-nav{flex-direction:row;overflow-x:auto;gap:8px;padding-bottom:4px;-webkit-overflow-scrolling:touch}
          .dash-nav::-webkit-scrollbar{height:0}
          .dash-nav a{flex:none;border:1px solid var(--border);background:var(--surface)}
        }
      `}</style>

      <aside className="dash-side">
        <nav className="dash-nav">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              style={{
                color: isActive(n.href) ? "#fff" : "var(--text-2)",
                background: isActive(n.href) ? "var(--text)" : undefined,
              }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="dash-main">
        {(title || action) && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
            {title ? <h1 style={{ fontSize: "clamp(24px,3vw,36px)", minWidth: 0, wordBreak: "break-word" }}>{title}</h1> : <span />}
            {action}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Page heading inside a DashboardShell that a layout renders (e.g. /account). */
export function PageTitle({ title, action }: { title?: string; action?: React.ReactNode }) {
  if (!title && !action) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
      {title ? <h1 style={{ fontSize: "clamp(24px,3vw,36px)", minWidth: 0, wordBreak: "break-word" }}>{title}</h1> : <span />}
      {action}
    </div>
  );
}
