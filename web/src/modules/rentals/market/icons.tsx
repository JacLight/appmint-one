/** Line icons for the marketplace screens (stroke = currentColor). */
import type { ReactNode } from "react";

const S = (props: { children: ReactNode; size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={props.size ?? 24} height={props.size ?? 24} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden>
    {props.children}
  </svg>
);

export const I = {
  search: <S><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></S>,
  star: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" /></svg>,
  left: <S><path d="M15 18l-6-6 6-6" /></S>,
  right: <S><path d="M9 18l6-6-6-6" /></S>,
  down: <S><path d="M6 9l6 6 6-6" /></S>,
  close: <S><path d="M6 6l12 12M18 6L6 18" /></S>,
  pin: <S><path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></S>,
  grid: <S><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></S>,
  map: <S><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></S>,
  list: <S><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></S>,
  share: <S><path d="M12 3v13M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" /></S>,
  heart: <S><path d="M12 20s-7-4.4-9.2-9A5 5 0 0112 6a5 5 0 019.2 5c-2.2 4.6-9.2 9-9.2 9z" /></S>,
  sliders: <S><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></S>,
  bolt: <S><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></S>,
  bed: <S><path d="M3 18V7M21 18v-5a3 3 0 00-3-3H10v6" /><path d="M3 15h18" /><circle cx="6.5" cy="11.5" r="1.8" /></S>,
  door: <S><path d="M5 21V4a1 1 0 011-1h10a1 1 0 011 1v17" /><path d="M3 21h18M13.5 12h.01" /></S>,
  calendar: <S><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></S>,
  shield: <S><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></S>,
  chat: <S><path d="M4 5h16v11H8l-4 4z" /></S>,
  key: <S><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3" /></S>,
  check: <S><path d="M5 12l5 5L20 7" /></S>,
  clock: <S><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>,
  home: <S><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></S>,
  camera: <S><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></S>,
  box: <S><path d="M3 8l9-4 9 4-9 4-9-4z" /><path d="M3 8v8l9 4 9-4V8M12 12v8" /></S>,
};

const HL: Record<string, ReactNode> = {
  bath: <S><path d="M4 12h16v3a4 4 0 01-4 4H8a4 4 0 01-4-4z" /><path d="M6 12V6a2 2 0 014 0" /><path d="M7 19l-1 2M17 19l1 2" /></S>,
  beach: <S><path d="M3 20c3-2 6-2 9 0s6 2 9 0" /><path d="M12 17V8" /><path d="M5 9a7 7 0 0114 0z" /></S>,
  bike: <S><circle cx="6" cy="16" r="3.5" /><circle cx="18" cy="16" r="3.5" /><path d="M6 16l4-7h5l3 7M10 9l3 7M14 6h3" /></S>,
  car: <S><path d="M5 16l1.5-5h11L19 16" /><rect x="3" y="16" width="18" height="4" rx="1" /></S>,
  city: <S><path d="M3 21V9l5-3v15M8 21V4l7 3v14M15 21v-9l6 2v7" /><path d="M2 21h20" /></S>,
  desk: <S><rect x="3" y="4" width="18" height="12" rx="1" /><path d="M8 20h8M12 16v4" /></S>,
  fire: <S><path d="M12 21c4 0 7-2.7 7-6.5 0-4-3.5-6-4.5-10.5C12 6 11 8 11 10c-1-1-1.5-2-1.5-3.5C7 8.5 5 11.5 5 14.5 5 18.3 8 21 12 21z" /></S>,
  game: <S><rect x="2" y="7" width="20" height="11" rx="5" /><path d="M7 11v3M5.5 12.5h3M15.5 12h.01M17.5 14h.01" /></S>,
  garden: <S><path d="M12 21V11" /><path d="M12 11c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5z" /></S>,
  hottub: <S><path d="M3 13h18v3a4 4 0 01-4 4H7a4 4 0 01-4-4z" /><path d="M8 4c-1 1.5 1 2.5 0 4M12 4c-1 1.5 1 2.5 0 4M16 4c-1 1.5 1 2.5 0 4" /></S>,
  lake: <S><path d="M3 15c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M3 19c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" /><path d="M7 11l5-7 5 7" /></S>,
  pet: <S><circle cx="6" cy="10" r="1.8" /><circle cx="10" cy="6" r="1.8" /><circle cx="14" cy="6" r="1.8" /><circle cx="18" cy="10" r="1.8" /><path d="M8 17c0-3 2-5 4-5s4 2 4 5c0 2-2 3-4 3s-4-1-4-3z" /></S>,
  pin: I.pin,
  pool: <S><path d="M3 18c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" /><path d="M8 15V5a2 2 0 014 0M16 15V5a2 2 0 00-4 0M8 9h8M8 13h8" /></S>,
  porch: <S><path d="M3 10l9-6 9 6" /><path d="M5 10v10M19 10v10M9 20v-6h6v6M3 20h18" /></S>,
  ski: <S><path d="M4 20L20 8M7 21L21 11" /><circle cx="16" cy="4" r="1.6" /></S>,
  star: <S><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" /></S>,
  train: <S><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 11h14M8 21l2-4M16 21l-2-4M9 14h.01M15 14h.01" /></S>,
  view: <S><path d="M3 19l6-9 4 6 3-4 5 7z" /><circle cx="17" cy="6" r="2" /></S>,
  wine: <S><path d="M8 3h8l-1 7a3 3 0 01-6 0z" /><path d="M12 13v8M8 21h8" /></S>,
};
export function highlightIcon(key?: string): ReactNode { return HL[String(key || "")] ?? HL.star; }

/** An icon for an amenity label, matched on keywords. */
export function amenityIcon(label: string): ReactNode {
  const l = label.toLowerCase();
  const pick = (k: string) => HL[k];
  if (/hot tub|soaking/.test(l)) return pick("hottub");
  if (/pool/.test(l)) return pick("pool");
  if (/wifi/.test(l)) return <S><path d="M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0" /><circle cx="12" cy="19.5" r=".8" fill="currentColor" /></S>;
  if (/kitchen|catering/.test(l)) return <S><path d="M7 3v8M5 3v4a2 2 0 004 0V3M7 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9" /></S>;
  if (/fire|stove|fireplace/.test(l)) return pick("fire");
  if (/pet|dog/.test(l)) return pick("pet");
  if (/parking|golf cart/.test(l)) return pick("car");
  if (/washer|dryer/.test(l)) return <S><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="13" r="4.5" /><path d="M7 6h.01M10 6h.01" /></S>;
  if (/workspace|desk/.test(l)) return pick("desk");
  if (/air|a\/c/.test(l)) return <S><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" /></S>;
  if (/grill/.test(l)) return <S><path d="M4 9h16a8 8 0 01-16 0zM8 17l-2 4M16 17l2 4M9 5c-.6.8.6 1.6 0 2.4M13 5c-.6.8.6 1.6 0 2.4" /></S>;
  if (/beach/.test(l)) return pick("beach");
  if (/lake|kayak|life jacket|dry bag|pump/.test(l)) return pick("lake");
  if (/mountain|view/.test(l)) return pick("view");
  if (/bike|helmet|range/.test(l)) return pick("bike");
  if (/game/.test(l)) return pick("game");
  if (/ski/.test(l)) return pick("ski");
  if (/ev|charger|batter/.test(l)) return I.bolt;
  if (/insur|clean/.test(l)) return I.shield;
  if (/deliver|pickup|trunk|roof/.test(l)) return pick("car");
  if (/sound|projector|telescope/.test(l)) return <S><rect x="6" y="3" width="12" height="18" rx="2" /><circle cx="12" cy="14" r="3.5" /><path d="M12 7h.01" /></S>;
  if (/patio|porch|balcony|yard|garden/.test(l)) return pick("porch");
  if (/shower|bath/.test(l)) return pick("bath");
  if (/elevator|accessible/.test(l)) return <S><circle cx="12" cy="4.5" r="1.6" /><path d="M12 7v7h5l2 6M12 10h5M9 10.5a6 6 0 108.5 7.5" /></S>;
  if (/gym/.test(l)) return <S><path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" /></S>;
  return I.check;
}
