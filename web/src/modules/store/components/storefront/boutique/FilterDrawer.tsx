'use client';

// from base-app/src/components/storefront/boutique/FilterDrawer.tsx — ported verbatim; only import paths rewired.
import React, { useEffect } from 'react';
import { IconRenderer } from '@/modules/store/components/ui/icon-renderer';
import { classNames } from '@/modules/store/lib-client/helpers';
import { ProductFiltersSidebar } from './ProductFiltersSidebar';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  direction?: 'drawer-left' | 'drawer-right';
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

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  direction = 'drawer-left',
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
}) => {
  const [isClosing, setIsClosing] = React.useState(false);
  const closeTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  // Handle close with animation
  const handleClose = React.useCallback(() => {
    if (isClosing) return; // Prevent multiple close calls

    setIsClosing(true);
    // Clear any existing timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    // Wait for animation to complete before calling parent's onClose
    closeTimeoutRef.current = setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300); // Match animation duration
  }, [isClosing, onClose]);

  // Reset closing state when opened
  React.useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      // Clear timeout if reopening during close animation
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    }
  }, [isOpen]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isClosing) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when drawer is open
      // document.body.style.overflow = 'hidden';
    } else {
      // document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, isClosing, handleClose]);

  // Determine if drawer should be visible (open or closing)

  return (
    <>
      <style>{`
        .filter-drawer { width: 100%; max-width: 320px; }
        @media (min-width: 768px) { .filter-drawer { max-width: 400px; } }
      `}</style>

      {/* Backdrop */}
      <div
        className={classNames(
          'fixed inset-0 bg-black/20 z-40',
          'transition-opacity duration-300 ease-out',
          isOpen && !isClosing ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={handleClose}
      />

      {/* Drawer - Always in DOM, just off-screen when closed */}
      <div
        className={classNames(
          'filter-drawer fixed top-0 h-full bg-white z-50',
          'shadow-2xl overflow-y-auto',
          // Position
          direction === 'drawer-left' ? 'left-0' : 'right-0',
          // Tailwind transition for smooth slide animation
          'transition-transform duration-300 ease-out',
          // Slide in/out: Keep visible during isClosing to complete animation
          isOpen && !isClosing ? 'translate-x-0' : direction === 'drawer-left' ? '-translate-x-full' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-lg font-semibold">Filters</h3>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors" aria-label="Close">
            <IconRenderer icon="X" className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <ProductFiltersSidebar
            filters={filters}
            categories={categories}
            brands={brands}
            minMaxPrice={minMaxPrice}
            selectedCategory={selectedCategory}
            selectedBrand={selectedBrand}
            selectedRating={selectedRating}
            priceRange={priceRange}
            selectedAttributes={selectedAttributes}
            hasActiveFilters={hasActiveFilters}
            onCategoryChange={onCategoryChange}
            onBrandChange={onBrandChange}
            onRatingChange={onRatingChange}
            onPriceChange={onPriceChange}
            onAttributeChange={onAttributeChange}
            onResetFilters={onResetFilters}
          />
        </div>
      </div>
    </>
  );
};
