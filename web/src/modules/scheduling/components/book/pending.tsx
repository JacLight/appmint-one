"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * In-page navigation on the booking page (reason, week, "show everyone") re-renders on the
 * server with the same route, so Next's loading screen doesn't show. This keeps the page
 * honest while it does: the link that was pressed spins and the results turn to skeletons.
 */
export const PendingCtx = createContext<{ pending: boolean; target?: string; go: (href: string) => void }>({ pending: false, go: () => {} });

export function PendingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<string>();
  const go = (href: string) => {
    setTarget(href);
    start(() => router.push(href, { scroll: false }));
  };
  return <PendingCtx.Provider value={{ pending, target, go }}>{children}</PendingCtx.Provider>;
}

export function PendingLink({ href, className = "", children, ...rest }: { href: string; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className">) {
  const { pending, target, go } = useContext(PendingCtx);
  const busy = pending && target === href;
  return (
    <a {...rest} href={href} aria-busy={busy || undefined} className={`${className}${busy ? " is-busy" : ""}`}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        go(href);
      }}>
      {children}
      {busy && <span className="sk-spin" aria-hidden />}
    </a>
  );
}

/** The results, or their skeleton while the next ones load. */
export function PendingArea({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const { pending } = useContext(PendingCtx);
  return <div aria-busy={pending || undefined} aria-live="polite">{pending ? fallback : children}</div>;
}
