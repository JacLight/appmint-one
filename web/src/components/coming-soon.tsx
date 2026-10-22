import Link from "next/link";
import type { ModuleDef } from "@/setups/modules";

/** A clean "coming soon" panel for a module that isn't built yet — never a 404, never
 *  a fake screen. Lists what the module will do so the page still says something. */
export function ComingSoon({
  def, title, blurb, features, primary, secondary, compact = false,
}: {
  def: ModuleDef;
  title: string;
  blurb: string;
  features: string[];
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
  compact?: boolean;
}) {
  return (
    <div className={`soon${compact ? " compact" : ""}`}>
      <div className="soon-hd">
        <span className="soon-ic" aria-hidden>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={def.icon} /></svg>
        </span>
        <span className="soon-chip">Coming soon</span>
      </div>
      {compact ? <h2>{title}</h2> : <h1>{title}</h1>}
      <p className="soon-blurb">{blurb}</p>
      <ul className="soon-list">
        {features.map((f) => (
          <li key={f}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l4 4 10-10" /></svg>{f}</li>
        ))}
      </ul>
      {(primary || secondary) && (
        <div className="soon-ctas">
          {primary && <Link className="btn clay" href={primary.href}>{primary.label}</Link>}
          {secondary && <Link className="btn ghost" href={secondary.href}>{secondary.label}</Link>}
        </div>
      )}
    </div>
  );
}
