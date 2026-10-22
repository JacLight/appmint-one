import Link from "next/link";
import type { HomeSection, PreviewCard, Setup } from "@/setups/types";
import { MODULES, moduleLabel } from "@/setups/modules";

function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const CHECK = "M5 12l4 4 10-10";
const ARROW = "M5 12h14M13 6l6 6-6 6";
const HIGHLIGHT_ICONS = [
  "M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z",
  "M13 2L4 14h7l-1 8 9-12h-7z",
  "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6",
];

function Preview({ cards }: { cards: PreviewCard[] }) {
  return (
    <div className="h-stage" aria-hidden>
      <div className="h-blob a" /><div className="h-blob b" />
      <div className="h-stack">
        {cards.slice(0, 3).map((c, i) => (
          <div key={i} className={`h-card n${i}`}>
            <div className="h-card-top">
              <span className="h-card-label">{c.label}</span>
              {c.badge && <span className="h-card-badge">{c.badge === "Live" && <i className="h-pulse" />}{c.badge}</span>}
            </div>
            <b className="h-card-title">{c.title}</b>
            {c.detail && <span className="h-card-detail">{c.detail}</span>}
            {typeof c.progress === "number" && (
              <span className="h-bar"><i style={{ width: `${Math.round(Math.min(1, Math.max(0, c.progress)) * 100)}%` }} /></span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ s, setup }: { s: HomeSection; setup: Setup }) {
  switch (s.type) {
    case "hero":
      return (
        <section className="h-hero"><div className="wrap h-hero-in">
          <div className="h-hero-copy">
            {s.eyebrow && <p className="eyebrow">{s.eyebrow}</p>}
            <h1>{s.title}</h1>
            <p className="h-sub">{s.subtitle}</p>
            <div className="h-ctas">
              <Link className="btn clay lg" href={s.primary.href}>{s.primary.label}</Link>
              {s.secondary && <Link className="btn ghost lg" href={s.secondary.href}>{s.secondary.label}</Link>}
            </div>
            {s.points && (
              <ul className="h-points">
                {s.points.map((p) => <li key={p}><span><Icon d={CHECK} size={14} /></span>{p}</li>)}
              </ul>
            )}
          </div>
          {s.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <div className="h-stage img"><img src={s.image} alt="" /></div>
          ) : s.preview?.length ? <Preview cards={s.preview} /> : null}
        </div></section>
      );
    case "modules": {
      const mods = setup.modules;
      return (
        <section className="sec h-mods-sec"><div className="wrap">
          <div className="sec-head"><div>{s.eyebrow && <p className="eyebrow">{s.eyebrow}</p>}<h2>{s.title}</h2>{s.subtitle && <p>{s.subtitle}</p>}</div></div>
          <div className={`h-mods c${Math.min(mods.length, 4)}`}>
            {mods.map((m) => {
              const def = MODULES[m];
              const copy = setup.moduleCopy?.[m];
              return (
                <Link key={m} href={def.path} className="h-mod">
                  <span className="h-mod-ic"><Icon d={def.icon} size={24} /></span>
                  <b>{moduleLabel(setup, m)}</b>
                  <p>{copy?.blurb || def.customer.slice(0, 2).join(" · ")}</p>
                  <span className="h-mod-go">{copy?.cta || `Explore ${moduleLabel(setup, m).toLowerCase()}`} <Icon d={ARROW} size={16} /></span>
                  {!def.built && <span className="soon-chip">Coming soon</span>}
                </Link>
              );
            })}
          </div>
        </div></section>
      );
    }
    case "steps":
      return (
        <section className="sec" style={{ paddingTop: 0 }}><div className="wrap"><div className="how h-how">
          {s.eyebrow && <p className="eyebrow">{s.eyebrow}</p>}
          <h2>{s.title}</h2>
          <div className="steps h-steps" style={{ ["--n" as string]: s.steps.length } as React.CSSProperties}>
            {s.steps.map((st, i) => (
              <div className="step" key={st.title}><div className="n">{i + 1}</div><h3>{st.title}</h3><p>{st.body}</p></div>
            ))}
          </div>
        </div></div></section>
      );
    case "highlights":
      return (
        <section className="sec" style={{ paddingTop: 0 }}><div className="wrap">
          <div className="sec-head"><div>{s.eyebrow && <p className="eyebrow">{s.eyebrow}</p>}<h2>{s.title}</h2>{s.subtitle && <p>{s.subtitle}</p>}</div></div>
          <div className="h-grid4">
            {s.items.map((it, i) => (
              <div className="tcard h-feat" key={it.title}>
                <div className="ic"><Icon d={HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length]} size={24} /></div>
                <h3>{it.title}</h3><p>{it.body}</p>
              </div>
            ))}
          </div>
        </div></section>
      );
    case "stats":
      return (
        <section className="sec" style={{ paddingTop: 0 }}><div className="wrap"><div className="stats">
          {s.items.map((it) => <div className="stat" key={it.label}><div className="big">{it.value}</div><div className="lbl">{it.label}</div></div>)}
        </div></div></section>
      );
    case "quote":
      return (
        <section className="sec" style={{ paddingTop: 0 }}><div className="wrap">
          <figure className="h-quote"><blockquote>“{s.quote}”</blockquote><figcaption><b>{s.by}</b>{s.role ? ` · ${s.role}` : ""}</figcaption></figure>
        </div></section>
      );
    case "faq":
      return (
        <section className="sec" style={{ paddingTop: 0 }}><div className="wrap">
          <div className="sec-head" style={{ justifyContent: "center", textAlign: "center" }}><div><h2>{s.title}</h2></div></div>
          <div className="faq">
            {s.items.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
          </div>
        </div></section>
      );
    case "cta":
      return (
        <section className="sec" style={{ paddingTop: 0 }}><div className="wrap"><div className="h-cta">
          <div><h2>{s.title}</h2>{s.subtitle && <p>{s.subtitle}</p>}</div>
          <div className="h-ctas">
            <Link className="btn lime lg" href={s.primary.href}>{s.primary.label}</Link>
            {s.secondary && <Link className="btn h-ghost-inv lg" href={s.secondary.href}>{s.secondary.label}</Link>}
          </div>
        </div></div></section>
      );
  }
}

/** The setup-driven home: renders the setup's sections in order. */
export function SetupHome({ setup }: { setup: Setup }) {
  return <>{setup.home.sections.map((s, i) => <Section key={i} s={s} setup={setup} />)}</>;
}
