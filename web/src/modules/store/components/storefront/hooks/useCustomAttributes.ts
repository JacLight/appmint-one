'use client';

// from base-app/src/components/storefront/hooks/useCustomAttributes.ts — ported verbatim; only import paths rewired.
/**
 * State + line-item assembly for customer-supplied product attributes
 * (uploaded artwork, print instructions) and the live design preview.
 *
 * Themes wire this in alongside `useProductVariation`: that hook owns preset
 * picks (colour, size → variation), this one owns what the shopper supplies.
 * Both end up in the same `options[]` on the line item.
 */

import { useCallback, useMemo, useState } from 'react';
import { useProductAttributeDefs } from './useProductAttributeDefs';
import { uploadDesignComposite, artworkLocation } from '@/modules/store/lib/storefront-upload';
import { buildDesign } from '../utils/design-composer';
import {
  buildLineItemOptions,
  getCustomAttributes,
  getPresetAttributes,
  getPreviewConfig,
  isCustomAttributeSatisfied,
  type CustomAttributeValues,
  type LineItemDesign,
  type LineItemOption,
} from '../utils/custom-attributes';
import type { Product } from '../utils/product-helpers';

export function useCustomAttributes(product: Product) {
  const { attributeDefs, loadingDefs, defsReady } = useProductAttributeDefs(product);
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});

  const attributes = product?.data?.attributes;

  const presetAttributes = useMemo(() => getPresetAttributes(attributes as any[], attributeDefs), [attributes, attributeDefs]);
  const customAttributes = useMemo(() => getCustomAttributes(attributes as any[], attributeDefs), [attributes, attributeDefs]);
  const previewConfig = useMemo(() => getPreviewConfig(product), [product]);

  const setCustomValue = useCallback((name: string, value: { text?: string; files?: any[] }) => {
    setCustomValues((previous) => ({ ...previous, [name]: value }));
  }, []);

  const clearCustomValues = useCallback(() => setCustomValues({}), []);

  /** Everything required has been supplied — gates add-to-cart. */
  const isCustomInputComplete = useMemo(
    () => customAttributes.every((attribute: any) => isCustomAttributeSatisfied(attribute, attributeDefs[attribute.name], customValues)),
    [customAttributes, attributeDefs, customValues],
  );

  /** Does this product need the full product page (uploads) rather than a quick add? */
  const requiresCustomInput = customAttributes.length > 0;

  /**
   * Build the `options[]` + `design` to attach to the cart line.
   *
   * Composing and uploading the design proof is async, so callers should show a
   * loading state while this resolves.
   */
  const buildLineItemExtras = useCallback(
    async (presetSelections: Record<string, string>, sku?: string): Promise<{ options: LineItemOption[]; design?: LineItemDesign }> => {
      const options = buildLineItemOptions(presetSelections, customValues, attributeDefs);

      let design: LineItemDesign | undefined;
      try {
        design = await buildDesign(previewConfig, customValues, {
          sku,
          uploadComposite: (blob, fileName) => uploadDesignComposite(blob, fileName, { location: artworkLocation(sku) }),
        });
      } catch (error) {
        // A proof we can't render or upload shouldn't block the purchase - the
        // uploaded artwork itself is already on `options[].files`
        console.error('Could not build design proof:', error);
      }

      return { options, design };
    },
    [customValues, attributeDefs, previewConfig],
  );

  return {
    attributeDefs,
    loadingDefs,
    defsReady,
    customValues,
    setCustomValue,
    clearCustomValues,
    presetAttributes,
    customAttributes,
    previewConfig,
    isCustomInputComplete,
    requiresCustomInput,
    buildLineItemExtras,
  };
}
