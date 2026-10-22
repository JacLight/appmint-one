import Link from "next/link";
import { getSetup } from "@/lib/setup";
import { visibleNav } from "@/setups/modules";

function AppBadge({ href }: { href: string }) {
  return (
    <div className="badges">
      <a className="appbadge" href={href} target="_blank" rel="noopener" aria-label="Download on the App Store">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.31-1.32-3.15-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
        <span><small>Download on the</small><b>App Store</b></span>
      </a>
    </div>
  );
}

/** Footer driven by the setup: brand blurb, the setup's columns (links to modules
 *  that are off are dropped), optional app CTA, and the legal entity line. */
export async function SiteFooter() {
  const setup = await getSetup();
  const { brand, footer, legal } = setup;
  const columns = footer.columns
    .map((c) => ({ ...c, items: visibleNav(setup, c.items) }))
    .filter((c) => c.items.length > 0);
  const owner = legal.entityName || brand.name;
  const year = new Date().getFullYear();

  return (
    <footer className="foot">
      <div className="wrap">
        <div className="cols" style={{ ["--foot-cols" as string]: columns.length } as React.CSSProperties}>
          <div>
            <Link className="brand" href="/">
              {brand.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logo} alt={brand.name} />
              ) : (
                <span className="wordmark">{brand.name}<i aria-hidden /></span>
              )}
            </Link>
            <p className="mm">{footer.blurb}</p>
          </div>
          {columns.map((c) => (
            <div key={c.title}>
              <h5>{c.title}</h5>
              {c.items.map((n) => <Link key={n.href + n.label} href={n.href}>{n.label}</Link>)}
            </div>
          ))}
        </div>
        {footer.appStoreUrl && (
          <div className="appcta">
            <div>
              <b>{footer.appCta?.title || `Get the ${brand.name} app`}</b>
              <span>{footer.appCta?.body || brand.tagline}</span>
            </div>
            <AppBadge href={footer.appStoreUrl} />
          </div>
        )}
        <div className="bottom">
          <span>© {year} {owner}{legal.address ? ` · ${legal.address}` : ""}</span>
          {footer.bottomNote && <span>{footer.bottomNote}</span>}
        </div>
      </div>
    </footer>
  );
}
