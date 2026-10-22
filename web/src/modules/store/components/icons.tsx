/** Store icons — 24×24 stroke paths. */
const P: Record<string, string> = {
  bag: "M6 7h12l1 13H5zM9 7V6a3 3 0 0 1 6 0v1",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  x: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7",
  chev: "M9 6l6 6-6 6",
  back: "M15 6l-6 6 6 6",
  down: "M6 9l6 6 6-6",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 7 19zM17.5 19a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z",
  ret: "M9 14l-5-5 5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  gift: "M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3.5-5-4-5.5-2S9 7 12 7zm0 0c1.5-3.5 5-4 5.5-2S15 7 12 7z",
  star: "M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z",
  bike: "M5.5 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18.5 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5.5 15l4-7h5l4 7M9.5 8L8 5H6M14.5 8l-3 7",
  store: "M4 10h16v10H4zM3 5h18l-1 5H4zM9 20v-5h6v5",
  card: "M3 6h18v12H3zM3 10h18",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
};

export function Icon({ name, size = 18, className, fill }: { name: keyof typeof P | string; size?: number; className?: string; fill?: boolean }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={fill ? 0 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d={P[name] || ""} />
    </svg>
  );
}

export function Stars({ value, count, small }: { value?: number; count?: number; small?: boolean }) {
  if (!value) return null;
  return (
    <span className={`sf-stars${small ? " sm" : ""}`} aria-label={`Rated ${value} out of 5${count ? ` from ${count} reviews` : ""}`}>
      <span className="sf-stars-row" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={small ? 12 : 14} fill className={i <= Math.round(value) ? "on" : ""} />)}
      </span>
      {count ? <span className="sf-stars-n">{count.toLocaleString("en-US")}</span> : null}
    </span>
  );
}
