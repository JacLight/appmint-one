"use client";

import { useEffect } from "react";

/** A reusable right-side drawer for the host dashboard — walk-in intake, booking
 *  quick-view, etc. Modal (focus the task): backdrop + Escape close it, body
 *  scroll is locked while open. */
export function HostDrawer({ open, title, subtitle, onClose, children, width = 460 }: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drw-ov" role="dialog" aria-modal="true" onClick={onClose}>
      <aside className="drw-panel" style={{ width: `min(${width}px, 100%)` }} onClick={(e) => e.stopPropagation()}>
        <div className="drw-hd">
          <div>
            <h2 className="drw-title">{title}</h2>
            {subtitle && <p className="drw-sub">{subtitle}</p>}
          </div>
          <button type="button" className="drw-x" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="drw-body">{children}</div>
      </aside>
    </div>
  );
}
