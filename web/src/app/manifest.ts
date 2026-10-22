import type { MetadataRoute } from "next";
import { getSetup } from "@/lib/setup";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { brand } = await getSetup();
  return {
    name: `${brand.name} — ${brand.tagline}`,
    short_name: brand.name,
    description: brand.description,
    start_url: "/",
    display: "standalone",
    background_color: brand.colors.bg,
    theme_color: brand.themeColor || brand.colors.primary,
    icons: brand.favicon ? [{ src: brand.favicon, type: brand.favicon.endsWith(".svg") ? "image/svg+xml" : "image/png", sizes: "any" }] : [],
  };
}
