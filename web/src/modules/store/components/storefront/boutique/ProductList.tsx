// @ts-nocheck — base-app compiles without strict mode; kept as-is rather than retyped.
'use client';

// from base-app/src/components/storefront/boutique/ProductList.tsx — ported verbatim; only import paths rewired.
import { FC, useState } from 'react';
import { ProductGridProps } from '../types';
import { useProductFilters } from './hooks/useProductFilters';
import { ProductSearchBar, ViewMode } from './ProductSearchBar';
import { ProductActiveFilters } from './ProductActiveFilters';
import { ProductFiltersSidebar } from './ProductFiltersSidebar';
import { ProductGrid } from './ProductGrid';
import ProductCategories from './ProductCategories';
import { FilterDrawer } from './FilterDrawer';

export const ProductList: FC<ProductGridProps> = ({
  className = '',
  productDTO,
  slug,
  categories = [],
  brands = [],
  filters = [],
  minMaxPrice,
  siteOrgId,
  quickView = 'dialog',
  filterLayout = 'left',
  config,
}) => {
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const filterState = useProductFilters(
    productDTO?.data || [],
    siteOrgId!,
    minMaxPrice,
    productDTO?.hasNext || false,
    productDTO?.total || 0,
    productDTO?.pageSize,
  );

  // Simple: is it drawer mode or sidebar mode?
  const isDrawerMode = filterLayout === 'drawer-left' || filterLayout === 'drawer-right';
  const hasFilters = filterLayout && filterLayout !== 'none';

  // Filter count for badge
  const filterCount =
    Object.keys(filterState.selectedAttributes || {}).length +
    (filterState.selectedCategory?.length || 0) +
    (filterState.selectedBrand?.length || 0) +
    (filterState.selectedRating?.length || 0) +
    (filterState.priceRange ? 1 : 0);

  // Sidebar filter component (reused for left/right)
  const sidebarFilter = (
    <ProductFiltersSidebar
      filters={filters}
      categories={categories}
      brands={brands}
      minMaxPrice={minMaxPrice}
      selectedCategory={filterState.selectedCategory}
      selectedBrand={filterState.selectedBrand}
      selectedRating={filterState.selectedRating}
      priceRange={filterState.priceRange}
      selectedAttributes={filterState.selectedAttributes}
      hasActiveFilters={filterState.hasActiveFilters}
      onCategoryChange={filterState.handleCategoryChange}
      onBrandChange={filterState.handleBrandChange}
      onRatingChange={filterState.handleRatingChange}
      onPriceChange={filterState.handlePriceChange}
      onAttributeChange={filterState.handleAttributeChange}
      onResetFilters={filterState.resetFilters}
    />
  );

  return (
    <div className={`sf-plp-list ${className}`}>{/* Appmint One: store look */}
      {/* Search Bar - Filter button: hidden on md+ for sidebar modes, always visible for drawer modes */}
      <ProductSearchBar
        searchKeyword={filterState.searchKeyword}
        onSearchChange={filterState.handleSearchChange}
        sortBy={filterState.sortBy}
        sortType={filterState.sortType}
        onSortChange={filterState.handleSortChange}
        showFilterButton={!!hasFilters}
        onFilterClick={() => setFilterDrawerOpen(true)}
        filterCount={filterCount}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isDrawerMode={isDrawerMode}
      />

      <div className="sf-plp-body">
        {/* {hasFilters && <ProductCategories categories={categories} slug={slug} />} */}

        {/* Active Filters */}
        {hasFilters && filterState.hasActiveFilters && (
          <ProductActiveFilters
            searchKeyword={filterState.searchKeyword}
            selectedCategory={filterState.selectedCategory}
            selectedBrand={filterState.selectedBrand}
            selectedRating={filterState.selectedRating}
            priceRange={filterState.priceRange}
            selectedAttributes={filterState.selectedAttributes}
            categories={categories}
            brands={brands}
            minMaxPrice={minMaxPrice}
            onRemoveSearch={filterState.handleRemoveSearch}
            onRemoveCategory={filterState.handleRemoveCategory}
            onRemoveBrand={filterState.handleRemoveBrand}
            onRemoveRating={filterState.handleRemoveRating}
            onRemovePrice={filterState.handleRemovePrice}
            onRemoveAttribute={filterState.handleRemoveAttribute}
          />
        )}

        {/* Top Filter */}
        {hasFilters && filterLayout === 'top' && <div className="desktop-filter-sidebar mb-6">{sidebarFilter}</div>}

        <style>{`
          .desktop-filter-sidebar { display: none; }
          @media (min-width: 1024px) { .desktop-filter-sidebar { display: block; } }
          .mobile-filter-btn { display: flex; }
          @media (min-width: 1024px) { .mobile-filter-btn { display: none; } }
        `}</style>

        <div className={hasFilters && (filterLayout === 'left' || filterLayout === 'right') ? 'flex gap-8' : ''}>
          {/* Left Filter */}
          {hasFilters && filterLayout === 'left' && (
            <aside className="desktop-filter-sidebar w-64 flex-shrink-0 border-r border-gray-200 pr-6">
              <div className="sticky top-24">{sidebarFilter}</div>
            </aside>
          )}

          {/* Main Content */}
          <div className="flex-1">
            <ProductGrid
              products={filterState.products}
              isLoading={filterState.isLoading}
              hasNext={filterState.hasNext}
              total={filterState.total}
              slug={slug}
              page={filterState.page}
              onLoadMore={filterState.handleLoadMore}
              onResetFilters={filterState.resetFilters}
              quickView={quickView}
              viewMode={viewMode}
              inserts={config?.inserts /* Appmint One */}
              gridConfig={{
                columns: config?.columns,
                columnsSm: config?.columnsSm,
                columnsMd: config?.columnsMd,
                columnsLg: config?.columnsLg,
                columnsXl: config?.columnsXl,
                gap: config?.gap,
              }}
            />
          </div>

          {/* Right Filter */}
          {hasFilters && filterLayout === 'right' && (
            <aside className="desktop-filter-sidebar w-64 flex-shrink-0 border-l border-gray-200 pl-6">
              <div className="sticky top-24">{sidebarFilter}</div>
            </aside>
          )}
        </div>
      </div>

      {/* Filter Drawer - only when filters enabled */}
      {hasFilters && (
        <FilterDrawer
          isOpen={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
          direction={filterLayout === 'drawer-right' ? 'drawer-right' : 'drawer-left'}
          filters={filters}
          categories={categories}
          brands={brands}
          minMaxPrice={minMaxPrice}
          selectedCategory={filterState.selectedCategory}
          selectedBrand={filterState.selectedBrand}
          selectedRating={filterState.selectedRating}
          priceRange={filterState.priceRange}
          selectedAttributes={filterState.selectedAttributes}
          hasActiveFilters={filterState.hasActiveFilters}
          onCategoryChange={filterState.handleCategoryChange}
          onBrandChange={filterState.handleBrandChange}
          onRatingChange={filterState.handleRatingChange}
          onPriceChange={filterState.handlePriceChange}
          onAttributeChange={filterState.handleAttributeChange}
          onResetFilters={filterState.resetFilters}
        />
      )}
    </div>
  );
};

export default ProductList;
