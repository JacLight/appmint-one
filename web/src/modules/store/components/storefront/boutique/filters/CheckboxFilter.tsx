// from base-app/src/components/storefront/boutique/filters/CheckboxFilter.tsx — ported verbatim; only import paths rewired.
import { useState, useMemo } from 'react';
import { cn } from '@/modules/store/lib/utils';
import { Search } from 'lucide-react';

const VISIBLE_LIMIT = 8;

interface CheckboxFilterProps {
  title: string;
  options: Array<{ label: string; value: string; param?: string }>;
  values: string[];
  onChange: (value: string, checked: boolean) => void;
  attribute?: string;
}

export function CheckboxFilter({ title, options, values, onChange, attribute }: CheckboxFilterProps) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, search]);

  const showSearch = options.length > VISIBLE_LIMIT;
  const visibleOptions = expanded || search ? filteredOptions : filteredOptions.slice(0, VISIBLE_LIMIT);
  const hiddenCount = filteredOptions.length - VISIBLE_LIMIT;

  return (
    <div className="space-y-2">
      {showSearch && (
        <div className="relative flex items-center mb-2">
          <Search className="absolute left-2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}
      <div className={cn('space-y-2', showSearch && 'max-h-64 overflow-y-auto')}>
        {visibleOptions.map((option) => {
          const isChecked = values.includes(option.value);
          return (
            <label key={option.value} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => onChange(option.value, e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 flex-shrink-0"
              />
              <span
                className={cn(
                  'text-sm flex items-center gap-2 truncate',
                  isChecked ? 'font-medium text-gray-900' : 'text-gray-600 group-hover:text-gray-900',
                )}
              >
                {attribute === 'color' && option.param && (
                  <span className="w-4 h-4 rounded-full border border-gray-300 shadow-sm flex-shrink-0" style={{ backgroundColor: option.param }} />
                )}
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
      {!search && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
        >
          {expanded ? 'Show less' : `Show ${hiddenCount} more`}
        </button>
      )}
      {search && filteredOptions.length === 0 && (
        <p className="text-xs text-gray-400 py-1">No matches</p>
      )}
    </div>
  );
}
