/** A course's cover: its own image when the author set one, else the title set as a
 *  typographic cover (Fraunces on a brand tone, with a field-grid motif) — the way
 *  Skillshare and Coursera covers carry the course name. The tone is picked from the
 *  title so a course keeps the same cover everywhere. */
const TONES = ["t-forest", "t-clay", "t-ink", "t-ochre", "t-moss"];

function toneOf(title: string): string {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

export function Cover({ title, src, kicker, className = "", eager = false }: { title: string; src?: string; kicker?: string; className?: string; eager?: boolean }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`lm-cover ${className}`} src={src} alt="" loading={eager ? "eager" : "lazy"} />;
  }
  return (
    <div className={`lm-cover lm-tcover ${toneOf(title)} ${className}`} aria-hidden>
      {kicker && <small>{kicker}</small>}
      <b>{title}</b>
    </div>
  );
}
