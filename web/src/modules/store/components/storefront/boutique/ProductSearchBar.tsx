'use client';
// from base-app/src/components/storefront/boutique/ProductSearchBar.tsx — ported verbatim; only import paths rewired.
import { SlidersHorizontal, LayoutGrid, List, Search, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export type ViewMode = 'grid' | 'list';

interface ProductSearchBarProps {
  searchKeyword: string;
  onSearchChange: (keyword: string) => void;
  sortBy: string;
  sortType: 'asc' | 'desc';
  onSortChange: (sortBy: string, sortType: 'asc' | 'desc') => void;
  showFilterButton?: boolean;
  onFilterClick?: () => void;
  filterCount?: number;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  isDrawerMode?: boolean; // true = show button always, false = show button only on mobile
}

export function ProductSearchBar({
  searchKeyword,
  onSearchChange,
  sortBy,
  sortType,
  onSortChange,
  showFilterButton = false,
  onFilterClick,
  filterCount = 0,
  viewMode = 'grid',
  onViewModeChange,
  isDrawerMode = false,
}: ProductSearchBarProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sortOptions = [
    { label: 'Latest', value: 'createdAt', type: 'desc' },
    { label: 'Price: Low to High', value: 'data.price', type: 'asc' },
    { label: 'Price: High to Low', value: 'data.price', type: 'desc' },
    { label: 'Name: A-Z', value: 'name', type: 'asc' },
    { label: 'Name: Z-A', value: 'name', type: 'desc' },
  ];

  const currentSort = sortOptions.find((opt) => opt.value === sortBy && opt.type === sortType) || sortOptions[0];

  const handleSortSelect = (option: (typeof sortOptions)[0]) => {
    onSortChange(option.value, option.type as 'asc' | 'desc');
    setSortOpen(false);
  };

  // Appmint One: the store's toolbar look; search, sort and view logic above are base-app's.
  return (
    <div className="sf-plp-bar">
      {showFilterButton && (
        <button onClick={onFilterClick} className={`sf-plp-ctl ${isDrawerMode ? '' : 'mobile-filter-btn'}`}>
          <SlidersHorizontal className="w-4 h-4" />
          <span>Filter</span>
          {filterCount > 0 && <span className="sf-plp-n">{filterCount}</span>}
        </button>
      )}

      <label className="sf-plp-search">
        <Search className="w-4 h-4" aria-hidden="true" />
        <input type="search" placeholder="Search" aria-label="Search products" value={searchKeyword} onChange={(e) => onSearchChange(e.target.value)} />
      </label>

      {onViewModeChange && (
        <div className="sf-plp-view" role="group" aria-label="View">
          <button onClick={() => onViewModeChange('grid')} className={viewMode === 'grid' ? 'on' : ''} aria-label="Grid view" aria-pressed={viewMode === 'grid'}><LayoutGrid className="w-4 h-4" /></button>
          <button onClick={() => onViewModeChange('list')} className={viewMode === 'list' ? 'on' : ''} aria-label="List view" aria-pressed={viewMode === 'list'}><List className="w-4 h-4" /></button>
        </div>
      )}

      <div className="sf-plp-sort" ref={sortRef}>
        <button onClick={() => setSortOpen(!sortOpen)} className="sf-plp-ctl" aria-haspopup="listbox" aria-expanded={sortOpen}>
          <span className="lbl">Sort</span>
          <span>{currentSort.label}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
        </button>
        {sortOpen && (
          <div className="sf-plp-menu" role="listbox">
            {sortOptions.map((option) => {
              const on = currentSort.value === option.value && currentSort.type === option.type;
              return (
                <button key={`${option.value}-${option.type}`} role="option" aria-selected={on} onClick={() => handleSortSelect(option)} className={on ? 'on' : ''}>
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
