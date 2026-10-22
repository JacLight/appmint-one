// from base-app/src/components/storefront/hooks/useProductVariation.ts — ported verbatim; only import paths rewired.
/**
 * React hooks for managing product variations, pricing, and stock
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Product,
  ProductVariation,
  ProductImage,
  getProductPrice,
  getProductStock,
  isProductOutOfStock,
  getProductImages,
  findVariationByAttributes,
  getProductPriceRange,
  getTotalProductStock,
  hasVariations,
  getAllProductImages,
} from '../utils/product-helpers';
import { getPresetAttributes, type AttributeDef } from '../utils/custom-attributes';

/**
 * Hook for managing product variations and selected attributes
 *
 * `attributeDefs` (from `useProductAttributeDefs`) lets this skip
 * customer-supplied attributes — a `file` / `text` attribute has no preset
 * options, maps to no variation, and must not block add-to-cart here. The
 * product page validates those separately.
 */
export function useProductVariation(product: Product, attributeDefs: Record<string, AttributeDef> = {}) {
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);

  // Auto-select attributes with only one option
  useEffect(() => {
    if (Array.isArray(product?.data?.attributes) && product.data.attributes.length > 0) {
      const autoSelected: Record<string, string> = {};

      product.data.attributes.forEach((attribute) => {
        if (attribute.options && attribute.options.length === 1) {
          const option = attribute.options[0];
          const value = typeof option === 'string' ? option : option.value;
          autoSelected[attribute.name] = value;
        }
      });

      if (Object.keys(autoSelected).length > 0) {
        setSelectedAttributes(prev => ({ ...prev, ...autoSelected }));
      }
    }
  }, [product?.data?.attributes]);

  // Update selected variation when attributes change
  useEffect(() => {
    if (Object.keys(selectedAttributes).length > 0) {
      const variation = findVariationByAttributes(product, selectedAttributes);
      setSelectedVariation(variation);
    } else {
      setSelectedVariation(null);
    }
  }, [product, selectedAttributes]);

  const selectAttribute = useCallback((name: string, value: string) => {
    setSelectedAttributes(prev => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const clearAttributes = useCallback(() => {
    setSelectedAttributes({});
    setSelectedVariation(null);
  }, []);

  const isAllAttributesSelected = useMemo(() => {
    if (!Array.isArray(product?.data?.attributes) || product.data.attributes.length === 0) {
      return true;
    }

    return getPresetAttributes(product.data.attributes, attributeDefs).every(attribute => {
      // Check if attribute is explicitly marked as not required
      if (attribute.required === false) {
        return true;
      }
      return !!selectedAttributes[attribute.name];
    });
  }, [product?.data?.attributes, selectedAttributes, attributeDefs]);

  return {
    selectedAttributes,
    selectedVariation,
    selectAttribute,
    clearAttributes,
    isAllAttributesSelected,
  };
}

/**
 * Hook for getting product pricing with variation support
 */
export function useProductPrice(product: Product, selectedVariation?: ProductVariation | null, selections: Record<string, string> = {}) {
  return useMemo(() => {
    const price = getProductPrice(product, selectedVariation, selections);
    const basePrice = product?.data?.basePrice;
    const discount = product?.data?.discount;
    const priceRange = getProductPriceRange(product);

    return {
      price,
      basePrice,
      discount,
      priceRange,
      hasDiscount: !!(discount && basePrice && basePrice > price),
    };
  }, [product, selectedVariation, selections]);
}

/**
 * Hook for getting product stock with variation support
 */
export function useProductStock(product: Product, selectedVariation?: ProductVariation | null) {
  return useMemo(() => {
    const stock = getProductStock(product, selectedVariation);
    const isOutOfStock = isProductOutOfStock(product, selectedVariation);
    const totalStock = getTotalProductStock(product);

    return {
      stock,
      isOutOfStock,
      totalStock,
      hasStock: stock !== undefined,
      isLowStock: stock !== undefined && stock > 0 && stock <= 5,
    };
  }, [product, selectedVariation]);
}

/**
 * Hook for getting product images with variation support
 */
export function useProductImages(product: Product, selectedVariation?: ProductVariation | null) {
  return useMemo(() => {
    const images = getProductImages(product, selectedVariation);
    const allImages = getAllProductImages(product);

    return {
      images,
      allImages,
      primaryImage: images[0]?.url || '',
      hasImages: images.length > 0,
    };
  }, [product, selectedVariation]);
}

/**
 * Comprehensive hook that combines all product variation features
 */
export function useProduct(product: Product, attributeDefs: Record<string, AttributeDef> = {}) {
  const variation = useProductVariation(product, attributeDefs);
  const pricing = useProductPrice(product, variation.selectedVariation);
  const stock = useProductStock(product, variation.selectedVariation);
  const images = useProductImages(product, variation.selectedVariation);

  return {
    ...variation,
    pricing,
    stock,
    images,
    hasVariations: hasVariations(product),
  };
}
