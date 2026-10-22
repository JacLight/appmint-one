// from base-app/src/components/storefront/types.ts — ported verbatim; only import paths rewired.
export interface ProductGridProps {
  className?: string;
  productDTO?: { data: any[]; hasNext: boolean; total: number; pageSize?: number };
  slug?: string; // Optional slug for product links
  searchParams?: { [key: string]: string | string[] | undefined }; // Optional search parameters
  categories?: any[]; // Categories for filtering
  brands?: any[]; // Brands for filtering
  filters?: any[]; // Filter configurations
  minMaxPrice?: { minPrice: number; maxPrice: number }; // Price range
  siteOrgId?: string; // Organization ID for API calls
  quickView?: 'none' | 'dialog' | 'drawer-left' | 'drawer-right'; // Quick view display mode
  filterLayout?: 'none' | 'top' | 'left' | 'right' | 'drawer-left' | 'drawer-right'; // Filter layout mode
  site?: any; // Site data for context
  config?: any; // Additional configuration options
}
