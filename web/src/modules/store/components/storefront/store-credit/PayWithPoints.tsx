'use client';

// from base-app/src/components/storefront/store-credit/PayWithPoints.tsx — ported verbatim; only import paths rewired.
import React from 'react';

/** A priced cart line as the server returns it, with its reward-points answer. */
export interface PointsPricedLine {
  payWithPoints?: boolean;
  /** Points for ONE unit; set when the line can be bought with points. */
  rewardPointsPrice?: number;
  /** Points for the whole line (price × quantity), the server's figure. */
  rewardPointsTotal?: number;
  /** Why this line can't be paid with points. */
  pointsProblem?: string;
}

const count = (v: number) => new Intl.NumberFormat('en-US').format(Number(v) || 0);

/**
 * "Pay with N points" on one cart line, for a signed-in shopper. Switching it
 * only re-asks the server; it prices the line (money 0), says how many points it
 * takes and whether the shopper has them. Nothing is taken until the order is placed.
 */
export function PayWithPoints({
  line,
  chosen,
  balance,
  busy,
  onChange,
}: {
  line: PointsPricedLine;
  /** The shopper's choice on their cart line. The server's answer (a problem, or the points it takes) shows beside it. */
  chosen: boolean;
  /** The shopper's points, as the server reports them. */
  balance?: number;
  busy?: boolean;
  onChange: (payWithPoints: boolean) => void;
}) {
  const buyable = (line.rewardPointsPrice || 0) > 0;
  if (!buyable && !chosen && !line.pointsProblem) return null;

  const label =
    line.rewardPointsTotal !== undefined && line.rewardPointsTotal !== null
      ? `Pay with ${count(line.rewardPointsTotal)} points`
      : buyable
        ? `Pay with points (${count(line.rewardPointsPrice || 0)} each)`
        : 'Pay with points';

  return (
    <div className="mt-2 text-xs">
      {(buyable || chosen) && (
        <label className={`inline-flex items-center gap-2 ${busy ? 'opacity-60' : 'cursor-pointer'}`}>
          <input
            type="checkbox"
            checked={chosen}
            disabled={busy}
            onChange={e => onChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300"
          />
          <span className="font-medium text-slate-800">{label}</span>
          {balance !== undefined && <span className="text-slate-500">· you have {count(balance)}</span>}
        </label>
      )}
      {line.pointsProblem && <p className="mt-1 text-amber-700">{line.pointsProblem}</p>}
    </div>
  );
}

export default PayWithPoints;
