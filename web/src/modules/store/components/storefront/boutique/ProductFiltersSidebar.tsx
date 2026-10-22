// @ts-nocheck — base-app compiles without strict mode; kept as-is rather than retyped.
// from base-app/src/components/storefront/boutique/ProductFiltersSidebar.tsx — ported verbatim; only import paths rewired.
import { RadioFilter, CheckboxFilter, RangeInputFilter, SelectFilter, RangeSliderFilter } from './filters';

interface ProductFiltersSidebarProps {
  filters: any[];
  categories: any[];
  brands: any[];
  minMaxPrice?: { minPrice: number; maxPrice: number };
  selectedCategory: string[];
  selectedBrand: string[];
  selectedRating: string[];
  priceRange: [number, number];
  selectedAttributes: Record<string, string[]>;
  hasActiveFilters: boolean;
  onCategoryChange: (value: string, checked?: boolean) => void;
  onBrandChange: (value: string, checked?: boolean) => void;
  onRatingChange: (value: string, checked?: boolean) => void;
  onPriceChange: (value: [number, number]) => void;
  onAttributeChange: (attribute: string, value: string, checked: boolean) => void;
  onResetFilters: () => void;
}

export function ProductFiltersSidebar({
  filters,
  categories,
  brands,
  minMaxPrice,
  selectedCategory,
  selectedBrand,
  selectedRating,
  priceRange,
  selectedAttributes,
  hasActiveFilters,
  onCategoryChange,
  onBrandChange,
  onRatingChange,
  onPriceChange,
  onAttributeChange,
  onResetFilters,
}: ProductFiltersSidebarProps) {
  const renderFilter = (filter: any) => {
    const key = filter.source === 'attribute' ? filter.attribute : filter.source;

    // Category filter
    if (filter.source === 'category' && categories.length > 0) {
      const options = categories.map((cat) => ({ label: cat.title || cat.name, value: cat.name }));
      const component = getFilterComponent(filter, options, selectedCategory, onCategoryChange);
      return component ? (
        <div key={key} className="border-t pt-6">
          <h3 className="font-medium text-sm mb-3">{filter.title || 'Category'}</h3>
          {component}
        </div>
      ) : null;
    }

    // Brand filter
    if (filter.source === 'brand' && brands.length > 0) {
      const options = brands.map((brand) => ({ label: brand.data?.title || brand.data?.name, value: brand.data?.name }));
      const component = getFilterComponent(filter, options, selectedBrand, onBrandChange);
      return component ? (
        <div key={key} className="border-t pt-6">
          <h3 className="font-medium text-sm mb-3">{filter.title || 'Brand'}</h3>
          {component}
        </div>
      ) : null;
    }

    // Rating filter
    if (filter.source === 'rating') {
      const options = [
        { label: '5 Stars', value: '5' },
        { label: '4 Stars & Up', value: '4' },
        { label: '3 Stars & Up', value: '3' },
        { label: '2 Stars & Up', value: '2' },
        { label: '1 Star & Up', value: '1' },
      ];
      const component = getFilterComponent(filter, options, selectedRating, onRatingChange);
      return component ? (
        <div key={key} className="border-t pt-6">
          <h3 className="font-medium text-sm mb-3">{filter.title || 'Rating'}</h3>
          {component}
        </div>
      ) : null;
    }

    // Price filter
    if (filter.source === 'price' && minMaxPrice) {
      const component = getPriceFilterComponent(filter, minMaxPrice, priceRange, onPriceChange);
      return component ? (
        <div key={key} className="border-t pt-6">
          <h3 className="font-medium text-sm mb-3">{filter.title || 'Price'}</h3>
          {component}
        </div>
      ) : null;
    }

    // Attribute filters
    if (filter.source === 'attribute' && filter.attribute && filter.options) {
      const attributeValues = selectedAttributes[filter.attribute] || [];
      const component = getAttributeFilterComponent(filter, attributeValues, onAttributeChange);
      return component ? (
        <div key={key} className="border-t pt-6">
          <h3 className="font-medium text-sm mb-3">{filter.title || filter.name}</h3>
          {component}
        </div>
      ) : null;
    }

    return null;
  };

  const getFilterComponent = (filter: any, options: any[], values: string[], onChange: any) => {
    if (filter.display === 'checkbox') {
      return (
        <CheckboxFilter
          title={filter.title || filter.name}
          options={options}
          values={values}
          onChange={(value, checked) => onChange(value, checked)}
        />
      );
    } else if (filter.display === 'radio') {
      return (
        <RadioFilter title={filter.title || filter.name} options={options} value={values[0] || ''} onChange={(value) => onChange(value, undefined)} />
      );
    } else if (filter.display === 'select') {
      return (
        <SelectFilter
          title={filter.title || filter.name}
          options={[{ label: 'All', value: '' }, ...options]}
          value={values[0] || ''}
          onChange={(value) => onChange(value, false)}
        />
      );
    }
    return null;
  };

  const getPriceFilterComponent = (
    filter: any,
    minMaxPrice: { minPrice: number; maxPrice: number },
    priceRange: [number, number],
    onPriceChange: (value: [number, number]) => void,
  ) => {
    if (filter.display === 'range-input') {
      return (
        <RangeInputFilter
          title={filter.title || 'Price'}
          min={minMaxPrice.minPrice}
          max={minMaxPrice.maxPrice}
          value={priceRange}
          onChange={onPriceChange}
        />
      );
    } else if (filter.display === 'range-slider') {
      return (
        <RangeSliderFilter
          title={filter.title || 'Price'}
          min={minMaxPrice.minPrice}
          max={minMaxPrice.maxPrice}
          value={priceRange}
          onChange={onPriceChange}
        />
      );
    }
    return null;
  };

  const getAttributeFilterComponent = (
    filter: any,
    attributeValues: string[],
    onAttributeChange: (attribute: string, value: string, checked: boolean | undefined) => void,
  ) => {
    if (filter.display === 'radio') {
      return (
        <RadioFilter
          title={filter.title || filter.name}
          options={filter.options}
          value={attributeValues[0] || ''}
          onChange={(value) => onAttributeChange(filter.attribute, value, undefined)}
        />
      );
    } else if (filter.display === 'select') {
      return (
        <SelectFilter
          title={filter.title || filter.name}
          options={[{ label: 'All', value: '' }, ...filter.options]}
          value={attributeValues[0] || ''}
          onChange={(value) => onAttributeChange(filter.attribute, value, undefined)}
        />
      );
    }
    return (
      <CheckboxFilter
        title={filter.title || filter.name}
        options={filter.options}
        values={attributeValues}
        onChange={(value, checked) => onAttributeChange(filter.attribute, value, checked)}
        attribute={filter.display === 'color' ? filter.attribute : undefined}
      />
    );
  };

  // Check if there's anything to display
  const hasFiltersToShow = filters.length > 0 || categories.length > 0 || brands.length > 0 || minMaxPrice;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Filters</h2>
        {hasActiveFilters && (
          <button onClick={onResetFilters} className="text-xs text-gray-500 hover:text-gray-900">
            Clear all
          </button>
        )}
      </div>

      {!hasFiltersToShow ? (
        <p className="text-sm text-gray-500">No filter options available</p>
      ) : (
        <>
          {/* Render configured filters */}
          {filters.map((filter) => renderFilter(filter))}

          {/* Always show categories if available and not in filters */}
          {categories.length > 0 && !filters.some(f => f.source === 'category') && (
            <div className="border-t pt-6">
              <h3 className="font-medium text-sm mb-3">Categories</h3>
              <CheckboxFilter
                title="Categories"
                options={categories.map((cat) => ({ label: cat.title || cat.name, value: cat.name }))}
                values={selectedCategory}
                onChange={(value, checked) => onCategoryChange(value, checked)}
              />
            </div>
          )}

          {/* Always show brands if available and not in filters */}
          {brands.length > 0 && !filters.some(f => f.source === 'brand') && (
            <div className="border-t pt-6">
              <h3 className="font-medium text-sm mb-3">Brands</h3>
              <CheckboxFilter
                title="Brands"
                options={brands.map((brand) => ({ label: brand.data?.title || brand.data?.name, value: brand.data?.name }))}
                values={selectedBrand}
                onChange={(value, checked) => onBrandChange(value, checked)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
