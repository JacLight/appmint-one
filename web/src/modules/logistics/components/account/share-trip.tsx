"use client";

import { useState } from "react";
import { Icon } from "@/modules/logistics/components/shared/icons";

/** Share where you are: the status, the car and the drop-off, through the phone's share
 *  sheet (or copied). There is no public tracking link yet, so it shares the facts. */
export function ShareTrip({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="mv-act" onClick={async () => {
      try {
        if (navigator.share) { await navigator.share({ text }); return; }
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 2200);
      } catch { /* dismissed */ }
    }}>
      <span><Icon name="share" size={19} /></span>{done ? "Copied" : "Share"}
    </button>
  );
}
