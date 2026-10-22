import "server-only";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SETUPS } from "@/setups";
import { LISTINGS, type Listing, type Screen } from "./catalog";

interface Captured { shots: { file: string; path: string; title: string }[]; phone: string | null }

const PUBLIC = path.join(process.cwd(), "public");

async function manifest(): Promise<Record<string, Captured>> {
  try {
    return JSON.parse(await readFile(path.join(PUBLIC, "directory/manifest.json"), "utf8"));
  } catch {
    return {};
  }
}

/** A file under public/directory/<id>/ if it was captured. */
function asset(id: string, file: string) {
  return existsSync(path.join(PUBLIC, "directory", id, file)) ? `/directory/${id}/${file}` : null;
}

export interface Entry extends Listing {
  name: string;
  tagline: string;
  modules: string[];
  /** Brand colours, for the shot backdrop and the mark. */
  brand: string;
  brandInk: string;
  cover: string | null;
  phone: string | null;
  /** Signed-out pages captured from the running app, plus the signed-in flows. */
  screens: Screen[];
  pages: { label: string; path: string }[];
}

export async function entries(): Promise<Entry[]> {
  const m = await manifest();
  return LISTINGS.flatMap((l) => {
    const s = SETUPS.find((x) => x.id === l.id);
    if (!s) return [];
    const hidden = (key: string) => (l.hide || []).includes(key);
    const cover = asset(l.id, "cover.jpg");
    const cap = m[l.id];
    const pub = (cap?.shots || []).filter((x) => x.path !== "/login" && !hidden(x.path));
    // The crisp cover replaces the old home capture when it is the home page.
    const publicScreens: Screen[] = pub.map((x) => ({
      src: x.path === "/" && cover ? cover : x.file,
      caption: x.path === "/" ? "Home" : x.title,
    }));
    const flows = l.flows.filter((x) => !hidden(path.basename(x.src, ".jpg")));
    const screens = [...publicScreens, ...flows];
    return [{
      ...l,
      name: s.brand.name,
      tagline: s.brand.tagline,
      modules: s.modules,
      brand: s.brand.colors.primary,
      brandInk: s.brand.colors.primaryInk,
      cover: cover || pub[0]?.file || l.flows[0]?.src || null,
      phone: asset(l.id, "phone.jpg") || cap?.phone || null,
      screens,
      pages: s.nav.public.filter((n) => !n.module || s.modules.includes(n.module)).map((n) => ({ label: n.label, path: n.href })),
    }];
  });
}

/** The live address of a setup on this dev server (each setup has its own host). */
export function liveUrl(host: string, id: string, p = "/") {
  const port = host.includes(":") ? host.split(":").pop() : "3710";
  return `http://${id}.localhost:${port}${p}`;
}
