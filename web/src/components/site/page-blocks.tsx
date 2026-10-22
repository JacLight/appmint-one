import Link from "next/link";
import type { Action, LegalNode, PageBlock, Rich, SectionHead, SitePage } from "@/setups/types";

/** Inline rich text: **bold** and [label](href). Internal hrefs use next/link. */
export function R({ t }: { t: Rich }) {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(t))) {
    if (m.index > last) out.push(t.slice(last, m.index));
    if (m[1]) out.push(<b key={k++}>{m[1]}</b>);
    else {
      const href = m[3];
      out.push(href.startsWith("/") ? <Link key={k++} href={href}>{m[2]}</Link> : <a key={k++} href={href}>{m[2]}</a>);
    }
    last = re.lastIndex;
  }
  if (last < t.length) out.push(t.slice(last));
  return <>{out}</>;
}

/** Stowbo's stroke icons are stored as their SVG inner markup (static setup data). */
function Ic({ svg }: { svg: string }) {
  return <div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" dangerouslySetInnerHTML={{ __html: svg }} /></div>;
}

function Head({ h }: { h?: SectionHead }) {
  if (!h) return null;
  return <div className="sec-head"><div>{h.eyebrow && <p className="eyebrow">{h.eyebrow}</p>}<h2>{h.title}</h2>{h.sub && <p><R t={h.sub} /></p>}</div></div>;
}

function Btn({ a }: { a: Action }) {
  const kind = a.kind || "clay";
  const cls = kind === "ghost-light" ? "btn ghost lg" : `btn ${kind} lg`;
  const style = kind === "ghost-light" ? { borderColor: "#fff", color: "#fff" } : undefined;
  return a.href.startsWith("/") ? <Link className={cls} href={a.href} style={style}>{a.label}</Link> : <a className={cls} href={a.href} style={style}>{a.label}</a>;
}

const sec = (flush?: boolean) => (flush ? { paddingTop: 0 } : undefined);

function Legal({ b }: { b: Extract<PageBlock, { type: "legal" }> }) {
  const node = (n: LegalNode, i: number) => {
    if ("p" in n) return <p key={i}><R t={n.p} /></p>;
    if ("ul" in n) return <ul key={i}>{n.ul.map((x, j) => <li key={j}><R t={x} /></li>)}</ul>;
    if ("h3" in n) return <h3 key={i}>{n.h3}</h3>;
    return (
      <table key={i}>
        <thead><tr>{n.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{n.table.rows.map((r, j) => <tr key={j}>{r.map((c, ci) => <td key={ci}><R t={c} /></td>)}</tr>)}</tbody>
      </table>
    );
  };
  return (
    <div className="wrap"><div className="legal">
      <aside className="toc">
        <h5>On this page</h5>
        {b.toc.map((t) => <a key={t.id} href={`#${t.id}`}>{t.label}</a>)}
      </aside>
      <article className="prose">
        {b.callout && <div className="callout"><h4>{b.callout.title}</h4><p><R t={b.callout.body} /></p></div>}
        {b.sections.map((s, i) => (
          <div key={i} style={{ display: "contents" }}>
            <h2 id={s.id}>{s.title}</h2>
            {s.body.map(node)}
          </div>
        ))}
        {b.contact && <div className="contact-block"><R t={b.contact} /></div>}
      </article>
    </div></div>
  );
}

export function Block({ b }: { b: PageBlock }) {
  switch (b.type) {
    case "pagehead":
      return (
        <section className="pagehead"><div className="wrap">
          {b.eyebrow && <p className="eyebrow">{b.eyebrow}</p>}
          <h1>{b.title}</h1>
          {b.sub && <p className="sub"><R t={b.sub} /></p>}
          {b.updated && <p className="updated">{b.updated}</p>}
        </div></section>
      );
    case "helphero":
      return (
        <section className="helphero"><div className="wrap">
          <h1>{b.title}</h1>
          <p><R t={b.sub} /></p>
          {b.searchPlaceholder && (
            <div className="helpsearch">
              <input type="search" placeholder={b.searchPlaceholder} aria-label="Search help" />
              <button type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} width={18} height={18}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg></button>
            </div>
          )}
        </div></section>
      );
    case "topics":
      return (
        <div className="wrap"><div className="topics">
          {b.items.map((t) => <div className="topic" key={t.title}><Ic svg={t.icon} /><h3>{t.title}</h3><p><R t={t.body} /></p><a href={t.href}>{t.linkLabel || "Read articles →"}</a></div>)}
        </div></div>
      );
    case "tgrid":
      return (
        <section className="sec" style={sec(b.flush)}><div className="wrap">
          <Head h={b.head} />
          <div className="tgrid" style={{ paddingTop: 0 }}>
            {b.items.map((t) => <div className="tg" key={t.title}><Ic svg={t.icon} /><h3>{t.title}</h3><p><R t={t.body} /></p></div>)}
          </div>
        </div></section>
      );
    case "band":
      return (
        <section className="sec" style={sec(b.flush)}><div className="wrap"><div className="how">
          {b.eyebrow && <p className="eyebrow">{b.eyebrow}</p>}
          <h2>{b.title}</h2>
          {(b.leads || []).map((l, i) => <p className="lead" key={i} style={i ? { marginTop: 16 } : undefined}><R t={l} /></p>)}
          {b.link && (
            <p className="lead" style={{ marginTop: 16 }}><Link href={b.link.href} style={{ color: "var(--pop)", borderBottom: "2px solid var(--pop)", paddingBottom: 2, fontFamily: "var(--font-display)", fontWeight: 600 }}>{b.link.label}</Link></p>
          )}
          {b.steps && (
            <div className="steps">
              {b.steps.map((s, i) => <div className="step" key={s.title}><div className="n">{i + 1}</div><h3>{s.title}</h3><p><R t={s.body} /></p></div>)}
            </div>
          )}
        </div></div></section>
      );
    case "hsteps":
      return (
        <section className="sec" style={sec(b.flush)}><div className="wrap">
          <Head h={b.head} />
          <div className="hsteps">
            {b.items.map((t) => (
              <div className="hstep" key={t.title}><div className="n"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" dangerouslySetInnerHTML={{ __html: t.icon }} /></div><h3>{t.title}</h3><p><R t={t.body} /></p></div>
            ))}
          </div>
        </div></section>
      );
    case "checklist":
      return (
        <section className="sec" style={sec(b.flush)}><div className="wrap">
          <Head h={b.head} />
          <div className="checklist">
            {b.columns.map((c) => <div key={c.title}><h3>{c.title}</h3><ul>{c.items.map((x, i) => <li key={i}><R t={x} /></li>)}</ul></div>)}
          </div>
        </div></section>
      );
    case "faq": {
      const body = (
        <div className="faqcol" style={b.bare ? undefined : { paddingTop: 0 }}>
          {b.groups.map((g, gi) => (
            <div key={gi} style={{ display: "contents" }}>
              {g.title && <h2 id={g.id}>{g.title}</h2>}
              {g.items.map((q) => <details className="q" key={q.q}><summary>{q.q}</summary><p><R t={q.a} /></p></details>)}
            </div>
          ))}
        </div>
      );
      return b.bare ? <div className="wrap">{body}</div> : <section className="sec" style={sec(b.flush)}><div className="wrap"><Head h={b.head} />{body}</div></section>;
    }
    case "cta":
      return (
        <section className="sec" style={sec(b.flush)}><div className="wrap"><div className="hostband plain">
          <div className="bg"><span className="ph-empty" aria-hidden="true" /></div>
          <div className="c">{b.eyebrow && <p className="eyebrow">{b.eyebrow}</p>}<h2>{b.title}</h2>{b.body && <p><R t={b.body} /></p>}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{b.actions.map((a) => <Btn key={a.label} a={a} />)}</div>
          </div>
        </div></div></section>
      );
    case "legal":
      return <Legal b={b} />;
  }
}

export function SitePageView({ page }: { page: SitePage }) {
  return (
    <>
      {page.draft && <div className="draft-strip" role="note">Draft copy — written as a starting point for this setup. Replace before launch.</div>}
      {page.blocks.map((b, i) => <Block key={i} b={b} />)}
    </>
  );
}
