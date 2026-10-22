/** Product options ⇄ the engine's line options (client-safe). The price of a selection
 *  is never worked out here — only which options were picked and whether the required
 *  ones are there. */
import type { LineOption, Product, ProductAttribute, ProductOption } from "./types";

export type Selection = Record<string, string | string[]>;

export const isText = (a: ProductAttribute) => a.type === "text" || (!a.options?.length && a.type !== "selection");
export const isMulti = (a: ProductAttribute) => a.display === "checkbox" || !!a.multiple;
export const attrTitle = (a: ProductAttribute) => a.title || a.name.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
export const required = (a: ProductAttribute) => !isText(a) && !isMulti(a) && a.required !== false;

/** "+1.5" → 1.5, "-5" → -5, "10%" → null (a percentage is the engine's to apply). */
export function optionDelta(o: ProductOption): number | null {
  const s = String(o.price ?? "").trim();
  if (!s || s.endsWith("%")) return null;
  const n = Number(s.replace(/^\+/, ""));
  return Number.isFinite(n) && n !== 0 ? n : null;
}

/** The first option of each required single-choice attribute (the default on a PDP). */
export function defaultSelection(p: Product): Selection {
  const s: Selection = {};
  for (const a of p.data.attributes || []) if (required(a) && a.options?.length) s[a.name] = a.options[0].value;
  return s;
}

export function toLineOptions(p: Product, sel: Selection): LineOption[] {
  const out: LineOption[] = [];
  for (const a of p.data.attributes || []) {
    const v = sel[a.name];
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    if (isText(a)) { const t = String(v).trim().slice(0, 300); if (t) out.push({ name: a.name, label: attrTitle(a), value: t }); continue; }
    for (const one of Array.isArray(v) ? v : [v]) {
      const o = a.options?.find((x) => x.value === one);
      if (o) out.push({ name: a.name, label: o.label, value: o.value });
    }
  }
  return out;
}

/** Why this selection can't be added, or null. */
export function selectionProblem(p: Product, sel: Selection): string | null {
  for (const a of p.data.attributes || []) {
    const v = sel[a.name];
    if (required(a) && (v == null || v === "" || !a.options?.some((o) => o.value === v))) return `Choose ${attrTitle(a).toLowerCase()}.`;
    if (isMulti(a) && Array.isArray(v) && a.maxValue && v.length > a.maxValue) return `Choose up to ${a.maxValue} for ${attrTitle(a).toLowerCase()}.`;
  }
  return null;
}

/** "Oat · Full / Queen" — what a line's options read like in the bag. */
export function optionsText(opts?: LineOption[]): string {
  return (opts || []).filter((o) => o.name !== "instructions").map((o) => o.label || o.value).join(" · ");
}
export function instructionsOf(opts?: LineOption[]): string | undefined {
  return opts?.find((o) => o.name === "instructions")?.value;
}

export const productImage = (p: Product) => p.data.images?.[0]?.url || p.data.image || "";
export const productHref = (p: Product) => `/shop/${encodeURIComponent(p.data.slug || p.data.sku)}`;
export const listPrice = (p: Product) => Number(p.data.calculatedPrice?.finalPrice ?? p.data.price ?? 0);
export const wasPrice = (p: Product) => {
  const o = Number(p.data.calculatedPrice?.originalPrice ?? 0), f = listPrice(p);
  return o > f + 0.004 ? o : null;
};
/** "From" when some option raises the price. */
export const hasPriceOptions = (p: Product) => (p.data.attributes || []).some((a) => a.options?.some((o) => (optionDelta(o) ?? 0) > 0));
