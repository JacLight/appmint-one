'use server';
// from base-app/src/services/storefront/product-service.ts — getFilteredProducts kept
// verbatim; the engine read goes through @/api/store (searchProductsRaw).
import { searchProductsRaw } from '@/api/store';
import { getSetup } from '@/lib/setup';
import { storeView } from '@/modules/store/lib/config';

export interface ProductFilterParams {
  keyword?: string;
  tags?: string[];
  categories?: string[];
  brand?: string[];
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  sortType?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  [key: string]: any; // For dynamic attribute filters
}

export async function getFilteredProducts(siteOrgId: string, filters: ProductFilterParams): Promise<any> {
  const params = new URLSearchParams();

  if (filters.keyword) params.append('keyword', filters.keyword);
  if (filters.sort) params.append('s', filters.sort);
  if (filters.sortType) params.append('st', filters.sortType);
  if (filters.page) params.append('p', filters.page.toString());
  if (filters.pageSize) params.append('ps', filters.pageSize.toString());

  if (filters.categories && filters.categories.length > 0) {
    const categories = typeof filters.categories === 'string' ? (filters.categories as string).split(',') : filters.categories;
    categories.forEach((cat) => params.append('categories', cat));
    filters.categories = categories;
  }
  if (filters.tags && filters.tags.length > 0) {
    const tags = typeof filters.tags === 'string' ? (filters.tags as string).split(',') : filters.tags;
    tags.forEach((tag) => params.append('tags', tag));
    filters.tags = tags;
  }
  if (filters.brand && filters.brand.length > 0) {
    const brands = typeof filters.brand === 'string' ? (filters.brand as string).split(',') : filters.brand;
    brands.forEach((brand) => params.append('brand', brand));
    filters.brand = brands;
  }
  if (filters.rating && filters.rating.length > 0) {
    const ratings = typeof filters.rating === 'string' ? (filters.rating as string).split(',') : filters.rating;
    ratings.forEach((rating: string) => params.append('rating', rating));
    filters.rating = ratings;
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const min = filters.minPrice ?? 0;
    const max = filters.maxPrice ?? 999999;
    params.append('price', `${min}-${max}`);
  }

  Object.keys(filters).forEach((key) => {
    if (!['keyword', 'categories', 'brand', 'rating', 'minPrice', 'maxPrice', 'sort', 'sortType', 'page', 'pageSize'].includes(key)) {
      const value = filters[key];
      if (Array.isArray(value) && value.length > 0) {
        value.forEach((v) => params.append(key, v));
      } else if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    }
  });

  // Appmint One: this setup's slice of the catalog only (the same `tag` scope the shop uses).
  params.set('tag', storeView(await getSetup()).tags.join(','));
  // Appmint One: the catalog page passes its own scope in `siteOrgId` ("category=Dining"), so
  // a search or sort on a category page stays in that category.
  const scope = new URLSearchParams(siteOrgId || '');
  if (scope.get('category') && !params.has('categories')) params.set('category', scope.get('category')!);
  if (scope.get('keyword') && !params.has('keyword')) params.set('keyword', scope.get('keyword')!);
  return await searchProductsRaw(params.toString());
}
