'use client';
/**
 * appmint-one addition (base-app shows no QR on the web; Jacob wants it here): the
 * holder's door QR, drawn from base-app's `getEventTicketQR` (the engine signs a code
 * valid for 60 s) and re-fetched every 45 s so the code on screen is always accepted.
 */
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { eventsAPI } from './events-client';

const REFRESH_MS = 45_000;

export const LiveQr: React.FC<{ ticketId: string }> = ({ ticketId }) => {
  const [svg, setSvg] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let off = false;
    const load = async () => {
      const t = await eventsAPI.getEventTicketQR(ticketId);
      const c = t?.code || t?.data?.code || null; // base-app's unwrap hands back ticket.data
      if (off) return;
      setFailed(!c);
      if (!c) return;
      setCode(c);
      setSvg(await QRCode.toString(c, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }));
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { off = true; clearInterval(timer); };
  }, [ticketId]);

  return (
    <div className="mb-5">
      <div className="w-56 h-56 max-w-full mx-auto bg-white rounded-xl p-3" role="img" aria-label="Ticket QR code">
        {svg ? <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} /> : (
          <div className="w-full h-full animate-pulse bg-gray-200 rounded" />
        )}
      </div>
      <p className="text-xs text-[var(--muted)] mt-3">
        {failed ? 'Couldn’t load the code. Check your connection.' : code ? 'Live code · refreshes on its own' : 'Loading your code…'}
      </p>
    </div>
  );
};
