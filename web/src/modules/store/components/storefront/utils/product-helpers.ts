// from base-app/src/components/storefront/utils/product-helpers.ts — ported verbatim; only import paths rewired.
/**
 * Product helper utilities for handling variations, pricing, stock, and images
 */

export interface ProductImage {
  url: string;
  alt?: string;
}

export interface ProductVariation {
  sku: string;
  price?: number;
  /** Points that buy ONE unit of this variation; unset = the product's. */
  rewardPointsPrice?: number;
  /** Points one unit of this variation earns; unset = the product's. */
  rewardPointsContribution?: number;
  stock?: number;
  image?: string;
  images?: ProductImage[];
  options?: Array<{
    name: string;
    label: string;
    value: string;
  }>;
}

export interface ProductData {
  name?: string;
  price?: number;
  /** Points that buy ONE unit; empty = not buyable with points. */
  rewardPointsPrice?: number;
  /** Points one unit earns (replaces the old `points`). */
  rewardPointsContribution?: number;
  cost?: number;
  stock?: number;
  basePrice?: number;
  discount?: number;
  image?: string | ProductImage;
  images?: (string | ProductImage)[];
  variations?: ProductVariation[];
  attributes?: Array<{
    name: string;
    options: any[];
    required?: boolean;
  }>;
  [key: string]: any;
}

export interface Product {
  sk?: string;
  _id?: string;
  data?: ProductData;
  [key: string]: any;
}

/**
 * Points that buy one unit — the selected variation's, else the product's.
 * Undefined when it can't be bought with points. (A store setting, read as set; not computed.)
 */
export function getRewardPointsPrice(product: Product, selectedVariation?: ProductVariation | null): number | undefined {
  const own = Number(selectedVariation?.rewardPointsPrice) || 0;
  if (own > 0) return own;
  const base = Number(product?.data?.rewardPointsPrice) || 0;
  return base > 0 ? base : undefined;
}

/**
 * Get the effective price for a product, considering variations
 * Priority: selectedVariation.price > product.data.price > 0
 */
export function getProductPrice(product: Product, selectedVariation?: ProductVariation | null, selections: Record<string, string> = {}): number {
  // 1. Check if variation has its own price
  if (selectedVariation?.price !== undefined && selectedVariation.price !== null) {
    return selectedVariation.price;
  }

  // 2. Fall back to general product price
  if (product?.data?.price !== undefined && product.data.price !== null) {
    const base = Number(product.data.price);
    const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();
    let delta = 0;
    for (const [name, value] of Object.entries(selections)) {
      const attribute = product.data.attributes?.find((entry) => norm(entry.name) === norm(name));
      const option = attribute?.options?.find((entry) =>
        norm(entry.value) === norm(value) || norm(entry.label) === norm(value));
      const raw = String(option?.price ?? '').trim();
      const amount = Number.parseFloat(raw.replace(/[^0-9.+-]/g, ''));
      if (Number.isFinite(amount)) delta += raw.endsWith('%') ? base * amount / 100 : amount;
    }
    return Math.round((base + delta) * 100) / 100;
  }

  // 3. Default to 0
  return 0;
}

/**
 * Get the effective stock for a product, considering variations
 * Priority: selectedVariation.stock > product.data.stock > undefined (infinite)
 */
export function getProductStock(product: Product, selectedVariation?: ProductVariation | null): number | undefined {
  // 1. Check if variation has its own stock
  if (selectedVariation?.stock !== undefined && selectedVariation.stock !== null) {
    return selectedVariation.stock;
  }

  // 2. Nothing picked yet on a product whose variants carry their own stock: what can be
  //    bought is the variants' total, not the parent's own number (it showed "40 available"
  //    while the variants held 25 + 0).
  if (!selectedVariation && Array.isArray(product?.data?.variations)) {
    const stocks = product.data.variations
      .map(v => v?.stock)
      .filter((s): s is number => s !== undefined && s !== null && !Number.isNaN(Number(s)))
      .map(Number);
    if (stocks.length > 0) return stocks.reduce((sum, value) => sum + value, 0);
  }

  // 3. Fall back to general product stock
  if (product?.data?.stock !== undefined && product.data.stock !== null) {
    return product.data.stock;
  }

  // 4. Return undefined (treat as infinite/not tracked)
  return undefined;
}

/**
 * Check if a product is out of stock
 */
export function isProductOutOfStock(product: Product, selectedVariation?: ProductVariation | null): boolean {
  const stock = getProductStock(product, selectedVariation);

  // If stock is undefined, treat as in stock (infinite)
  if (stock === undefined) {
    return false;
  }

  return stock <= 0;
}

/**
 * Get the effective images for a product, considering variations
 * Priority: selectedVariation.images > product.data.images > product.data.image > empty array
 */
export function getProductImages(product: Product, selectedVariation?: ProductVariation | null): ProductImage[] {
  const images: ProductImage[] = [];
  const productName = product?.data?.name || 'Product';

  // 1. Check if variation has its own images
  if (Array.isArray(selectedVariation?.images) && selectedVariation.images.length > 0) {
    return selectedVariation.images.map(img => ({
      url: img.url,
      alt: img.alt || productName,
    }));
  }

  // 2. Check if variation has a single image
  if (selectedVariation?.image) {
    images.push({
      url: selectedVariation.image,
      alt: productName,
    });
  }

  // 3. Fall back to general product images
  if (product?.data?.image) {
    if (typeof product.data.image === 'string') {
      images.push({
        url: product.data.image,
        alt: productName,
      });
    } else {
      images.push({
        url: product.data.image.url,
        alt: product.data.image.alt || productName,
      });
    }
  }

  if (Array.isArray(product?.data?.images) && product.data.images.length > 0) {
    product.data.images.forEach(img => {
      if (typeof img === 'string') {
        images.push({ url: img, alt: productName });
      } else {
        images.push({ url: img.url, alt: img.alt || productName });
      }
    });
  }

  // Remove duplicates based on URL
  return images.filter((img, index, self) =>
    index === self.findIndex(t => t.url === img.url)
  );
}

/**
 * Find a variation based on selected attributes
 */
export function findVariationByAttributes(
  product: Product,
  selectedAttributes: Record<string, string>
): ProductVariation | null {
  if (!Array.isArray(product?.data?.variations) || product.data.variations.length === 0) {
    return null;
  }

  // Find variation that matches all selected attributes
  const variation = product.data.variations.find(variant => {
    if (!variant.options || variant.options.length === 0) {
      return false;
    }

    // Check if all selected attributes match this variation's options
    return Object.entries(selectedAttributes).every(([attrName, attrValue]) => {
      return variant.options?.some(
        option =>
          option.name.toLowerCase() === attrName.toLowerCase() &&
          option.value.toLowerCase() === attrValue.toLowerCase()
      );
    });
  });

  return variation || null;
}

/**
 * Get price range for a product with variations
 * Returns { min, max } or null if no variations
 */
export function getProductPriceRange(product: Product): { min: number; max: number } | null {
  if (!Array.isArray(product?.data?.variations) || product.data.variations.length === 0) {
    return null;
  }

  const prices = product.data.variations
    .map(v => v.price)
    .filter((p): p is number => p !== undefined && p !== null);

  if (prices.length === 0) {
    return null;
  }

  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

/**
 * Get total stock across all variations
 */
export function getTotalProductStock(product: Product): number | undefined {
  if (!Array.isArray(product?.data?.variations) || product.data.variations.length === 0) {
    return getProductStock(product);
  }

  const stocks = product.data.variations
    .map(v => v.stock)
    .filter((s): s is number => s !== undefined && s !== null);

  if (stocks.length === 0) {
    return getProductStock(product);
  }

  return stocks.reduce((sum, stock) => sum + stock, 0);
}

/**
 * Check if product has variations
 */
export function hasVariations(product: Product): boolean {
  return Array.isArray(product?.data?.variations) && product.data.variations.length > 0;
}

/**
 * Get all unique images from product and all variations
 */
export function getAllProductImages(product: Product): ProductImage[] {
  const allImages: ProductImage[] = [];
  const productName = product?.data?.name || 'Product';

  // Add main product images
  const mainImages = getProductImages(product);
  allImages.push(...mainImages);

  // Add images from all variations
  if (Array.isArray(product?.data?.variations)) {
    product.data.variations.forEach(variation => {
      if (variation.images) {
        variation.images.forEach(img => {
          allImages.push({
            url: img.url,
            alt: img.alt || productName,
          });
        });
      }
      if (variation.image) {
        allImages.push({
          url: variation.image,
          alt: productName,
        });
      }
    });
  }

  // Remove duplicates based on URL
  return allImages.filter((img, index, self) =>
    index === self.findIndex(t => t.url === img.url)
  );
}
