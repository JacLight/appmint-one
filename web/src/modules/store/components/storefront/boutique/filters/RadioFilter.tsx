// from base-app/src/components/storefront/boutique/filters/RadioFilter.tsx — ported verbatim; only import paths rewired.
import { cn } from '@/modules/store/lib/utils';

interface RadioFilterProps {
  title: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}

export function RadioFilter({ title, options, value, onChange }: RadioFilterProps) {
  return (
    <div className="space-y-3">
      {options.map(option => (
        <label key={option.value} className="flex items-center gap-3 cursor-pointer group">
          <input
            type="radio"
            name={title}
            value={option.value}
            checked={value === option.value}
            onChange={e => onChange(e.target.value)}
            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
          />
          <span className={cn('text-sm', value === option.value ? 'font-medium text-gray-900' : 'text-gray-600 group-hover:text-gray-900')}>
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
