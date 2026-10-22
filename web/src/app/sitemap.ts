import type { MetadataRoute } from "next";
import { abs } from "@/lib/seo";
import { getSetup } from "@/lib/setup";
import { MODULES, isOn } from "@/setups/modules";
import { stowbo } from "@/api/rentals";

/** Public pages of the active setup. Rentals adds its content pages and every active
 *  listing (pulled live); other modules add their public entry. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const setup = await getSetup();
  const now = new Date();
  const e = (path: string, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"], priority: number) =>
    ({ url: abs(path), lastModified: now, changeFrequency, priority });

  const entries: MetadataRoute.Sitemap = [e("/", "daily", 1)];
  for (const id of setup.modules) if (id !== "rentals" && MODULES[id].built) entries.push(e(MODULES[id].path, "weekly", 0.6));
  entries.push(e("/help", "monthly", 0.5), e("/terms", "yearly", 0.3), e("/privacy", "yearly", 0.3), e("/cookies", "yearly", 0.3));

  if (!isOn(setup, "rentals")) return entries;

  entries.push(
    e("/browse", "hourly", 0.9), e("/how-it-works", "monthly", 0.7), e("/trust", "monthly", 0.6),
    e("/protection", "yearly", 0.4), e("/cancellation", "yearly", 0.3), e("/prohibited", "yearly", 0.3),
  );
  try {
    const res = await stowbo.listings({ pageSize: 1000 });
    for (const sk of (res?.data ?? []).map((l) => l?.sk).filter((x): x is string => !!x)) entries.push(e(`/listing/${sk}`, "weekly", 0.8));
  } catch {
    // A backend hiccup must never 500 the sitemap — ship the static pages regardless.
  }
  return entries;
}
