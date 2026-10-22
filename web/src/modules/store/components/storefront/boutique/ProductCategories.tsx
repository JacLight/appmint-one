'use client';
// from base-app/src/components/storefront/boutique/ProductCategories.tsx — ported verbatim; only import paths rewired.
import { useRouter, useSearchParams } from 'next/navigation';

interface ProductCategoriesProps {
  categories: any[];
  slug: string;
}

export default function ProductCategories({ categories, slug }: ProductCategoriesProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCategory = searchParams.get('category');

  if (!categories || categories.length === 0) {
    return null;
  }

  const handleCategoryClick = (categorySlug: string | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (categorySlug) {
      params.set('category', categorySlug);
    } else {
      params.delete('category');
    }

    // Reset to first page when changing category
    params.delete('page');

    const queryString = params.toString();
    const [rootSlug] = Array.isArray(slug) ? slug : [slug];
    router.push(`/${rootSlug}${queryString ? `?${queryString}` : ''}`);
  };

  return (
    <div className="border-b border-gray-200 mb-8">
      <div className="flex items-center justify-center gap-8 overflow-x-auto scrollbar-hide py-4">
        {/* View All */}
        <button
          onClick={() => handleCategoryClick(null)}
          className={`text-sm whitespace-nowrap pb-3 border-b-2 transition-colors ${
            !selectedCategory
              ? 'border-gray-900 text-gray-900 font-medium'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          View All
        </button>

        {/* Category Tabs */}
        {categories.map((category) => {
          const categorySlug = category?.slug || category?.name?.toLowerCase().replace(/\s+/g, '-');
          const categoryName = category?.name || category?.label;
          const isActive = selectedCategory === categorySlug;

          return (
            <button
              key={category._id || categorySlug}
              onClick={() => handleCategoryClick(categorySlug)}
              className={`text-sm whitespace-nowrap pb-3 border-b-2 transition-colors ${
                isActive
                  ? 'border-gray-900 text-gray-900 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {categoryName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
