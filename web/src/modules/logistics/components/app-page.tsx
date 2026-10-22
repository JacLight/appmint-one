import Link from "next/link";
import QRCode from "qrcode";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { appUrl } from "@/lib/app-url";
import { Icon } from "./shared/icons";
import { MUVMNT } from "../muvmnt-content";

export type AppService = "ride" | "send" | "drive";

/**
 * Rides, package delivery and driving are in the muvmnt app; on the web each one gets
 * a "get the app" page (what it is, the store buttons, a QR to open it on a phone,
 * and help), the way uber.com and lyft.com do it. Food ordering is the web product.
 */
export async function AppPage({ service }: { service: AppService }) {
  const setup = await getSetup();
  const brand = setup.brand.name;
  const c = MUVMNT.app[service];
  const here = `${appUrl().replace(/\/$/, "")}/${service === "send" ? "send" : service}`;
  const qr = await QRCode.toDataURL(MUVMNT.app.storeUrl.ios || MUVMNT.app.storeUrl.android || here, { margin: 1, width: 220, color: { dark: "#111111", light: "#ffffff" } });
  const P = MUVMNT.photos;
  const img = service === "ride" ? P.ride : service === "send" ? P.deliver : P.drive;

  return (
    <>
      <SiteHeader />
      <main className="mv-app">
        <section className="mv-app-hero">
          <div className="wrap mv-app-in">
            <div className="mv-app-txt">
              <p className="mv-app-kicker"><Icon name={service === "send" ? "box" : "car"} size={16} />{c.kicker}</p>
              <h1>{c.title.replace("{brand}", brand)}</h1>
              <p className="mv-app-lead">{c.lead}</p>
              <StoreButtons />
              <div className="mv-app-qr">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt={`QR code to get the ${brand} app`} width={112} height={112} />
                <span><b>Scan to get the app</b><small>Point your phone’s camera at the code.</small></span>
              </div>
            </div>
            <div className="mv-app-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={img.alt} />
            </div>
          </div>
        </section>

        <section className="mv-sec">
          <div className="wrap">
            <h2 className="mv-h2">{c.howTitle}</h2>
            <ol className="mv-app-steps">
              {c.steps.map((s, i) => (
                <li key={s.t}><span>{i + 1}</span><b>{s.t}</b><p>{s.d}</p></li>
              ))}
            </ol>
          </div>
        </section>

        {"needs" in c && c.needs && (
          <section className="mv-sec mv-app-needs">
            <div className="wrap">
              <h2 className="mv-h2">What you need to drive</h2>
              <ul>{c.needs.map((n) => <li key={n}><Icon name="check" size={18} />{n}</li>)}</ul>
            </div>
          </section>
        )}

        <section className="mv-sec">
          <div className="wrap"><div className="mv-app-help">
            <div>
              <h2 className="mv-h2">Questions?</h2>
              <p className="mv-lead">{c.help}</p>
            </div>
            <div className="mv-app-help-acts">
              <Link className="mv-btn inline" href="/help">Help centre</Link>
              <Link className="mv-btn inline ghost" href="/account/support">Contact support</Link>
              <Link className="mv-link" href="/eat">Order food on the web<Icon name="arrow" size={15} /></Link>
            </div>
          </div></div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

/** App Store / Google Play. Until the listings are live the buttons say so instead of
 *  linking anywhere. */
function StoreButtons() {
  const { ios, android } = MUVMNT.app.storeUrl;
  const apple = (
    <><svg viewBox="0 0 24 24" fill="currentColor" width={22} height={22} aria-hidden><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.31-1.32-3.15-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
      <span><small>{ios ? "Download on the" : "Coming soon to the"}</small><b>App Store</b></span></>
  );
  const play = (
    <><svg viewBox="0 0 24 24" fill="currentColor" width={20} height={20} aria-hidden><path d="M3.6 2.2 13.4 12l-9.8 9.8c-.4-.2-.6-.6-.6-1.1V3.3c0-.5.2-.9.6-1.1zM14.5 13.1l2.4 2.4-11 6.3 8.6-8.7zM17.9 9.7l2.7 1.5c.8.5.8 1.6 0 2.1l-2.7 1.5-2.6-2.6 2.6-2.5zM5.9 2.2l11 6.3-2.4 2.4-8.6-8.7z" /></svg>
      <span><small>{android ? "Get it on" : "Coming soon to"}</small><b>Google Play</b></span></>
  );
  return (
    <div className="mv-app-stores">
      {ios ? <a className="mv-store" href={ios} target="_blank" rel="noopener">{apple}</a> : <span className="mv-store off" aria-disabled="true">{apple}</span>}
      {android ? <a className="mv-store" href={android} target="_blank" rel="noopener">{play}</a> : <span className="mv-store off" aria-disabled="true">{play}</span>}
    </div>
  );
}
