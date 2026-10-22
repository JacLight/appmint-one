// from base-app/src/components/storefront/boutique/hooks/useProductFilters.ts — ported verbatim; only import paths rewired.
import { useState, useCallback, useEffect, useRef } from 'react';
import { getFilteredProducts, ProductFilterParams } from '@/modules/store/services/storefront/product-service';

interface UseProductFiltersReturn {
  products: any[];
  isLoading: boolean;
  hasNext: boolean;
  total: number;
  page: number;
  searchKeyword: string;
  selectedCategory: string[];
  selectedBrand: string[];
  selectedRating: string[];
  priceRange: [number, number];
  sortBy: string;
  sortType: 'asc' | 'desc';
  selectedAttributes: Record<string, string[]>;
  hasActiveFilters: boolean;
  handleCategoryChange: (value: string, checked?: boolean) => void;
  handleBrandChange: (value: string, checked?: boolean) => void;
  handleRatingChange: (value: string, checked?: boolean) => void;
  handlePriceChange: (value: [number, number]) => void;
  handleAttributeChange: (attribute: string, value: string, checked: boolean) => void;
  handleSearchChange: (keyword: string) => void;
  handleSortChange: (sort: string, type: 'asc' | 'desc') => void;
  handleLoadMore: () => void;
  handleRemoveSearch: () => void;
  handleRemoveCategory: (cat: string) => void;
  handleRemoveBrand: (brand: string) => void;
  handleRemoveRating: (rating: string) => void;
  handleRemovePrice: () => void;
  handleRemoveAttribute: (attr: string, val: string) => void;
  resetFilters: () => void;
}

export function useProductFilters(
  initialProducts: any[],
  siteOrgId: string,
  minMaxPrice?: { minPrice: number; maxPrice: number },
  initialHasNext?: boolean,
  initialTotal?: number,
  initialPageSize?: number,
): UseProductFiltersReturn {
  const [products, setProducts] = useState(initialProducts || []);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNext, setHasNext] = useState(initialHasNext || false);
  const [total, setTotal] = useState(initialTotal || 0);
  const [page, setPage] = useState(1);
  const pageSize = initialPageSize || 100;

  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string[]>([]);
  const [selectedRating, setSelectedRating] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([minMaxPrice?.minPrice || 0, minMaxPrice?.maxPrice || 10000]);
  const [sortBy, setSortBy] = useState('modifydate');
  const [sortType, setSortType] = useState<'asc' | 'desc'>('desc');
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string[]>>({});

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [filterVersion, setFilterVersion] = useState(0);
  const isInitialMount = useRef(true);

  const triggerFilterFetch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setFilterVersion((v) => v + 1);
    }, 300);
  }, []);

  const fetchProducts = useCallback(
    async (resetPage = false, pageOverride?: number) => {
      if (!siteOrgId) return;
      setIsLoading(true);
      try {
        const currentPage = resetPage ? 1 : (pageOverride ?? page);
        const filterParams: ProductFilterParams = {
          page: currentPage,
          pageSize: pageSize,
          sort: sortBy,
          sortType,
        };

        if (searchKeyword) filterParams.keyword = searchKeyword;
        if (selectedCategory.length > 0) filterParams.categories = selectedCategory;
        if (selectedBrand.length > 0) filterParams.brand = selectedBrand;
        if (selectedRating.length > 0) filterParams.rating = selectedRating;
        if (priceRange[0] !== minMaxPrice?.minPrice || priceRange[1] !== minMaxPrice?.maxPrice) {
          filterParams.minPrice = priceRange[0];
          filterParams.maxPrice = priceRange[1];
        }

        Object.entries(selectedAttributes).forEach(([key, values]) => {
          if (values.length > 0) filterParams[key] = values;
        });

        const result = await getFilteredProducts(siteOrgId, filterParams);
        const newProducts = result.data || [];

        if (resetPage) {
          setProducts(newProducts);
          setPage(1);
        } else {
          setProducts((prev) => [...prev, ...newProducts]);
        }

        // Use API's hasNext and total from the filtered response
        const actualHasNext = result.hasNext !== undefined ? result.hasNext : newProducts.length >= filterParams.pageSize!;
        setHasNext(actualHasNext);
        setTotal(result.total || 0);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [
      siteOrgId,
      page,
      pageSize,
      searchKeyword,
      selectedCategory,
      selectedBrand,
      selectedRating,
      priceRange,
      sortBy,
      sortType,
      selectedAttributes,
      minMaxPrice,
    ],
  );

  // Auto-fetch when filterVersion changes (triggered by filter state changes)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchProducts(true);
  }, [filterVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const resetFilters = useCallback(() => {
    setSearchKeyword('');
    setSelectedCategory([]);
    setSelectedBrand([]);
    setSelectedRating([]);
    setPriceRange([minMaxPrice?.minPrice || 0, minMaxPrice?.maxPrice || 10000]);
    setSortBy('modifydate');
    setSortType('desc');
    setSelectedAttributes({});
    setPage(1);
    setFilterVersion((v) => v + 1);
  }, [minMaxPrice]);

  const handleCategoryChange = (value: string, checked?: boolean) => {
    setSelectedCategory((prev) => {
      if (checked !== undefined) {
        return checked ? [...prev, value] : prev.filter((v) => v !== value);
      } else {
        return value ? [value] : [];
      }
    });
    triggerFilterFetch();
  };

  const handleBrandChange = (value: string, checked?: boolean) => {
    setSelectedBrand((prev) => {
      if (checked !== undefined) {
        return checked ? [...prev, value] : prev.filter((v) => v !== value);
      } else {
        return value ? [value] : [];
      }
    });
    triggerFilterFetch();
  };

  const handleRatingChange = (value: string, checked?: boolean) => {
    setSelectedRating((prev) => {
      if (checked !== undefined) {
        return checked ? [...prev, value] : prev.filter((v) => v !== value);
      } else {
        return value ? [value] : [];
      }
    });
    triggerFilterFetch();
  };

  const handlePriceChange = (value: [number, number]) => {
    setPriceRange(value);
    triggerFilterFetch();
  };

  const handleAttributeChange = (attribute: string, value: string, checked: boolean | undefined) => {
    setSelectedAttributes((prev) => {
      const current = prev[attribute] || [];

      // If checked is undefined, it's a radio/select - replace the array
      if (checked === undefined) {
        return { ...prev, [attribute]: value ? [value] : [] };
      }

      // Checkbox behavior
      if (checked) {
        // Add if not exists
        return current.includes(value) ? prev : { ...prev, [attribute]: [...current, value] };
      } else {
        // Remove from array
        return { ...prev, [attribute]: current.filter((v) => v !== value) };
      }
    });
    triggerFilterFetch();
  };

  const handleSearchChange = (keyword: string) => {
    setSearchKeyword(keyword);
    triggerFilterFetch();
  };

  const handleSortChange = (sort: string, type: 'asc' | 'desc') => {
    setSortBy(sort);
    setSortType(type);
    setFilterVersion((v) => v + 1);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchProducts(false, nextPage);
  };

  const handleRemoveSearch = () => {
    setSearchKeyword('');
    triggerFilterFetch();
  };

  const handleRemoveCategory = (cat: string) => {
    setSelectedCategory((prev) => prev.filter((c) => c !== cat));
    triggerFilterFetch();
  };

  const handleRemoveBrand = (brand: string) => {
    setSelectedBrand((prev) => prev.filter((b) => b !== brand));
    triggerFilterFetch();
  };

  const handleRemoveRating = (rating: string) => {
    setSelectedRating((prev) => prev.filter((r) => r !== rating));
    triggerFilterFetch();
  };

  const handleRemovePrice = () => {
    setPriceRange([minMaxPrice?.minPrice || 0, minMaxPrice?.maxPrice || 10000]);
    triggerFilterFetch();
  };

  const handleRemoveAttribute = (attr: string, val: string) => {
    setSelectedAttributes((prev) => ({
      ...prev,
      [attr]: prev[attr].filter((v) => v !== val),
    }));
    triggerFilterFetch();
  };

  const hasActiveFilters =
    !!searchKeyword ||
    selectedCategory.length > 0 ||
    selectedBrand.length > 0 ||
    selectedRating.length > 0 ||
    Object.values(selectedAttributes).flat().length > 0 ||
    priceRange[0] !== minMaxPrice?.minPrice ||
    priceRange[1] !== minMaxPrice?.maxPrice;

  return {
    products,
    isLoading,
    hasNext,
    total,
    page,
    searchKeyword,
    selectedCategory,
    selectedBrand,
    selectedRating,
    priceRange,
    sortBy,
    sortType,
    selectedAttributes,
    hasActiveFilters,
    handleCategoryChange,
    handleBrandChange,
    handleRatingChange,
    handlePriceChange,
    handleAttributeChange,
    handleSearchChange,
    handleSortChange,
    handleLoadMore,
    handleRemoveSearch,
    handleRemoveCategory,
    handleRemoveBrand,
    handleRemoveRating,
    handleRemovePrice,
    handleRemoveAttribute,
    resetFilters,
  };
}
