"use client";

import { useState } from "react";

const TYPES = [
  { label: "Bag & box drop", rate: 4 },
  { label: "Car parking space", rate: 9 },
  { label: "Locker", rate: 3 },
  { label: "Storage box (monthly)", rate: 34 },
];

export function EarningsCalc() {
  const [qty, setQty] = useState(20);
  const [price, setPrice] = useState(3);

  const gross = qty * price * 30;
  const net = gross * 0.82;

  return (
    <div className="calc">
      <h3>What could you earn?</h3>
      <div className="field">
        <label>What you&apos;d host</label>
        <select
          onChange={(e) => setPrice(TYPES[e.target.selectedIndex].rate)}
        >
          {TYPES.map((t) => (
            <option key={t.label}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>
          Items / cars per day: <b>{qty}</b>
        </label>
        <input
          type="range"
          min={2}
          max={80}
          value={qty}
          onChange={(e) => setQty(parseInt(e.target.value, 10))}
        />
      </div>
      <div className="field">
        <label>
          Your price each: <b>${price}</b>
        </label>
        <input
          type="range"
          min={1}
          max={15}
          step={0.5}
          value={price}
          onChange={(e) => setPrice(parseFloat(e.target.value))}
        />
      </div>
      <div className="out">
        <div className="lbl">Estimated monthly, after Stowbo fee</div>
        <div className="big">${Math.round(net).toLocaleString()}</div>
        <div className="lbl">
          ${Math.round(gross).toLocaleString()} gross · −18% fee
        </div>
      </div>
    </div>
  );
}
