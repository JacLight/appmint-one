"use client";

import { useEffect, useState } from "react";

const WORDS = [
  "park the car",
  "drop your bags",
  "store your boxes",
  "stash your gear",
  "check your coat",
  "leave your bike",
  "keep your kit",
];

export function RotatingWord() {
  const [i, setI] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setShow(false);
      const t = setTimeout(() => {
        setI((n) => (n + 1) % WORDS.length);
        setShow(true);
      }, 240);
      return () => clearTimeout(t);
    }, 1900);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="rot" style={{ opacity: show ? 1 : 0 }}>
      {WORDS[i]}
    </span>
  );
}
