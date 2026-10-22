"use client";
import { useState } from "react";

/** "Expand all sections" for the course content accordions (native <details>). */
export function ExpandAll({ target }: { target: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className="lm-linkbtn"
      onClick={() => {
        const next = !open;
        document.querySelectorAll<HTMLDetailsElement>(`${target} details`).forEach((d) => (d.open = next));
        setOpen(next);
      }}
    >
      {open ? "Collapse all sections" : "Expand all sections"}
    </button>
  );
}
