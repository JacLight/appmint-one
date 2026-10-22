// from base-app/src/components/storefront/boutique/filters/RangeInputFilter.tsx — ported verbatim; only import paths rewired.
interface RangeInputFilterProps {
  title: string;
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
}

export function RangeInputFilter({ title, min, max, value, onChange }: RangeInputFilterProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <input
            type="number"
            placeholder="Min"
            value={value[0]}
            onChange={e => onChange([Number(e.target.value), value[1]])}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex-1">
          <input
            type="number"
            placeholder="Max"
            value={value[1]}
            onChange={e => onChange([value[0], Number(e.target.value)])}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      <p className="text-xs text-gray-500">
        ${min.toLocaleString()} - ${max.toLocaleString()}
      </p>
    </div>
  );
}
