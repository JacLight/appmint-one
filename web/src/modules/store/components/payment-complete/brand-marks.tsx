// from base-app/src/components/payment-complete/brand-marks.tsx — ported verbatim; only import paths rewired.
import React from 'react';

/**
 * Payment brand marks.
 *
 * Drawn inline rather than loaded, so they cannot be blocked, cannot flash in
 * late, and stay crisp at any size. Text pills reading "VISA" and an italic
 * "PayPal" are not branding — a payer scans a checkout for the shapes and
 * colours they already know, and a row of grey boxes reads as unfinished.
 *
 * Each keeps its owner's colours; none is stretched or recoloured.
 */

export const VisaMark = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 48 16" className={className} role="img" aria-label="Visa" focusable="false">
    <text x="0" y="13" fill="#1434CB" fontFamily="Helvetica, Arial, sans-serif" fontSize="15" fontWeight="700" fontStyle="italic" letterSpacing="-.5">
      VISA
    </text>
  </svg>
);

export const MastercardMark = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 40 24" className={className} role="img" aria-label="Mastercard" focusable="false">
    <circle cx="15" cy="12" r="9" fill="#EB001B" />
    <circle cx="25" cy="12" r="9" fill="#F79E1B" />
    {/* The overlap is the mark — without it they read as two loose dots. */}
    <path d="M20 5.1a9 9 0 0 0 0 13.8 9 9 0 0 0 0-13.8Z" fill="#FF5F00" />
  </svg>
);

export const AmexMark = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 40 24" className={className} role="img" aria-label="American Express" focusable="false">
    <rect width="40" height="24" rx="3" fill="#1F72CD" />
    <text x="20" y="15" textAnchor="middle" fill="#fff" fontFamily="Helvetica, Arial, sans-serif" fontSize="8" fontWeight="700">
      AMEX
    </text>
  </svg>
);

/**
 * The schemes a card gateway accepts.
 *
 * Secondary to the gateway's own mark: Stripe is who takes the money, these
 * are what it will take. Shown small and to the side, never in its place.
 */
export const CardMarks = ({ className = '' }: { className?: string }) => (
  <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
    <VisaMark className="pay-mark-visa" />
    <MastercardMark className="pay-mark-scheme" />
    <AmexMark className="pay-mark-scheme" />
  </span>
);

export const PayPalMark = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 68 20" className={className} role="img" aria-label="PayPal" focusable="false">
    <text x="0" y="15" fill="#253B80" fontFamily="Helvetica, Arial, sans-serif" fontSize="16" fontWeight="700" fontStyle="italic">
      Pay
    </text>
    <text x="30" y="15" fill="#179BD7" fontFamily="Helvetica, Arial, sans-serif" fontSize="16" fontWeight="700" fontStyle="italic">
      Pal
    </text>
  </svg>
);


export const StripeMark = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 60 20" className={className} role="img" aria-label="Stripe" focusable="false">
    <text x="0" y="15" fill="#635BFF" fontFamily="Helvetica, Arial, sans-serif" fontSize="16" fontWeight="700" letterSpacing="-.6">
      stripe
    </text>
  </svg>
);
