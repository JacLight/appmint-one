// from base-app/src/components/storefront/utils/custom-attributes.ts — ported verbatim; only import paths rewired.
/**
 * Custom (customer-supplied) product attributes — `file` and `text`.
 *
 * A `selection` / `number` / `date` attribute is a preset choice that maps to a
 * product variation. A `file` / `text` attribute is filled in by the shopper at
 * purchase (artwork, print instructions) and never participates in variation
 * matching.
 *
 * Both kinds end up in the same place on the line item: `options[]`, shaped
 * `{ name, value?, type?, files? }`. The server prices off `options[]` and
 * copies it — plus `design` — onto the placed order line.
 */

import type { Product } from './product-helpers';

/** Upload result shape (matches the SDK FileInfoSchema). */
export interface FileInfo {
  path?: string;
  url?: string;
  contentType?: string;
  isPublic?: boolean;
  meta?: {
    width?: number;
    height?: number;
    size?: number;
    name?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

/** An `sf_attribute` record's data, as returned by `storefront/attributes/:name`. */
export interface AttributeDef {
  name: string;
  title?: string;
  type?: 'selection' | 'number' | 'date' | 'text' | 'file';
  display?: string;
  /** file: allow more than one upload */
  multiple?: boolean;
  /** file: comma-separated accept list, e.g. ".png,.jpg,.pdf". Blank = any */
  accept?: string;
  /** file: cap on uploads, only meaningful with `multiple`. Blank = unlimited */
  maxFiles?: number;
  options?: Array<{ label?: string; value?: string; param?: string; priceDelta?: number }>;
  [key: string]: any;
}

/** One entry in a cart/order line item's `options[]`. */
export interface LineItemOption {
  name: string;
  /** Preset value, free text, or a human summary for file options ("3 files"). */
  value?: string;
  /** Present for customer-supplied attributes so the server/admin can tell them apart. */
  type?: 'text' | 'file';
  /** Uploaded files — this is what survives to the order. */
  files?: FileInfo[];
}

/** A single artwork placement, snapshotted at add-to-cart time. */
export interface DesignPlacement {
  view: string;
  attribute: string;
  file: FileInfo;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fit: PreviewFit;
}

/** The composed design stored on the line item. */
export interface LineItemDesign {
  /** Flattened proof, one per view. */
  composites: FileInfo[];
  /** Exact geometry used, so fulfillment can reproduce it if the product config changes later. */
  placements: DesignPlacement[];
}

export type PreviewFit = 'contain' | 'cover' | 'fill';

export interface PreviewZone {
  attribute: string;
  label?: string;
  /** Percent of the base image (0–100). */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  fit?: PreviewFit;
}

export interface PreviewView {
  name?: string;
  /** Single mockup image, stored as an array by the schema's file control. */
  baseImage?: FileInfo[];
  zones?: PreviewZone[];
}

export interface PreviewConfig {
  enabled?: boolean;
  views?: PreviewView[];
}

/** What the shopper has filled in for the custom attributes, keyed by attribute name. */
export interface CustomAttributeValues {
  [attributeName: string]: { text?: string; files?: FileInfo[] };
}

export const isCustomAttributeType = (type?: string): type is 'text' | 'file' => type === 'text' || type === 'file';

/**
 * A product attribute is customer-supplied when its `sf_attribute` definition
 * says so. Definitions load asynchronously, so fall back to the shape we have:
 * preset attributes always carry `options[]`.
 */
export const isCustomAttribute = (attribute: { name: string; options?: any[] }, defs: Record<string, AttributeDef>): boolean => {
  const def = defs[attribute?.name];
  if (def?.type) return isCustomAttributeType(def.type);
  return false;
};

/** Attributes that map to variations — everything that isn't customer-supplied. */
export const getPresetAttributes = <T extends { name: string; options?: any[] }>(attributes: T[] | undefined, defs: Record<string, AttributeDef>): T[] =>
  (Array.isArray(attributes) ? attributes : []).filter((attribute) => !isCustomAttribute(attribute, defs));

/** Attributes the shopper fills in (file / text). */
export const getCustomAttributes = <T extends { name: string; options?: any[] }>(attributes: T[] | undefined, defs: Record<string, AttributeDef>): T[] =>
  (Array.isArray(attributes) ? attributes : []).filter((attribute) => isCustomAttribute(attribute, defs));

/** `.png,.jpg` → ['.png', '.jpg']. Blank = accept anything. */
export const parseAcceptList = (accept?: string): string[] =>
  (accept || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

/** Does the picked file match the attribute's `accept` list? Blank list = yes. */
export const isAcceptedFile = (file: File, accept?: string): boolean => {
  const accepted = parseAcceptList(accept);
  if (accepted.length === 0) return true;

  const fileName = file.name.toLowerCase();
  const mime = (file.type || '').toLowerCase();

  return accepted.some((entry) => {
    if (entry.startsWith('.')) return fileName.endsWith(entry);
    if (entry.endsWith('/*')) return mime.startsWith(entry.slice(0, -1));
    return mime === entry;
  });
};

/** How many more files this attribute will take. `Infinity` when uncapped. */
export const remainingFileSlots = (def: AttributeDef | undefined, current: number): number => {
  if (!def?.multiple) return Math.max(0, 1 - current);
  if (!def?.maxFiles) return Infinity;
  return Math.max(0, def.maxFiles - current);
};

/** Human summary stored as the file option's `value`, e.g. "3 files". */
export const describeFiles = (files: FileInfo[] = []): string => {
  if (files.length === 1) return files[0]?.meta?.name || files[0]?.path?.split('/').pop() || '1 file';
  return `${files.length} files`;
};

/**
 * Has the shopper supplied everything a required custom attribute needs?
 * Attributes are required unless explicitly marked `required: false`, matching
 * how preset attributes already behave.
 */
export const isCustomAttributeSatisfied = (
  attribute: { name: string; required?: boolean },
  def: AttributeDef | undefined,
  values: CustomAttributeValues,
): boolean => {
  if (attribute.required === false) return true;
  const value = values[attribute.name];
  if (def?.type === 'file') return !!value?.files?.length;
  if (def?.type === 'text') return !!value?.text?.trim();
  return true;
};

/**
 * Build the line item's `options[]` from preset selections plus customer input.
 * Preset entries stay `{ name, value }` so nothing changes for existing
 * products; custom entries carry `type` and (for files) the FileInfo objects.
 */
export const buildLineItemOptions = (
  presetSelections: Record<string, string>,
  customValues: CustomAttributeValues,
  defs: Record<string, AttributeDef>,
): LineItemOption[] => {
  const options: LineItemOption[] = [];

  Object.entries(presetSelections || {}).forEach(([name, value]) => {
    if (value === undefined || value === null || value === '') return;
    options.push({ name, value });
  });

  Object.entries(customValues || {}).forEach(([name, value]) => {
    const type = defs[name]?.type;
    if (type === 'file') {
      if (!value?.files?.length) return;
      options.push({ name, type: 'file', value: describeFiles(value.files), files: value.files });
      return;
    }
    if (type === 'text') {
      const text = value?.text?.trim();
      if (!text) return;
      options.push({ name, type: 'text', value: text });
    }
  });

  return options;
};

/**
 * Stable identity for a set of options, used in the cart item key.
 *
 * Without the file paths in here, two shirts with *different* artwork collapse
 * into one cart line — the key would only see `artwork:2 files` for both.
 */
export const optionsFingerprint = (options: LineItemOption[] | undefined): string => {
  if (!options?.length) return '';
  return [...options]
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .map((option) => {
      const files = option.files?.map((file) => file.path || file.url || '').join('+') || '';
      return `${option.name}:${option.value ?? ''}${files ? `#${files}` : ''}`;
    })
    .join('|');
};

/** The product's live-preview config, if the server enabled one. */
export const getPreviewConfig = (product: Product): PreviewConfig | undefined => {
  const preview = product?.data?.preview as PreviewConfig | undefined;
  if (!preview?.enabled) return undefined;
  if (!preview.views?.length) return undefined;
  return preview;
};

/** Zones only render once the shopper has uploaded art for the attribute they point at. */
export const getZoneFile = (zone: PreviewZone, values: CustomAttributeValues): FileInfo | undefined =>
  values?.[zone?.attribute]?.files?.[0];

export const getViewBaseImageUrl = (view: PreviewView | undefined): string | undefined => view?.baseImage?.[0]?.url;
