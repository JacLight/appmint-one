'use client';

// from base-app/src/components/storefront/LineItemOptions.tsx — ported verbatim; only import paths rewired.
/**
 * Renders a line item's chosen `options[]` — preset picks, typed instructions,
 * and uploaded artwork — plus the design proof when one was composed.
 *
 * Shared by the cart drawer, checkout summary and order confirmation so a
 * shopper sees the same artwork everywhere it matters.
 */

import React from 'react';
import { cn } from '@/modules/store/lib/utils';
import { FileText } from 'lucide-react';
import type { FileInfo, LineItemDesign, LineItemOption } from './utils/custom-attributes';
import { AttributeTitle, AttributeValue } from './AttributeLabel';
import { fileDisplayUrl, useSignedPreviews } from '@/modules/store/lib/storefront-upload';

interface Props {
  options?: LineItemOption[];
  design?: LineItemDesign;
  className?: string;
  /** Tighter layout for the cart drawer / summary rows. */
  compact?: boolean;
}

const fileLabel = (file: FileInfo) => file.meta?.name || file.path?.split('/').pop() || 'file';
const isImage = (file: FileInfo) => (file.contentType || '').startsWith('image/');

const FileChips: React.FC<{ files: FileInfo[]; size: number }> = ({ files, size }) => (
  <span className="inline-flex flex-wrap gap-1 align-middle">
    {files.map((file, index) => {
      const label = fileLabel(file);
      const shown = fileDisplayUrl(file);
      const content = isImage(file) && shown ? (
        <img src={shown} alt={label} className="object-cover rounded border border-gray-200" style={{ width: size, height: size }} />
      ) : (
        <span className="inline-flex items-center gap-1 border border-gray-200 rounded px-1 py-0.5 max-w-[10rem]">
          <FileText className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{label}</span>
        </span>
      );

      return shown ? (
        <a key={`${file.path || file.url}-${index}`} href={shown} target="_blank" rel="noopener noreferrer" title={label} className="hover:opacity-80">
          {content}
        </a>
      ) : (
        <span key={`${label}-${index}`} title={label}>
          {content}
        </span>
      );
    })}
  </span>
);

export const LineItemOptions: React.FC<Props> = ({ options, design, className, compact = false }) => {
  const hasOptions = !!options?.length;
  const hasProof = !!design?.composites?.length;
  const needsLinks = (options || []).some((option) => option.files?.some((file) => !file.url)) || (design?.composites || []).some((file) => !file.url);
  useSignedPreviews(needsLinks);
  if (!hasOptions && !hasProof) return null;

  const thumb = compact ? 24 : 40;

  return (
    <div className={cn('text-xs text-gray-500 dark:text-gray-400 space-y-1', className)}>
      {options?.map((option, index) => (
        <div key={`${option.name}-${index}`} className={cn(option.type === 'file' && 'flex items-center gap-1.5 flex-wrap')}>
          <span className="font-medium"><AttributeTitle name={option.name} />:</span>{' '}
          {option.type === 'file' && option.files?.length ? <FileChips files={option.files} size={thumb} /> : <span>{option.type ? option.value : <AttributeValue name={option.name} value={option.value} />}</span>}
        </div>
      ))}

      {hasProof && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium">Proof:</span>
          <FileChips files={design!.composites} size={thumb} />
        </div>
      )}
    </div>
  );
};
