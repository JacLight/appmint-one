// from base-app/src/components/storefront/boutique/ProductGrid.tsx — ported verbatim; only import paths rewired.
import React from 'react';
import ProductCard from './ProductCard';
import ProductListItem from './ProductListItem';
import ContentPlaceholder from '@/modules/store/components/ui/content-placeholder';
import { Search, Loader2 } from 'lucide-react';
import type { ViewMode } from './ProductSearchBar';

// Re-exported: callers historically imported ViewMode from either module.
export type { ViewMode };

interface GridConfig {
  columns?: number;
  columnsSm?: number;
  columnsMd?: number;
  columnsLg?: number;
  columnsXl?: number;
  gap?: number;
}

interface ProductGridProps {
  products: any[];
  isLoading: boolean;
  hasNext: boolean;
  total: number;
  slug: string;
  page: number;
  onLoadMore: () => void;
  onResetFilters: () => void;
  quickView?: 'none' | 'dialog' | 'drawer-left' | 'drawer-right';
  viewMode?: ViewMode;
  gridConfig?: GridConfig;
  /** Appmint One: room photos set between product rows (wide tiles), from the setup's rooms. */
  inserts?: { label: string; image: string; href: string }[];
}

// Default column configuration
const defaultGridConfig: GridConfig = {
  columns: 2,
  columnsSm: 2,
  columnsMd: 3,
  columnsLg: 4,
  columnsXl: 4,
  gap: 6,
};

export function ProductGrid({
  products,
  isLoading,
  hasNext,
  total,
  slug,
  page,
  onLoadMore,
  onResetFilters,
  quickView = 'dialog',
  viewMode = 'grid',
  gridConfig,
  inserts = [],
}: ProductGridProps) {
  // Drop undefined keys before merging — callers build `gridConfig` field by
  // field, so an unset column arrives as an explicit `undefined` that would
  // otherwise clobber the default and emit `repeat(undefined, …)`, which the
  // browser throws away (leaving a single-column grid).
  const config = { ...defaultGridConfig } as Required<GridConfig>;
  for (const [key, value] of Object.entries(gridConfig || {})) {
    if (value != null) (config as any)[key] = value;
  }
  if (isLoading && page === 1) {
    return <ContentPlaceholder limit={12} uniqueKey="boutique-product" type="product" />;
  }

  if (products.length === 0) {
    return (
      <div className="sf-plp-empty">
        <Search className="w-8 h-8" aria-hidden="true" />
        <h3>Nothing matches that yet</h3>
        <p>Try another search, or clear the filters to see everything.</p>
        <button
          onClick={onResetFilters}
          className="sf-btn ghost"
        >
          Clear all filters
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Product count */}
      <div className="sf-plp-count">
        <p>
          {total > 0 ? `${total.toLocaleString()} ${total === 1 ? 'product' : 'products'}` : `${products.length} ${products.length === 1 ? 'product' : 'products'}`}
        </p>
      </div>

      {/* Product Display - Grid or List */}
      {viewMode === 'grid' ? (
        <>
          {/* Appmint One: the store's own grid (storefront.css .sf-plp-grid) */}
          <div className="sf-plp-grid">
            {products.map((product: any, i: number) => {
              // Appmint One: after the 5th piece and then every 12, a room photo two columns wide.
              const slot = i === 5 ? 0 : i > 5 && (i - 5) % 12 === 0 ? (i - 5) / 12 : -1;
              const room = slot >= 0 ? inserts[slot] : undefined;
              return (
                <React.Fragment key={`product--key${product.sk}`}>
                  {room && (
                    <a className="sf-plp-room" href={room.href}>
                      <img src={room.image} alt="" loading="lazy" />
                      <span><b>{room.label}</b><u>Shop the room</u></span>
                    </a>
                  )}
                  <ProductCard product={product} slug={slug} quickView={quickView} />
                </React.Fragment>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex flex-col mb-12 border-t border-gray-100">
          {products.map((product: any) => (
            <ProductListItem key={`product--key${product.sk}`} product={product} slug={slug} quickView={quickView} />
          ))}
        </div>
      )}

      {/* Load More */}
      {hasNext && (
        <div className="sf-plp-more">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="sf-btn ghost lg"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading more...
              </span>
            ) : (
              'Show more'
            )}
          </button>
        </div>
      )}
    </>
  );
}
