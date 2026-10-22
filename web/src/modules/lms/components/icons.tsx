/** Stroke icons for the LMS screens (24×24). */
const P: Record<string, string> = {
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3",
  check: "M5 12.5l4.2 4.2L19 7",
  lock: "M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  video: "M4 6h11v12H4zM15 10l5-3v10l-5-3",
  text: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7",
  quiz: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.6-.8 1.1v.5M12 17h.01",
  file: "M12 3v12M7 10l5 5 5-5M5 21h14",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  chev: "M6 9l6 6 6-6",
  award: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14l-1.5 7 5-3 5 3-1.5-7",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  level: "M5 20V14M12 20V9M19 20V4",
  infinity: "M7 15c-2 0-3.5-1.4-3.5-3S5 9 7 9c3.5 0 6.5 6 10 6 2 0 3.5-1.4 3.5-3S19 9 17 9c-3.5 0-6.5 6-10 6z",
  back: "M15 18l-6-6 6-6",
  next: "M9 6l6 6-6 6",
  menu: "M4 7h16M4 12h16M4 17h16",
  audio: "M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H4zM17 14h3v6h-3z",
  upload: "M12 16V4M7 9l5-5 5 5M5 20h14",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01",
  play: "M8 5.5v13l11-6.5z",
  save: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 12.5l2.4 2.4 4.6-5",
  phone: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z",
  x: "M6 6l12 12M18 6L6 18",
};
export type IconName = keyof typeof P;
export function Ic({ n, className = "lm-ic", size }: { n: IconName | string; className?: string; size?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={P[n] || P.text} />
    </svg>
  );
}
export const typeIcon = (type?: string): IconName =>
  type === "video" ? "video" : type === "audio" ? "audio" : type === "quiz" || type === "form" ? "quiz" : type === "download" || type === "pdf" ? "file" : type === "assignment" ? "upload" : type === "gallery" ? "image" : "text";
