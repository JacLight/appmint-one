// @ts-nocheck — base-app compiles without strict mode; kept as-is rather than retyped.
'use client';
// from base-app/src/components/storefront/boutique/ProductListItem.tsx — ported verbatim; only import paths rewired.
import { classNames } from '@/modules/store/lib-client/helpers';
import Link from 'next/link';
import { FC, useMemo, useState } from 'react';
import { useUIStore } from '@/modules/store/context/site-store';
import { useCartStore } from '@/modules/store/store/cart-store';
import { ShoppingBag, Check, Eye, Heart } from 'lucide-react';
import RatingDisplay from '@/modules/store/components/ui/rating-display';
import { wishlistService } from '@/modules/store/services/wishlist-service';
import { getProductPrice, getProductStock, getProductImages } from '../utils/product-helpers';

interface ProductListItemProps {
  product: any;
  className?: string;
  slug?: string;
  quickView?: 'none' | 'dialog' | 'drawer-left' | 'drawer-right';
}

const ProductListItem: FC<ProductListItemProps> = ({ product, className = '', slug = '', quickView = 'drawer-right' }) => {
  const placeholderImage = `/assets/placeholder/products/product-grid.svg`;
  const [addedToCart, setAddedToCart] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);

  // Variation-aware price, stock and images — same helpers the card uses.
  const price = useMemo(() => getProductPrice(product), [product]);
  const stock = useMemo(() => getProductStock(product), [product]);
  const productImages = useMemo(() => getProductImages(product), [product]);

  const openQuickView = useUIStore((state) => state.openQuickView);
  const addItem = useCartStore((state) => state.addItem);
  const toggleCart = useCartStore((state) => state.toggleCart);

  const [rootSlug] = Array.isArray(slug) ? slug : [slug];

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const cartItem = {
      id: product?.sk || product?._id || product?.data?.sku,
      name: product?.data?.name || '',
      sku: product?.data?.sku || product?.sk || '',
      unitPrice: price,
      quantity: 1,
      image: mainImage,
    };

    addItem(cartItem);
    setAddedToCart(true);

    // Reset the added state after 2 seconds
    setTimeout(() => setAddedToCart(false), 2000);

    // Open cart drawer
    toggleCart();
  }

  function handleQuickView(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (quickView === 'none') return;

    let mode: 'modal' | 'drawer' = 'modal';
    let direction: 'dialog' | 'drawer-left' | 'drawer-right' = quickView;

    if (quickView === 'drawer-left' || quickView === 'drawer-right') {
      mode = 'drawer';
    }

    openQuickView(product, mode, direction, rootSlug);
  }

  async function handleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const wishlistSku = product?.data?.sku || product?.sk;
    if (!wishlistSku) return;
    const next = !isWishlisted;
    setIsWishlisted(next);
    try {
      if (next) {
        await wishlistService.addItem(wishlistSku, {
          name: product?.data?.name,
          price: product?.data?.price,
        });
      } else {
        await wishlistService.removeItem(wishlistSku);
      }
    } catch (err) {
      setIsWishlisted(!next);
      console.error('Wishlist toggle failed', err);
    }
  }

  const showQuickView = quickView !== 'none';

  // Extract product data
  const images = productImages.map((image) => image.url).filter((url) => url !== '');
  const mainImage = images.length > 0 ? images[0] : placeholderImage;

  const name = product?.data?.name || '';
  const description = product?.data?.description || '';
  const originalPrice = product?.data?.originalPrice || product?.data?.basePrice;
  const hasDiscount = originalPrice && originalPrice > price;
  const sku = product?.data?.sku || '';
  const rating = product?.data?.rating ?? product?.ratingAverage;
  const isOutOfStock = stock !== undefined && stock <= 0;
  const isLowStock = stock !== undefined && stock > 0 && stock <= 5;

  // Get badges
  const badges = product?.data?.badges || [];

  // Format price display
  const formatPrice = (amount: number) => `$${amount.toFixed(2)}`;

  const productUrl = `/${rootSlug}/${product?.data?.slug || product?.data?.sku || product?.sk || product?._id}`;

  return (
    <div
      className={classNames(
        'group relative bg-white flex gap-4 p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors',
        className
      )}
    >
      {/* Image */}
      <Link href={productUrl} className="flex-shrink-0 w-32 h-32 bg-gray-50 overflow-hidden">
        <img
          src={mainImage}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </Link>

      {/* Product Info */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1">
          {/* Badges */}
          {badges.length > 0 && (
            <div className="flex gap-1 mb-1">
              {badges.map((badge: any, index: number) => (
                <span
                  key={index}
                  className="inline-block bg-black text-white text-[10px] font-medium uppercase tracking-wide px-2 py-0.5"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}

          {/* Name */}
          <Link href={productUrl}>
            <h3 className="text-sm font-medium text-gray-900 hover:text-gray-700 line-clamp-1 mb-1">
              {name}
            </h3>
          </Link>

          {/* SKU */}
          {sku && (
            <p className="text-xs text-gray-400 mb-1">SKU: {sku}</p>
          )}

          {/* Rating */}
          {rating > 0 && (
            <div className="mb-1">
              <RatingDisplay rating={rating} />
            </div>
          )}

          {/* Availability */}
          {(isOutOfStock || isLowStock) && (
            <p className={classNames('text-xs mb-1 font-medium', isOutOfStock ? 'text-red-600' : 'text-amber-600')}>
              {isOutOfStock ? 'Sold out' : `Only ${stock} left`}
            </p>
          )}

          {/* Description */}
          {description && (
            <p className="text-xs text-gray-500 line-clamp-2 mb-2">
              {description}
            </p>
          )}

          {/* Price */}
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-gray-900">{formatPrice(price)}</span>
            {hasDiscount && (
              <span className="text-sm text-gray-400 line-through">{formatPrice(originalPrice)}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={classNames(
              'flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors rounded',
              isOutOfStock
                ? 'bg-gray-300 text-white cursor-not-allowed'
                : addedToCart
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
            )}
          >
            {isOutOfStock ? (
              <>Sold out</>
            ) : addedToCart ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Added
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                Add to Cart
              </>
            )}
          </button>

          <button
            onClick={handleWishlist}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            title={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            className="flex items-center justify-center px-3 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors rounded"
          >
            <Heart className={classNames('w-3.5 h-3.5', isWishlisted && 'fill-gray-900 text-gray-900')} />
          </button>

          {showQuickView && (
            <button
              onClick={handleQuickView}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors rounded"
            >
              <Eye className="w-3.5 h-3.5" />
              Quick View
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductListItem;
