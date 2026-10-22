import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { setupSwitchAllowed } from "@/lib/setup";
import { GROUP } from "../catalog";
import { entries, liveUrl } from "../data";
import { Card, FONTS, Mark, Shot, TopBar, tint } from "../parts";
import { Screens } from "../screens";
import "../directory.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const e = (await entries()).find((x) => x.id === id);
  return { title: e ? `${e.name} · Appmint One` : "Appmint One" };
}

export default async function DirectoryItem({ params }: { params: Promise<{ id: string }> }) {
  if (!setupSwitchAllowed()) notFound();
  const { id } = await params;
  const all = await entries();
  const e = all.find((x) => x.id === id);
  if (!e) notFound();
  const host = (await headers()).get("host") || "localhost:3710";
  const at = all.indexOf(e);
  // Same category first, then whatever comes next in the catalog.
  const more = [...all.filter((x) => x !== e && GROUP[x.id] === GROUP[e.id]), ...[...all.slice(at + 1), ...all.slice(0, at)].filter((x) => GROUP[x.id] !== GROUP[e.id])].slice(0, 4);

  return (
    <div className="dx">
      <link rel="stylesheet" href={FONTS} precedence="default" />
      <TopBar />

      <article className="dx-page">
        <header className="dx-head">
          <h1>{e.name} — {e.category.toLowerCase()} like {e.like}</h1>
          <div className="dx-head-row">
            <div className="dx-head-who">
              <Mark e={e} size={48} />
              <div>
                <b>{e.name}</b>
                <span>{e.tagline}</span>
              </div>
            </div>
            <div className="dx-head-act">
              <a href="#screens" className="dx-btn dx-btn-ghost">{e.screens.length} screens</a>
              <a href={liveUrl(host, e.id)} target="_blank" rel="noreferrer" className="dx-btn dx-btn-dark">Try it live ↗</a>
            </div>
          </div>
        </header>

        <Shot e={e} big />

        <section className="dx-about">
          <p className="dx-pitch">{e.pitch}</p>
          {e.note && <p className="dx-note">{e.note}</p>}
          <div className="dx-cols">
            <div>
              <h2>For customers</h2>
              <ol>{e.customer.map((x) => <li key={x}>{x}</li>)}</ol>
            </div>
            {e.business && (
              <div>
                <h2>For the business</h2>
                <ol>{e.business.map((x) => <li key={x}>{x}</li>)}</ol>
              </div>
            )}
          </div>
          <div className="dx-jump">
            <h2>Open a page live</h2>
            <div>
              {e.pages.map((p) => (
                <a key={p.path} href={liveUrl(host, e.id, p.path)} target="_blank" rel="noreferrer">{p.label} ↗</a>
              ))}
            </div>
            <p>Built from {e.modules.join(", ")}</p>
          </div>
        </section>

        <section id="screens" className="dx-screens">
          <h2>Every screen</h2>
          <Screens screens={e.screens} name={e.name} style={tint(e)} />
        </section>

        <div className="dx-cta" style={tint(e)}>
          <Mark e={e} size={56} />
          <p>See {e.name} for yourself. It runs live on the same engine.</p>
          <a href={liveUrl(host, e.id)} target="_blank" rel="noreferrer" className="dx-btn dx-btn-dark">Try it live ↗</a>
        </div>
      </article>

      <section className="dx-more">
        <div className="dx-more-head">
          <h2>More apps on Appmint One</h2>
          <Link href="/directory">View all</Link>
        </div>
        <ul className="dx-grid dx-grid-4">{more.map((x) => <Card key={x.id} e={x} host={host} />)}</ul>
      </section>
    </div>
  );
}
