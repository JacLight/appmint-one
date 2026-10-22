// from base-app/src/components/storefront/utils/design-composer.ts — ported verbatim; only import paths rewired.
/**
 * Composites uploaded artwork onto a product's mockup views and flattens the
 * result into a proof image.
 *
 * Zone geometry is stored as PERCENT of the base image (0–100) so the same
 * numbers drive the on-screen preview at any size and the full-resolution proof
 * rendered here.
 */

import type { CustomAttributeValues, DesignPlacement, FileInfo, LineItemDesign, PreviewConfig, PreviewFit, PreviewView, PreviewZone } from './custom-attributes';
import { getViewBaseImageUrl, getZoneFile } from './custom-attributes';
import { fileDisplayUrl } from '@/modules/store/lib/storefront-upload';

/** Loaded cross-origin so the canvas stays untainted and `toBlob` works. */
const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image: ${url}`));
    image.src = url;
  });

/**
 * Where the art lands inside its zone box, honouring `fit`.
 * `fill` stretches, `contain` fits inside, `cover` fills and overflows (clipped
 * by the caller).
 */
export const fitRect = (
  artWidth: number,
  artHeight: number,
  boxWidth: number,
  boxHeight: number,
  fit: PreviewFit = 'contain',
): { width: number; height: number; offsetX: number; offsetY: number } => {
  if (fit === 'fill' || !artWidth || !artHeight) {
    return { width: boxWidth, height: boxHeight, offsetX: 0, offsetY: 0 };
  }

  const scale = fit === 'cover' ? Math.max(boxWidth / artWidth, boxHeight / artHeight) : Math.min(boxWidth / artWidth, boxHeight / artHeight);

  const width = artWidth * scale;
  const height = artHeight * scale;

  return {
    width,
    height,
    offsetX: (boxWidth - width) / 2,
    offsetY: (boxHeight - height) / 2,
  };
};

/** Snapshot of the geometry actually used, kept on the line item for fulfillment. */
export const buildPlacements = (preview: PreviewConfig, values: CustomAttributeValues): DesignPlacement[] => {
  const placements: DesignPlacement[] = [];

  (preview.views || []).forEach((view, viewIndex) => {
    (view.zones || []).forEach((zone) => {
      const file = getZoneFile(zone, values);
      if (!file) return;
      placements.push({
        view: view.name || `View ${viewIndex + 1}`,
        attribute: zone.attribute,
        file,
        x: zone.x ?? 0,
        y: zone.y ?? 0,
        width: zone.width ?? 0,
        height: zone.height ?? 0,
        rotation: zone.rotation ?? 0,
        fit: zone.fit || 'contain',
      });
    });
  });

  return placements;
};

/** Render one view (mockup + artwork) to a PNG blob at the mockup's native size. */
export const composeViewProof = async (view: PreviewView, values: CustomAttributeValues): Promise<Blob | null> => {
  const baseUrl = getViewBaseImageUrl(view);
  if (!baseUrl) return null;

  const zonesWithArt = (view.zones || []).filter((zone) => !!getZoneFile(zone, values));
  if (zonesWithArt.length === 0) return null;

  const base = await loadImage(baseUrl);
  const canvas = document.createElement('canvas');
  canvas.width = base.naturalWidth || base.width;
  canvas.height = base.naturalHeight || base.height;

  const context = canvas.getContext('2d');
  if (!context) return null;

  context.drawImage(base, 0, 0, canvas.width, canvas.height);

  for (const zone of zonesWithArt) {
    const file = getZoneFile(zone, values);
    const artUrl = fileDisplayUrl(file);
    if (!artUrl) continue;

    let art: HTMLImageElement;
    try {
      art = await loadImage(artUrl);
    } catch {
      // A non-image upload (PDF, AI) has nothing to composite - the placement
      // still records where it goes
      continue;
    }

    const boxX = ((zone.x ?? 0) / 100) * canvas.width;
    const boxY = ((zone.y ?? 0) / 100) * canvas.height;
    const boxWidth = ((zone.width ?? 0) / 100) * canvas.width;
    const boxHeight = ((zone.height ?? 0) / 100) * canvas.height;
    if (boxWidth <= 0 || boxHeight <= 0) continue;

    const placed = fitRect(art.naturalWidth, art.naturalHeight, boxWidth, boxHeight, zone.fit);

    context.save();
    // Clip to the zone so `cover` overflow doesn't bleed across the mockup
    context.beginPath();
    context.rect(boxX, boxY, boxWidth, boxHeight);
    context.clip();
    // Rotate about the zone's centre
    context.translate(boxX + boxWidth / 2, boxY + boxHeight / 2);
    context.rotate(((zone.rotation ?? 0) * Math.PI) / 180);
    context.drawImage(art, -placed.width / 2, -placed.height / 2, placed.width, placed.height);
    context.restore();
  }

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
};

export interface BuildDesignOptions {
  /** Uploads the flattened proof and returns its FileInfo. */
  uploadComposite: (blob: Blob, fileName: string) => Promise<FileInfo>;
  /** Used to name the proof files. */
  sku?: string;
}

/**
 * Build the line item's `design`: one flattened proof per view plus the
 * placement snapshot.
 *
 * Compositing is best-effort — if a mockup can't be read cross-origin, or the
 * upload fails, the placements still go on the line item so fulfillment can
 * reproduce the layout from the source art.
 */
export const buildDesign = async (
  preview: PreviewConfig | undefined,
  values: CustomAttributeValues,
  options: BuildDesignOptions,
): Promise<LineItemDesign | undefined> => {
  if (!preview?.views?.length) return undefined;

  const placements = buildPlacements(preview, values);
  if (placements.length === 0) return undefined;

  const composites: FileInfo[] = [];

  for (const [index, view] of (preview.views || []).entries()) {
    const viewName = view.name || `view-${index + 1}`;
    try {
      const blob = await composeViewProof(view, values);
      if (!blob) continue;
      const safeName = viewName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const fileName = `${options.sku ? `${options.sku}-` : ''}${safeName}-proof.png`;
      composites.push(await options.uploadComposite(blob, fileName));
    } catch (error) {
      console.error(`Could not compose design proof for view "${viewName}":`, error);
    }
  }

  return { composites, placements };
};
