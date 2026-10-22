import Script from "next/script";
import { gaId } from "@/lib/seo";

/**
 * Google Analytics 4 (gtag.js), only when the deployment sets PORTAL_GA_ID.
 * Loads after the page is interactive so it never blocks paint.
 */
export function Analytics() {
  const GA_ID = gaId();
  if (!GA_ID || !/^[A-Z0-9-]+$/i.test(GA_ID)) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
