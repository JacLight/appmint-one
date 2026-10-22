import type { Metadata, Viewport } from "next";
import { SetupSwitcher } from "@/components/setup-switcher";
import "./globals.css";
import "@/styles/portal.css";
import "@/modules/logistics/logistics.css";
import "@/modules/events/events.css";
import "@/modules/lms/lms.css";
import "@/modules/money/money.css";
import "@/modules/store/store.css";
import "@/modules/scheduling/scheduling.css";
import { Providers } from "@/components/providers";
import { Analytics } from "@/components/analytics";
import { AppmintChatServer } from "@/components/appmint-chat-server";
import { abs, googleSiteVerification, siteUrl } from "@/lib/seo";
import { getSetup } from "@/lib/setup";
import { googleFontsHref, themeCss } from "@/lib/theme";
import { isOn } from "@/setups/modules";

/** Everything below reads the active setup (env PORTAL_SETUP) at request time. */
export async function generateMetadata(): Promise<Metadata> {
  const { brand, seo } = await getSetup();
  const url = siteUrl();
  const title = `${brand.name} — ${brand.tagline}`;
  const verification = googleSiteVerification();
  return {
    metadataBase: new URL(url),
    title: { default: title, template: `%s · ${brand.name}` },
    description: brand.description,
    applicationName: brand.name,
    alternates: { canonical: "/" },
    keywords: seo?.keywords,
    authors: [{ name: brand.name, url }],
    ...(brand.favicon ? { icons: { icon: brand.favicon } } : {}),
    openGraph: { type: "website", siteName: brand.name, title, description: brand.description, url, locale: "en_US" },
    twitter: { card: "summary_large_image", title, description: brand.description },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
    ...(verification ? { verification: { google: verification } } : {}),
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { brand } = await getSetup();
  return { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: brand.themeColor || brand.colors.primary };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const setup = await getSetup();
  const { brand } = setup;
  const fonts = googleFontsHref(brand);

  // Organization + WebSite — one graph, emitted once. The search action only exists
  // where there is something to search (rentals browse).
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization", "@id": abs("/#organization"), name: brand.name, url: siteUrl(),
        slogan: brand.tagline, description: brand.description,
        ...(brand.logo ? { logo: brand.logo.startsWith("http") ? brand.logo : abs(brand.logo) } : {}),
      },
      {
        "@type": "WebSite", "@id": abs("/#website"), name: brand.name, url: siteUrl(),
        publisher: { "@id": abs("/#organization") },
        ...(isOn(setup, "rentals")
          ? { potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: abs("/browse?q={search_term_string}") }, "query-input": "required name=search_term_string" } }
          : {}),
      },
    ],
  };

  return (
    <html lang="en" data-setup={setup.id}>
      <head>
        {fonts && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link rel="stylesheet" href={fonts} />
          </>
        )}
        <style id="setup-theme" dangerouslySetInnerHTML={{ __html: themeCss(brand) }} />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd).replace(/</g, "\\u003c") }} />
        <Providers>{children}</Providers>
        <Analytics />
        <AppmintChatServer />
        <SetupSwitcher />
      </body>
    </html>
  );
}
