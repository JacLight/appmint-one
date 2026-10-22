// from base-app/src/components/storefront/boutique/ProductActiveFilters.tsx — ported verbatim; only import paths rewired.
import { X } from 'lucide-react';

interface ProductActiveFiltersProps {
  searchKeyword: string;
  selectedCategory: string[];
  selectedBrand: string[];
  selectedRating: string[];
  priceRange: [number, number];
  selectedAttributes: Record<string, string[]>;
  categories: any[];
  brands: any[];
  minMaxPrice?: { minPrice: number; maxPrice: number };
  onRemoveSearch: () => void;
  onRemoveCategory: (category: string) => void;
  onRemoveBrand: (brand: string) => void;
  onRemoveRating: (rating: string) => void;
  onRemovePrice: () => void;
  onRemoveAttribute: (attribute: string, value: string) => void;
}

export function ProductActiveFilters({
  searchKeyword,
  selectedCategory,
  selectedBrand,
  selectedRating,
  priceRange,
  selectedAttributes,
  categories,
  brands,
  minMaxPrice,
  onRemoveSearch,
  onRemoveCategory,
  onRemoveBrand,
  onRemoveRating,
  onRemovePrice,
  onRemoveAttribute,
}: ProductActiveFiltersProps) {
  return (
    <div className="mb-6 flex flex-wrap gap-2 items-center">
      {searchKeyword && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-sm rounded-full">
          Search: {searchKeyword}
          <button onClick={onRemoveSearch} className="hover:bg-gray-200 rounded-full p-0.5">
            <X className="w-3 h-3" />
          </button>
        </span>
      )}
      {selectedCategory.map(catName => (
        <span key={`cat-${catName}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-sm rounded-full">
          {categories.find(c => c.name === catName)?.title || catName}
          <button onClick={() => onRemoveCategory(catName)} className="hover:bg-gray-200 rounded-full p-0.5">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {selectedBrand.map(brandName => (
        <span key={`brand-${brandName}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-sm rounded-full">
          {brands.find(b => b.name === brandName)?.data?.title || brandName}
          <button onClick={() => onRemoveBrand(brandName)} className="hover:bg-gray-200 rounded-full p-0.5">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {selectedRating.map(rating => (
        <span key={`rating-${rating}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-sm rounded-full">
          {rating} Stars{rating !== '5' ? ' & Up' : ''}
          <button onClick={() => onRemoveRating(rating)} className="hover:bg-gray-200 rounded-full p-0.5">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {minMaxPrice && (priceRange[0] !== minMaxPrice.minPrice || priceRange[1] !== minMaxPrice.maxPrice) && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-sm rounded-full">
          ${priceRange[0]} - ${priceRange[1]}
          <button onClick={onRemovePrice} className="hover:bg-gray-200 rounded-full p-0.5">
            <X className="w-3 h-3" />
          </button>
        </span>
      )}
      {Object.entries(selectedAttributes).map(([attr, values]) =>
        values.map(val => (
          <span key={`${attr}:${val}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-sm rounded-full">
            {val}
            <button onClick={() => onRemoveAttribute(attr, val)} className="hover:bg-gray-200 rounded-full p-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))
      )}
    </div>
  );
}
