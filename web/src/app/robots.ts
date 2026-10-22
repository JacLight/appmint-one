import type { MetadataRoute } from "next";
import { abs, siteUrl } from "@/lib/seo";
import { getSetup } from "@/lib/setup";

/** Crawlers get the public site; the signed-in app, provider area, auth handoffs and
 *  the API proxy are kept out of the index. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const setup = await getSetup();
  const provider = setup.provider?.home;
  const disallow = ["/account", "/account/", "/api/", "/auth/", "/login", "/signup", "/forgot-password", "/reset-password", "/host", "/host/", "/provider", "/provider/"];
  if (provider && !disallow.includes(provider)) disallow.push(provider);
  return { rules: [{ userAgent: "*", allow: "/", disallow }], sitemap: abs("/sitemap.xml"), host: siteUrl() };
}
