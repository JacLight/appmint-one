"use client";

import { useState } from "react";

/** Re-open a pending request: copy the link again or show the QR to a customer who
 *  walked back up. The row keeps its url until it's paid. */
export function PendingLink({ url }: { url: string }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(url)}`;
  return (
    <>
      <button type="button" className="hp-reshow" onClick={() => setShow(!show)}>{show ? "Hide" : "Show QR"}</button>
      {show && (
        <div className="hp-qrpop">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Scan to pay" width={220} height={220} />
          <button type="button" className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
    </>
  );
}
