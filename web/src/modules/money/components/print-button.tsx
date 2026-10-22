"use client";

import { Icon } from "./icons";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" className="btn ghost sm mn-noprint" onClick={() => window.print()}>
      <Icon name="print" size={16} />{label}
    </button>
  );
}
