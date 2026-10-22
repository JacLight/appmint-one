// @ts-nocheck — base-app compiles without strict mode; kept as-is rather than retyped.
// from base-app/src/components/storefront/boutique/ProductAttributes.tsx — ported verbatim; only import paths rewired.
import { useEffect, useState } from 'react';
import { cn } from '@/modules/store/lib/utils';
import { useIsMobile } from '@/modules/store/hooks/use-mobile';
import type { AttributeDef } from '../utils/custom-attributes';
import { getColorHex } from '@/modules/store/build-studio/color-names';

interface Props {
  className?: string;
  attribute: {
    options: any[];
    name: string;
  };
  def?: AttributeDef;
  active: string;
  onClick: any;
  showError?: boolean;
}

export const ProductAttributes: React.FC<Props> = ({ className = 'mb-4', attribute, def, active, onClick, showError = false }) => {
  const [_key, setKey] = useState('');
  const isMobile = useIsMobile();

  useEffect(() => {
    if (attribute?.options?.length === 1) {
      handleClick(attribute.options[0].value);
    }
  }, [attribute]);

  const handleClick = (_key) => {
    onClick(attribute.name, _key);
    setKey(_key);
  };

  const hasError = showError && !active;
  // The attribute's own display setting decides swatches (Studio: Display = Color / Image swatches),
  // whatever the attribute is called; "color" without a setting keeps its old dot look.
  const display = def?.display || (attribute?.name === 'color' ? 'color' : undefined);
  const defOption = (value: string) => def?.options?.find((entry: any) => entry?.value === value) as any;
  const activeLabel = (display === 'color' || display === 'image') && active
    ? defOption(active)?.label || attribute?.options?.find((option) => option.value === active)?.label || active
    : '';

  // Appmint One: the store's option look (pills, round colour swatches, image swatches); the
  // selection logic above is base-app's.
  return (
    <div className={cn('sf-opt', hasError && 'err')}>
      <div className="sf-opt-hd">
        <b className={cn(!def?.title && 'capitalize')}>{def?.title || attribute?.name}</b>
        {activeLabel && <span>{activeLabel}</span>}
        {hasError && <em>Choose one</em>}
      </div>
      {def?.display === 'select' ? (
        <select
          aria-label={def.title || attribute.name}
          aria-required={showError || undefined}
          aria-invalid={hasError || undefined}
          className="sf-select"
          value={active || ''}
          onChange={(event) => handleClick(event.target.value)}
        >
          <option value="">Choose {def.title || attribute.name}</option>
          {attribute.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : <ul className={cn('sf-opt-list', display === 'color' && 'swatches', display === 'image' && 'images')} role="radiogroup" aria-label={def?.title || attribute?.name}>
        {attribute?.options?.map((option) => {
          const source = defOption(option.value);
          const swatchColor = source?.color || option.color || option.param || getColorHex(option.value);
          const swatchImage = source?.image?.[0]?.url || option.image?.[0]?.url;
          const optionLabel = source?.label || option.label || option.value;
          const on = option.value === active;
          return (
            <li
              data-attribute={option.value}
              key={`${attribute?.name}-${option.value}`}
              role="radio"
              aria-checked={on}
              tabIndex={0}
              className={cn(display === 'color' ? 'sf-opt-sw' : display === 'image' && swatchImage ? 'sf-opt-img' : 'sf-opt-pill', on && 'on')}
              onClick={() => handleClick(option.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(option.value); } }}
              title={display === 'color' || display === 'image' ? optionLabel : undefined}
              aria-label={display === 'color' || display === 'image' ? optionLabel : undefined}
            >
              {display === 'color' ? (
                <span style={{ backgroundColor: swatchColor }} />
              ) : display === 'image' && swatchImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={swatchImage} alt={optionLabel} />
              ) : (
                option.label
              )}
            </li>
          );
        })}
      </ul>}
    </div>
  );
};
