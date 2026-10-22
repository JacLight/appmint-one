import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { setupSwitchAllowed } from "@/lib/setup";
import { CATEGORIES, GROUP } from "./catalog";
import { entries } from "./data";
import { Card, FONTS, TopBar } from "./parts";
import "./directory.css";

export const metadata: Metadata = { title: "Appmint One" };

/** Dev / preview only: every business app built on Appmint One, browsed like a shot gallery. */
export default async function Directory({ searchParams }: { searchParams: Promise<{ c?: string; q?: string }> }) {
  if (!setupSwitchAllowed()) notFound();
  const { c, q = "" } = await searchParams;
  const host = (await headers()).get("host") || "localhost:3710";
  const all = await entries();
  const cat = CATEGORIES.find((x) => x === c) || "All";
  const needle = q.trim().toLowerCase();
  const list = all
    .filter((e) => cat === "All" || GROUP[e.id] === cat)
    .filter((e) => !needle || [e.name, e.category, e.like, e.pitch, ...e.customer].join(" ").toLowerCase().includes(needle));
  const href = (x: string) => {
    const p = new URLSearchParams();
    if (x !== "All") p.set("c", x);
    if (needle) p.set("q", q);
    return p.size ? `/directory?${p}` : "/directory";
  };

  return (
    <div className="dx">
      <link rel="stylesheet" href={FONTS} precedence="default" />
      <TopBar q={q} c={cat === "All" ? undefined : cat} />

      <section className="dx-intro">
        <h1>Every business,<br /><span>one app.</span></h1>
        <p>Each of these is the same Appmint One app, set up for a different business on the same engine. Hover a shot for what it does, open it for every screen, or try it live.</p>
      </section>

      <nav className="dx-tabs" aria-label="Categories">
        <span className="dx-tabs-lead">{list.length} {list.length === 1 ? "app" : "apps"}</span>
        <div className="dx-tabs-list">
          {CATEGORIES.map((x) => (
            <Link key={x} href={href(x)} aria-current={x === cat ? "page" : undefined}>{x === "All" ? "Discover" : x}</Link>
          ))}
        </div>
        <span className="dx-tabs-tail">Test card 4242</span>
      </nav>

      {list.length ? (
        <ul className="dx-grid">{list.map((e) => <Card key={e.id} e={e} host={host} />)}</ul>
      ) : (
        <p className="dx-empty">No apps match “{q}”. <Link href={cat === "All" ? "/directory" : `/directory?c=${encodeURIComponent(cat)}`}>Clear search</Link></p>
      )}

      <footer className="dx-foot">
        Try any app with test card 4242 4242 4242 4242, any future date and CVC, and an @test.local email. Each app runs on its own address with its own sign-in.
      </footer>
    </div>
  );
}
