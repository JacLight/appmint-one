'use client';

// from base-app/src/components/storefront/boutique/ProductDetail.tsx — ported verbatim; only import paths rewired.
import { useCartStore } from '@/modules/store/store/cart-store';
import { useCustomAttributes } from '../hooks/useCustomAttributes';
import { SubscribeBox } from '../SubscribeBox';
import { GiftCardOptions, emptyGiftCardChoice, giftCardChoiceOptions, giftCardChoiceProblem, giftCardChoiceValue, type GiftCardChoice, type GiftCardProductConfig } from '../gift-card/GiftCardOptions';
import { useProductVariation, useProductPrice, useProductStock, useProductImages } from '../hooks/useProductVariation';
import { getRewardPointsPrice } from '../utils/product-helpers';
import { CustomAttributeInput } from '../CustomAttributeInput';
import { DesignPreview } from '../DesignPreview';
import { ProductAttributes } from './ProductAttributes';
import { BundleContents } from './BundleContents';
import React, { useState, useCallback, useEffect } from 'react';
import { storefrontAPI } from '@/modules/store/lib/storefront-api';
import { toast } from '@/modules/store/shims/sonner';
import Counter from '@/modules/store/components/ui/counter';
import { ButtonRating, ButtonLike, ButtonReaction, ButtonSocialShare, ProductComments, ViewTracker } from '@/modules/store/build-studio/buttons';
import { Heart, Truck, RotateCcw, Headset, Users, Award, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { wishlistService } from '@/modules/store/services/wishlist-service';
import Link from 'next/link';
import ProductCard from './ProductCard';
import { toMedia } from '@/modules/store/components/product-media'; // Appmint One
import { PdpCourse, PdpPhysical, type PdpSection, type PdpVM } from '@/modules/store/components/pdp'; // Appmint One

// Types
interface ProductImage {
  url: string;
  alt?: string;
}

interface ProductVariation {
  sku: string;
  image?: ProductImage;
  images?: ProductImage[];
  price?: number;
  stock?: number;
}

interface ProductAttribute {
  name: string;
  options: (string | { label: string; value: string; image?: string })[];
  required?: boolean;
}

interface ExtraInfo {
  id?: string;
  title?: string;
  content?: string;
}

interface ProductData {
  name: string;
  description?: string;
  image?: string | ProductImage;
  images?: (string | ProductImage)[];
  price: number;
  basePrice?: number;
  discount?: number;
  sku?: string;
  stock?: number;
  rating?: number;
  reviews?: number;
  variations?: ProductVariation[];
  attributes?: ProductAttribute[];
  communityPhotos?: string[];
  badges?: string[];
  specifications?: string[];
  shippingInfo?: string;
  returnPolicy?: string;
  extraInfo?: ExtraInfo[];
}

interface ProductPost {
  tags?: string[];
  categories?: string[];
  slug?: string;
}

interface ProductDetailProps {
  product: {
    sk?: string;
    data: ProductData;
    post?: ProductPost;
  };
  site?: any;
  config?: any;
  relatedProducts?: any[];
  slug?: string;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ product, site, config, relatedProducts = [], slug }) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [addToCartLoader, setAddToCartLoader] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('description');
  const [communityPhotoIndex, setCommunityPhotoIndex] = useState<number>(0);
  const [mainImageIndex, setMainImageIndex] = useState<number>(0);
  const [showAttributeErrors, setShowAttributeErrors] = useState<boolean>(false);
  const [isWishlisted, setIsWishlisted] = useState<boolean>(false);

  const { data, post } = product;
  // A product that sells a subscription plan: the plan's price per period and Subscribe, not Add to cart.
  const planName: string | undefined = (Array.isArray((data as any).plan) ? (data as any).plan[0] : (data as any).plan) || undefined;

  // Customer-supplied attributes (uploaded artwork, print notes) + live preview
  const {
    attributeDefs,
    defsReady,
    customValues,
    setCustomValue,
    presetAttributes,
    customAttributes,
    previewConfig,
    isCustomInputComplete,
    buildLineItemExtras,
  } = useCustomAttributes(product as any);

  // Variation selection drives price, stock and images together
  const {
    selectedAttributes: attributes,
    selectedVariation: variant,
    selectAttribute,
    isAllAttributesSelected: allVariantSelected,
  } = useProductVariation(product as any, attributeDefs);

  const { price, basePrice, discount } = useProductPrice(product as any, variant, attributes);
  // Points that buy one unit, as the store set them (the selected variation's, else the product's).
  const pointsPrice = getRewardPointsPrice(product as any, variant);

  // A gift-card product: the shopper chooses the value and who it is for, and the
  // line is priced at that value. Everything rides in `options[]` (see GiftCardOptions).
  const giftCardConfig: GiftCardProductConfig | null = (data as any).giftCard?.enabled ? (data as any).giftCard : null;
  const [giftCardChoice, setGiftCardChoice] = useState<GiftCardChoice>(() => emptyGiftCardChoice(giftCardConfig || {}, Number(data.price) || 0));
  const giftCardValue = giftCardConfig ? giftCardChoiceValue(giftCardChoice, giftCardConfig) : null;
  const giftCardProblem = giftCardConfig ? giftCardChoiceProblem(giftCardChoice, giftCardConfig) : null;
  const { stock, isOutOfStock, isLowStock } = useProductStock(product as any, variant);
  const { images: processedImages } = useProductImages(product as any, variant);

  const addItem = useCartStore((state) => state.addItem);

  const handleAddToCart = useCallback(async () => {
    if (!allVariantSelected || !isCustomInputComplete || (giftCardConfig && giftCardProblem)) {
      setShowAttributeErrors(true);
      return;
    }

    setShowAttributeErrors(false);
    setAddToCartLoader(true);

    try {
      const sku = variant?.sku || data.sku || '';

      // Preset picks + uploaded artwork/instructions both ride in `options[]`;
      // `design` carries the flattened proof when the product has a preview
      const { options: pickedOptions, design } = await buildLineItemExtras(attributes, sku);
      const options = giftCardConfig ? [...pickedOptions, ...giftCardChoiceOptions(giftCardChoice, giftCardConfig)] : pickedOptions;

      const cartProduct = {
        id: product.sk || data.sku || Math.random().toString(),
        name: data.name,
        sku,
        unitPrice: giftCardConfig && giftCardValue !== null ? giftCardValue : price,
        image: processedImages[0]?.url || '',
        description: data.description || '',
        quantity: quantity,
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
        options: options.length > 0 ? options : undefined,
        design,
      };

      addItem(cartProduct);
      // A gift card in the cart is done: the next one starts empty, so a second card can't go to the
      // first card's recipient with their note by mistake.
      if (giftCardConfig) setGiftCardChoice(emptyGiftCardChoice(giftCardConfig, Number(data.price) || 0));
    } catch (error) {
      console.error('Add to cart error:', error);
      toast.error('Could not add this item to your cart. Please try again.');
    } finally {
      setAddToCartLoader(false);
    }
  }, [allVariantSelected, isCustomInputComplete, buildLineItemExtras, product, data, variant, processedImages, quantity, attributes, addItem, price, giftCardConfig, giftCardChoice, giftCardValue, giftCardProblem]);

  const handleAttribute = useCallback(
    (name: string, option: string) => {
      selectAttribute(name, option);
      setShowAttributeErrors(false);
    },
    [selectAttribute],
  );

  const handleQuantityIncrement = useCallback(() => {
    const maxStock = stock || 999;
    setQuantity((prev) => Math.min(prev + 1, maxStock));
  }, [stock]);

  const handleQuantityDecrement = useCallback(() => {
    setQuantity((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleWishlist = useCallback(async () => {
    const sku = variant?.sku || data.sku || product.sk;
    if (!sku) return;
    const next = !isWishlisted;
    setIsWishlisted(next);
    try {
      if (next) {
        await wishlistService.addItem(sku, { name: data.name, price: data.price });
      } else {
        await wishlistService.removeItem(sku);
      }
    } catch (error) {
      setIsWishlisted(!next);
      console.error('Wishlist toggle failed', error);
    }
  }, [isWishlisted, variant, data, product.sk]);

  // What this shopper pays at this quantity — their group or contract price list, quantity
  // tiers — comes from the pricing engine that also prices the cart. Without it a signed-in
  // trade customer saw the base price here and their own price only in the cart.
  const [engineQuote, setEngineQuote] = useState<{ unitPrice: number; appliedRule?: string } | null>(null);
  // Until the first quote arrives the shopper's own price is unknown: show a placeholder rather
  // than the base price (a signed-in trade customer otherwise saw $20, then $16).
  const [quoteSettled, setQuoteSettled] = useState(false);
  useEffect(() => {
    const sku = (data as any)?.sku;
    if (giftCardConfig || variant || !sku) { setEngineQuote(null); setQuoteSettled(true); return; }
    let live = true;
    const timer = setTimeout(() => {
      storefrontAPI
        .calculatePrice(sku, quantity)
        .then((q: any) => { if (live) setEngineQuote(q && typeof q.unitPrice === 'number' ? { unitPrice: q.unitPrice, appliedRule: q.appliedRule } : null); })
        .catch(() => { if (live) setEngineQuote(null); })
        .finally(() => { if (live) setQuoteSettled(true); });
    }, 200);
    return () => { live = false; clearTimeout(timer); };
  }, [(data as any)?.sku, quantity, variant, giftCardConfig]);
  const listPrice = engineQuote && engineQuote.unitPrice < price ? engineQuote : null;

  const currentPrice = giftCardConfig && giftCardValue !== null ? giftCardValue : listPrice ? listPrice.unitPrice : price;
  // Struck-through "was" price: the shopper's list price beats the catalogue price; otherwise the
  // product's Compare at Price (Studio: "Original price for sale display"), then a stored base price.
  const comparePrice = Number((data as any).comparePrice) || 0;
  const wasPrice: number = Number(listPrice ? price : comparePrice > price ? comparePrice : basePrice) || 0;
  const communityPhotos = data.communityPhotos || [];
  const badges = data.badges || [];

  // Activity owner — ties ratings, likes, reactions and comments to this product
  const activityOwner = {
    datatype: 'sf_product',
    id: product.sk || '',
  };

  const extraInfoDisplay = config?.extraInfoDisplay || site?.data?.storefront?.extraInfoDisplay || 'tab';
  const hasExtraInfo = data.extraInfo && data.extraInfo.length > 0;

  const baseTabs = [
    { id: 'description', label: 'Description' },
    { id: 'shipping', label: 'Shipping' },
    { id: 'returns', label: 'Returns' },
  ];

  // Append extraInfo as tabs when display mode is 'tab'
  const extraInfoTabs = hasExtraInfo && extraInfoDisplay === 'tab'
    ? data.extraInfo!.map((info, index) => ({
        id: info.id || `extra-${index}`,
        label: info.title || `Info ${index + 1}`,
      }))
    : [];

  const tabs = [...baseTabs, ...extraInfoTabs];

  const storeSlug = slug || 'store';

  // Appmint One: the look is the store's own (components/pdp.tsx); everything above — price,
  // stock, variations, custom inputs, gift card, add to cart — is base-app's, unchanged.
  const sections: PdpSection[] = [
    ...(data.extraInfo || []).filter((info) => info.content).map((info, index) => ({ id: info.id || `extra-${index}`, title: info.title || `Info ${index + 1}`, html: info.content || '' })),
    { id: 'shipping', title: 'Shipping', html: data.shippingInfo || 'Delivery options and charges are shown at checkout.' },
    { id: 'returns', title: 'Returns', html: data.returnPolicy || 'Contact the store to confirm its return policy before ordering.' },
  ];
  const parcel = (data as any).parcel || {};
  const ship = (data as any).shipping || {};
  const unit = parcel.dimensionUnit === 'cm' ? ' cm' : '″';
  const facts = [
    parcel.width && parcel.length && parcel.height ? { label: 'Dimensions', value: `${parcel.width}${unit} W × ${parcel.length}${unit} D × ${parcel.height}${unit} H` } : null,
    Number(parcel.weight) > 0 ? { label: 'Weight', value: `${parcel.weight} ${parcel.weightUnit || 'lb'}` } : null,
  ].filter(Boolean) as { label: string; value: string }[];
  const delivery = ship.override === 'free' ? 'Free delivery' : ship.override === 'flat' && Number(ship.flatRate) > 0 ? `Flat-rate delivery, $${Number(ship.flatRate).toFixed(2)}` : undefined;
  const cats = (post?.categories || []).filter((c) => !/^courses?$/i.test(c));
  const isCourse = (post?.categories || []).some((c) => /^courses?$/i.test(c));
  const isDigital = isCourse || !!(data as any).download;
  const vm: PdpVM = {
    name: data.name,
    sku: variant?.sku || data.sku,
    slug: storeSlug,
    categories: cats,
    media: toMedia(processedImages, (variant as any)?.images?.length ? (variant as any).images : (data as any).images),
    description: data.description,
    price: { settled: quoteSettled, current: currentPrice ?? 0, was: wasPrice, rule: listPrice?.appliedRule, discount: data.discount, points: pointsPrice, plan: !!planName, gift: !!giftCardConfig },
    stock: { out: !!isOutOfStock, low: !!isLowStock, count: stock },
    quantity,
    inc: handleQuantityIncrement,
    dec: handleQuantityDecrement,
    maxed: quantity >= (stock || 999),
    busy: addToCartLoader,
    add: async () => {
      const before = useCartStore.getState().items.length;
      const qtyBefore = useCartStore.getState().items.reduce((n, i) => n + i.quantity, 0);
      await handleAddToCart();
      const st = useCartStore.getState();
      const added = st.items.length > before || st.items.reduce((n, i) => n + i.quantity, 0) > qtyBefore;
      if (added && !isDigital && !st.isOpen) st.toggleCart();
    },
    inCart: (sku) => useCartStore.getState().items.some((i) => i.sku === sku),
    wish: { on: isWishlisted, toggle: handleWishlist },
    slots: {
      badge: badges[0],
      gift: giftCardConfig ? <GiftCardOptions config={giftCardConfig} choice={giftCardChoice} onChange={setGiftCardChoice} showErrors={showAttributeErrors} /> : null,
      attributes: defsReady && presetAttributes.length > 0 ? (
        <div className="sf-pdp-opts">
          {presetAttributes.map((attribute: any, index: number) => (
            <ProductAttributes key={'attr' + index} attribute={attribute} def={attributeDefs[attribute.name]} active={attributes[attribute.name]} onClick={handleAttribute} showError={showAttributeErrors && attribute.required !== false} />
          ))}
        </div>
      ) : null,
      custom: defsReady && customAttributes.length > 0 ? customAttributes.map((attribute: any, index: number) => (
        <CustomAttributeInput key={'custom-attr' + index} className="mb-6" attribute={attribute} def={attributeDefs[attribute.name]} value={customValues[attribute.name]} onChange={setCustomValue} sku={variant?.sku || data.sku} showError={showAttributeErrors} />
      )) : null,
      preview: previewConfig ? <DesignPreview preview={previewConfig} values={customValues} className="mb-6" /> : null,
      bundle: <BundleContents items={(data as any).bundle} />,
      subscribe: planName ? <SubscribeBox productId={String((product as any).sk || '')} planName={planName} fallbackPrice={Number(data.price) || 0} /> : null,
      reviews: site?.data?.storefront?.showComments !== false ? <ProductComments owner={activityOwner} productId={product.sk} /> : null,
    },
    sections,
    facts: isDigital ? [] : facts,
    delivery: isDigital ? undefined : delivery,
    perks: isDigital ? [] : (config?.perks || []),
    related: relatedProducts,
  };

  return (
    <>
      <ViewTracker owner={activityOwner} />
      {isDigital ? <PdpCourse vm={vm} course={isCourse} /> : <PdpPhysical vm={vm} />}
    </>
  );
};

export default ProductDetail;
