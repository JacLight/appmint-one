import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { EatFeed } from "@/modules/store/components/eat-feed";
import { Icon } from "./components/shared/icons";
import { MUVMNT } from "./muvmnt-content";

/**
 * muvmnt on the web is food ordering, the way ubereats.com and doordash.com are: the
 * address, then the restaurants that deliver to it (the /eat feed). Rides, package
 * delivery and driving are in the app; each gets a "get the app" page.
 */
export async function MuvmntHome() {
  const setup = await getSetup();
  const brand = setup.brand.name;
  const P = MUVMNT.photos;
  const tiles = [
    { href: "/ride", title: "Ride", line: "A car at your door at a fixed price. Book in the app.", cta: "Get the app", img: P.ride },
    { href: "/send", title: "Send a package", line: "Anyone can send anything across town today. Book in the app.", cta: "Get the app", img: P.deliver },
    { href: "/drive", title: `Drive with ${brand}`, line: "Deliver food, packages and rides on your own time.", cta: "Start driving", img: P.drive },
  ];

  return (
    <>
      <SiteHeader />
      <main className="ea-feed mv-home-eat">
        <section className="mv-eat-hero">
          <div className="ea-wrap">
            <h1>Food from local kitchens, delivered.</h1>
            <p>Set your address to see who delivers to you, the delivery fee and how long it takes.</p>
          </div>
        </section>
        <EatFeed />

        <section className="mv-sec">
          <div className="wrap">
            <h2 className="mv-h2">More from {brand}</h2>
            <div className="mv-tiles">
              {tiles.map((t) => (
                <Link key={t.href} href={t.href} className="mv-tile">
                  <span className="mv-tile-img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.img.src} alt={t.img.alt} loading="lazy" />
                  </span>
                  <span className="mv-tile-body">
                    <b>{t.title}</b>
                    <span>{t.line}</span>
                    <em>{t.cta}<Icon name="arrow" size={16} /></em>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
