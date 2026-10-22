import type { Brand } from "@/setups/types";

/** The setup's brand as CSS custom properties on :root. Every colour token the UI
 *  uses is either a brand colour or derived from one with color-mix(); a setup can
 *  pin any token exactly with `extraTokens` (Stowbo pins its whole palette). */
export function themeTokens(b: Brand): Record<string, string> {
  const c = b.colors;
  const mix = (a: string, pct: number, with_: string) => `color-mix(in srgb, ${a} ${pct}%, ${with_})`;
  const base: Record<string, string> = {
    "--bg": c.bg,
    "--bg-2": mix(c.text, 6, c.bg),
    "--surface": c.surface,
    "--text": c.text,
    "--text-2": mix(c.text, 80, c.bg),
    "--muted": c.muted,
    "--faint": mix(c.muted, 55, c.bg),
    "--primary": c.primary,
    "--primary-strong": mix(c.primary, 85, "#000"),
    "--primary-soft": mix(c.primary, 14, c.surface),
    "--primary-ink": c.primaryInk,
    "--accent": c.accent,
    "--accent-strong": mix(c.accent, 75, "#000"),
    "--accent-soft": mix(c.accent, 12, c.surface),
    "--accent-bright": mix(c.accent, 82, "#fff"),
    "--accent-deep": mix(c.accent, 62, "#000"),
    "--accent-ink": c.accentInk || "#ffffff",
    "--hosting-bg": mix(c.accent, 8, c.bg),
    "--switch-border": mix(c.accent, 30, c.surface),
    "--highlight": c.accent,
    "--pop": mix(c.accent, 55, "#fff"),
    "--pop-strong": mix(c.accent, 70, "#fff"),
    "--border": c.border,
    "--border-2": mix(c.border, 50, c.surface),
    "--font-display": b.fonts.display,
    "--font-body": b.fonts.body,
    "--radius": b.radius,
    "--radius-img": `calc(${b.radius} - 4px)`,
  };
  return { ...base, ...(b.extraTokens || {}) };
}

/** Strip anything that could close the <style> element or start a new rule. */
const safe = (v: string) => v.replace(/[<>{};]/g, "");

export function themeCss(b: Brand): string {
  const body = Object.entries(themeTokens(b)).map(([k, v]) => `${k}:${safe(v)}`).join(";");
  return `:root{${body}}`;
}

export function googleFontsHref(b: Brand): string | null {
  const fams = b.fonts.google || [];
  if (!fams.length) return null;
  return `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${encodeURI(f).replace(/%2B/g, "+")}`).join("&")}&display=swap`;
}
