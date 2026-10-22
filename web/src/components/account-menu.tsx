"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { routes } from "@/lib/nav";
import type { HeaderModel } from "@/lib/chrome";
import { signOutAction } from "@/app/actions/auth";

export function AccountMenu({ email, host, providerMode = false, model }: { email: string; host: boolean; providerMode?: boolean; model: HeaderModel }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const initial = (email || "?").charAt(0).toUpperCase();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const item: React.CSSProperties = { display: "block", padding: "10px 16px", fontSize: 14.5, color: "var(--text-2)", fontFamily: "var(--font-display)", fontWeight: 500 };
  const shut = () => setOpen(false);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: 0, cursor: "pointer", padding: 4 }}
      >
        <span style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--accent)", color: "var(--accent-ink)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700 }}>{initial}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 220, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, boxShadow: "var(--shadow-lg)", padding: "8px 0", zIndex: 80 }}>
          <div style={{ padding: "6px 16px 10px", borderBottom: "1px solid var(--border-2)", marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: "var(--faint)", fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: ".05em" }}>Signed in</div>
            <div style={{ fontSize: 13.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
          </div>
          {providerMode ? (
            <>
              {model.menu.provider.map((n) => <Link key={n.href} href={n.href} style={item} onClick={shut}>{n.label}</Link>)}
              <div style={{ borderTop: "1px solid var(--border-2)", margin: "6px 0" }} />
              <Link href={routes.account} style={{ ...item, color: "var(--accent-strong)", fontWeight: 600 }} onClick={shut}>{model.roleSwitch.toCustomer}</Link>
              {model.menu.providerAfter.map((n) => <Link key={n.href} href={n.href} style={item} onClick={shut}>{n.label}</Link>)}
            </>
          ) : (
            <>
              {model.menu.customer.map((n) => <Link key={n.href} href={n.href} style={item} onClick={shut}>{n.label}</Link>)}
              {model.providerSide && (
                <Link href={model.providerHome} style={item} onClick={shut}>{host ? model.roleSwitch.toProvider : model.becomeProvider}</Link>
              )}
            </>
          )}
          <div style={{ borderTop: "1px solid var(--border-2)", marginTop: 6, paddingTop: 6 }}>
            <button
              disabled={pending}
              onClick={() => start(async () => { await signOutAction(); setOpen(false); router.push(routes.home); router.refresh(); })}
              style={{ ...item, width: "100%", textAlign: "left", background: "none", border: 0, cursor: "pointer", color: "var(--primary-strong)" }}
            >
              {pending ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
