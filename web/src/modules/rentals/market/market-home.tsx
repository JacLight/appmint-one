import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getMarket, clientCfg } from "./config";
import { searchMarket, toCard, type MarketEnvelope } from "./api";
import { SearchBar } from "./search-bar";
import { StayCard } from "./stay-card";
import type { MarketCard } from "./shared";
import "./market.css";

/** Marketplace home (stays / gear): search first, then rows of real listings. */
export async function MarketHome() {
  const m = await getMarket();
  if (!m) return null;
  const { cfg } = m;
  const res = await searchMarket(cfg, { sort: "recommended" }).catch(() => ({ rows: [] as MarketEnvelope[], total: 0 }));
  const all = res.rows;
  const cards = new Map(all.map((r) => [String(r.sk), toCard(cfg, r)]));
  const rows = cfg.rows
    .map((row) => {
      const items = all.filter((r) =>
        (!row.types || row.types.includes(String(r.data?.spaceType))) &&
        (!row.states || row.states.includes(String(r.data?.address?.state || "").toUpperCase())),
      ).map((r) => cards.get(String(r.sk))!);
      return { ...row, items };
    })
    .filter((r) => r.items.length > 0);

  // The hero is a real listing — the best-rated one with a photo — and links to it.
  const hero: MarketCard | undefined = [...cards.values()].find((c) => c.image);

  return (
    <>
      <SiteHeader />
      <main className="mk">
        <section className="mk-hero">
          <div className="mk-wrap">
            <div className="mk-hero-frame">
              {hero?.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="bg" src={hero.image} alt="" />
              )}
              {hero && <Link className="mk-hero-credit" href={`/listing/${hero.id}`}>{hero.title} · {hero.city}, {hero.state}</Link>}
              <div className="mk-hero-copy">
                <h1>{cfg.copy.heroTitle}</h1>
                <p>{cfg.copy.heroSub}</p>
              </div>
              <div className="mk-hero-search">
                <SearchBar cfg={clientCfg(cfg)} />
              </div>
            </div>
            <div className="mk-dests">
              {cfg.types.filter((t) => all.some((r) => r.data?.spaceType === t.id)).map((t) => (
                <Link key={t.id} className="mk-chip" href={`/browse?types=${t.id}`}>{t.plural}</Link>
              ))}
            </div>
          </div>
        </section>

        {rows.length === 0 ? (
          <section className="mk-section"><div className="mk-wrap">
            <div className="mk-empty">
              <h2>Nothing listed yet</h2>
              <p>The first {cfg.unit === "night" ? "homes" : "listings"} are on their way. Have one to share?</p>
              <Link className="mk-btn" href="/host">{cfg.copy.hostPitch}</Link>
            </div>
          </div></section>
        ) : rows.map((row) => (
          <section className="mk-section" key={row.title}>
            <div className="mk-wrap">
              <div className="mk-row-head">
                <div><h2>{row.title}</h2>{row.sub && <p>{row.sub}</p>}</div>
                <Link href={row.href}>Show all ({row.items.length})</Link>
              </div>
              <div className="mk-row">
                {row.items.map((c, i) => <StayCard key={c.id} c={c} href={`/listing/${c.id}`} priority={i < 4} />)}
              </div>
            </div>
          </section>
        ))}

        <section className="mk-section" style={{ paddingBottom: 56 }}>
          <div className="mk-wrap">
            <div className="mk-pitch" style={{ padding: "34px 0 0" }}>
              <div>
                <h2 className="mk-serif" style={{ fontSize: "clamp(30px,3.4vw,44px)", lineHeight: 1.08 }}>{cfg.copy.hostPitch}</h2>
                <p>{cfg.copy.hostPitchSub}</p>
                <Link className="mk-btn lg" href="/host">{m.setup.headerCta?.label || "Start hosting"}</Link>
              </div>
              {(() => {
                const pic = [...cards.values()].map((c) => c.images[1] || c.image).filter(Boolean)[3];
                // eslint-disable-next-line @next/next/no-img-element
                return pic ? <img src={pic} alt="" style={{ aspectRatio: "16/10" }} /> : null;
              })()}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
