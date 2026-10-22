'use client';

// from base-app/src/components/storefront/DesignPreview.tsx — ported verbatim; only import paths rewired.
/**
 * Live design preview — shows the shopper's uploaded artwork composited onto
 * the product's mockup views, driven by `product.data.preview` from the server.
 *
 * Rendered with plain DOM (percent-positioned overlays) rather than canvas so it
 * stays crisp and responsive; the flattened proof stored on the line item is
 * rendered separately at add-to-cart time by `design-composer`.
 */

import React, { useState } from 'react';
import { cn } from '@/modules/store/lib/utils';
import type { CustomAttributeValues, PreviewConfig } from './utils/custom-attributes';
import { getViewBaseImageUrl, getZoneFile } from './utils/custom-attributes';
import { fileDisplayUrl } from '@/modules/store/lib/storefront-upload';

interface Props {
  preview: PreviewConfig;
  values: CustomAttributeValues;
  className?: string;
}

export const DesignPreview: React.FC<Props> = ({ preview, values, className }) => {
  const [activeView, setActiveView] = useState(0);
  const views = preview.views || [];
  const view = views[activeView];
  const baseUrl = getViewBaseImageUrl(view);

  if (!baseUrl) return null;

  const zones = view?.zones || [];
  const hasArtwork = zones.some((zone) => !!getZoneFile(zone, values));

  return (
    <div className={cn('mb-4', className)}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base md:text-lg font-semibold text-heading">Design preview</h3>
        {views.length > 1 && (
          <div className="flex gap-1">
            {views.map((entry, index) => (
              <button
                key={`${entry.name}-${index}`}
                type="button"
                onClick={() => setActiveView(index)}
                className={cn(
                  'text-xs px-2 py-1 rounded border transition-colors',
                  index === activeView ? 'border-black text-black' : 'border-gray-200 text-gray-500 hover:border-gray-400',
                )}
              >
                {entry.name || `View ${index + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative w-full overflow-hidden rounded-lg border border-gray-200 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={baseUrl} alt={view?.name || 'Product mockup'} className="w-full h-auto block" />

        {zones.map((zone, index) => {
          const file = getZoneFile(zone, values);
          const isImage = (file?.contentType || '').startsWith('image/');
          const fileUrl = fileDisplayUrl(file);

          return (
            <div
              key={`${zone.attribute}-${index}`}
              className={cn('absolute overflow-hidden', !file && 'border border-dashed border-gray-300/80')}
              style={{
                left: `${zone.x ?? 0}%`,
                top: `${zone.y ?? 0}%`,
                width: `${zone.width ?? 0}%`,
                height: `${zone.height ?? 0}%`,
                transform: `rotate(${zone.rotation ?? 0}deg)`,
              }}
            >
              {file && isImage && fileUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fileUrl}
                  alt={zone.label || zone.attribute}
                  className="w-full h-full"
                  style={{ objectFit: zone.fit || 'contain' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 text-center px-1">
                  {file ? 'Artwork attached' : zone.label || zone.attribute}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!hasArtwork && <p className="text-xs text-gray-500 mt-2">Upload your artwork above to see it on the product.</p>}
    </div>
  );
};
