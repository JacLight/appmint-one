// @ts-nocheck — base-app compiles without strict mode; kept as-is rather than retyped.
'use client';
// from base-app/src/components/storefront/boutique/ProductCard.tsx — ported verbatim; only import paths rewired.
import MobileEventComponent from '@/modules/store/components/ui/mobile-event-component';
import { classNames, isEmpty } from '@/modules/store/lib-client/helpers';
import Link from 'next/link';
import { FC, useMemo, useState } from 'react';
import { useUIStore } from '@/modules/store/context/site-store';
import { useCartStore } from '@/modules/store/store/cart-store';
import { ShoppingBag, Check } from 'lucide-react';
import { ImageCard } from '../ImageCard';
import RatingDisplay from '@/modules/store/components/ui/rating-display';
import { getProductPrice, getProductStock, getProductImages, getProductPriceRange } from '../utils/product-helpers';
import { money } from '@/modules/store/lib/money'; // Appmint One

interface ProductProps {
  product: any;
  className?: string;
  slug?: string;
  quickView?: 'none' | 'dialog' | 'drawer-left' | 'drawer-right';
  showAddToCart?: boolean;
  showRating?: boolean;
}

const ProductCard: FC<ProductProps> = ({ product, className = '', slug = '', quickView = 'drawer-right', showAddToCart = true, showRating = true }) => {
  const placeholderImage = `/images/placeholder.svg`;
  const isMobile = false;
  const [addedToCart, setAddedToCart] = useState(false);

  // Pricing, stock and images all read through the shared helpers so a product
  // with variations shows the variant-aware numbers, not just `data.price`.
  const price = useMemo(() => getProductPrice(product), [product]);
  const stock = useMemo(() => getProductStock(product), [product]);
  const priceRange = useMemo(() => getProductPriceRange(product), [product]);
  const productImages = useMemo(() => getProductImages(product), [product]);

  const openQuickView = useUIStore((state) => state.openQuickView);
  const addItem = useCartStore((state) => state.addItem);
  const toggleCart = useCartStore((state) => state.toggleCart);

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const cartItem = {
      id: product?.sk || product?._id || product?.data?.sku,
      name: product?.data?.name || '',
      sku: product?.data?.sku || product?.sk || '',
      unitPrice: price,
      quantity: 1,
      image: images[0] || placeholderImage,
    };

    addItem(cartItem);
    setAddedToCart(true);

    // Reset the added state after 2 seconds
    setTimeout(() => setAddedToCart(false), 2000);

    // Open cart drawer
    toggleCart();
  }

  function handlePopupView(e: React.MouseEvent) {
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

  const showQuickView = quickView !== 'none';

  const images = useMemo(() => {
    const urls = productImages.map((image) => image.url).filter((url) => url !== '');
    return isEmpty(urls) ? [placeholderImage] : urls;
  }, [productImages, placeholderImage]);

  const Wrapper: any = isMobile ? MobileEventComponent : Link;
  const [rootSlug] = Array.isArray(slug) ? slug : [slug];

  // Extract product data
  const name = product?.data?.name || '';
  const description = product?.data?.description || '';
  // Compare at Price (Studio: "Original price for sale display") is the shop's own was-price.
  const originalPrice = Number((product?.data as any)?.comparePrice) || product?.data?.originalPrice || product?.data?.basePrice;
  const hasDiscount = originalPrice && originalPrice > price;
  const rating = product?.data?.rating ?? product?.ratingAverage;
  const isOutOfStock = stock !== undefined && stock <= 0;
  const isLowStock = stock !== undefined && stock > 0 && stock <= 5;

  // Get product colors/variants from attributes
  const colorAttribute = Array.isArray(product?.data?.attributes) ? product.data.attributes.find((attr: any) => attr.name?.toLowerCase() === 'color') : undefined;
  const colors = colorAttribute?.options || product?.data?.colors || [];

  // Get badges
  const badges = product?.data?.badges || [];

  // Format price display
  const formatPrice = (amount: number) => `$${amount.toFixed(2)}`;

  const href = `/${rootSlug}/${product?.data?.slug || product?.data?.sku || product?.sk || product?._id}`;
  // Appmint One: the store's card look — the photo at the store's card shape, a quiet badge,
  // a quick-add pill on hover, then name and price. Pricing, stock and add-to-cart above are base-app's.
  return (
    <div className={classNames('sf-pc group', className)} title={name}>
      <div className="sf-pc-img">
        <Wrapper href={href} className="sf-pc-imglink" aria-label={name}>
          {images.length > 1 ? (
            <ImageCard images={images} title={name} className="sf-pc-scrub" aspectClassName="sf-pc-scrub-in" />
          ) : (
            <img
              src={images[0]}
              onError={(event) => {
                if (!event.currentTarget.src.endsWith(placeholderImage)) event.currentTarget.src = placeholderImage;
              }}
              alt={name}
              loading="lazy"
            />
          )}
        </Wrapper>
        {(badges.length > 0 || isOutOfStock || isLowStock) && (
          <div className="sf-pc-badges">
            {badges.map((badge: any, index: number) => <span key={index}>{badge}</span>)}
            {(isOutOfStock || isLowStock) && <span className={isOutOfStock ? 'out' : 'low'}>{isOutOfStock ? 'Sold out' : `Only ${stock} left`}</span>}
          </div>
        )}
        <div className="sf-pc-acts">
          {/* a subscription product is bought from its own page (Subscribe), never added to a cart */}
          {showAddToCart && !(product as any)?.data?.plan && !isOutOfStock && (
            <button onClick={handleAddToCart} className={classNames('sf-pc-add', addedToCart && 'done')} aria-label={`Add ${name} to bag`}>
              {addedToCart ? <><Check className="w-4 h-4" />Added</> : <><ShoppingBag className="w-4 h-4" />Add to bag</>}
            </button>
          )}
          {showQuickView && <button onClick={handlePopupView} className="sf-pc-add ghost">Quick view</button>}
        </div>
      </div>

      <Wrapper href={href} className="sf-pc-body">
        <h3 className="sf-pc-name">{name}</h3>
        <div className="sf-pc-price">
          <span>{priceRange ? `${money(priceRange.min)} – ${money(priceRange.max)}` : money(price)}</span>
          {hasDiscount && <s>{money(originalPrice)}</s>}
        </div>
        {showRating && rating > 0 && <div className="sf-pc-rating"><RatingDisplay rating={rating} /></div>}
        {colors.length > 0 && (
          <div className="sf-pc-swatches">
            {colors.slice(0, 6).map((color: any, index: number) => {
              const colorValue = typeof color === 'string' ? color : color?.value || color?.label || color?.name;
              const colorLabel = typeof color === 'string' ? color : color?.label || color?.value || color?.name;
              return <i key={index} style={{ backgroundColor: colorValue }} aria-label={`Color ${colorLabel}`} title={colorLabel} />;
            })}
            {colors.length > 6 && <em>+{colors.length - 6}</em>}
          </div>
        )}
      </Wrapper>
    </div>
  );
};

export default ProductCard;
