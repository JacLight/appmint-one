'use client';

// from base-app/src/components/storefront/CustomAttributeInput.tsx — ported verbatim; only import paths rewired.
/**
 * Renders a customer-supplied product attribute — a `file` upload (artwork,
 * spec sheets) or a `text` note (print instructions) — on the product page.
 *
 * Files upload as soon as they're picked so the line item carries real FileInfo
 * objects (path + url) rather than browser File handles, which can't survive
 * the cart's localStorage round-trip.
 */

import React, { DragEvent, useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/modules/store/lib/utils';
import { Textarea } from '@/modules/store/components/ui/textarea';
import { Upload, X, FileText, Loader2, AlertCircle } from 'lucide-react';
import { uploadStorefrontFile, artworkLocation, UploadAuthRequiredError, canUploadFiles, fileDisplayUrl } from '@/modules/store/lib/storefront-upload';
import type { AttributeDef, FileInfo } from './utils/custom-attributes';
import { isAcceptedFile, remainingFileSlots, parseAcceptList } from './utils/custom-attributes';

interface Props {
  className?: string;
  attribute: { name: string; required?: boolean };
  def: AttributeDef;
  value?: { text?: string; files?: FileInfo[] };
  onChange: (name: string, value: { text?: string; files?: FileInfo[] }) => void;
  /** Product SKU - uploads are foldered per product for fulfillment. */
  sku?: string;
  showError?: boolean;
}

interface PendingUpload {
  id: string;
  name: string;
  progress: number;
  error?: string;
}

const isImage = (file: FileInfo) => (file.contentType || '').startsWith('image/');

const fileLabel = (file: FileInfo) => file.meta?.name || file.path?.split('/').pop() || 'file';

export const CustomAttributeInput: React.FC<Props> = ({ className = 'mb-4', attribute, def, value, onChange, sku, showError = false }) => {
  const pathname = usePathname();
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [authRequired, setAuthRequired] = useState(false);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [isOver, setIsOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadCounter = useRef(0);

  const files = value?.files || [];
  const isRequired = attribute.required !== false;
  const label = def.title || attribute.name;
  const accepted = parseAcceptList(def.accept);

  const hasError = showError && isRequired && (def.type === 'file' ? files.length === 0 : !value?.text?.trim());

  const handleFiles = useCallback(
    async (picked: File[]) => {
      setLimitMessage(null);

      if (!canUploadFiles()) {
        setAuthRequired(true);
        return;
      }

      const slots = remainingFileSlots(def, files.length);
      if (slots <= 0) {
        setLimitMessage(def.multiple ? `You can upload up to ${def.maxFiles} file${def.maxFiles === 1 ? '' : 's'}.` : 'Only one file can be uploaded. Remove the current one first.');
        return;
      }

      const allowed = picked.filter((file) => isAcceptedFile(file, def.accept));
      if (allowed.length < picked.length) {
        setLimitMessage(`Some files were skipped. Accepted types: ${def.accept}`);
      }

      const toUpload = slots === Infinity ? allowed : allowed.slice(0, slots);
      if (toUpload.length < allowed.length) {
        setLimitMessage(`Only the first ${toUpload.length} file${toUpload.length === 1 ? '' : 's'} were added (limit ${def.maxFiles}).`);
      }

      // Accumulate locally: `value` is captured per render, so appending to it
      // on each iteration would drop every file but the last
      const accumulated = [...(value?.files || [])];

      for (const file of toUpload) {
        const id = `upload-${++uploadCounter.current}`;
        setPending((previous) => [...previous, { id, name: file.name, progress: 0 }]);

        try {
          const uploaded = await uploadStorefrontFile(file, {
            location: artworkLocation(sku),
            onProgress: (percent) => {
              setPending((previous) => previous.map((entry) => (entry.id === id ? { ...entry, progress: percent } : entry)));
            },
          });

          accumulated.push(uploaded);
          onChange(attribute.name, { ...value, files: [...accumulated] });
          setPending((previous) => previous.filter((entry) => entry.id !== id));
        } catch (error: any) {
          if (error instanceof UploadAuthRequiredError) {
            setAuthRequired(true);
            setPending((previous) => previous.filter((entry) => entry.id !== id));
            return;
          }
          setPending((previous) => previous.map((entry) => (entry.id === id ? { ...entry, error: error?.message || 'Upload failed' } : entry)));
        }
      }
    },
    [attribute.name, def, files.length, onChange, sku, value],
  );

  const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files || []);
    if (picked.length) handleFiles(picked);
    // Allow re-picking the same file after a remove
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsOver(false);
    const dropped = Array.from(event.dataTransfer.files || []);
    if (dropped.length) handleFiles(dropped);
  };

  const removeFile = (index: number) => {
    const next = files.filter((_, position) => position !== index);
    onChange(attribute.name, { ...value, files: next });
    setLimitMessage(null);
  };

  if (def.type === 'text') {
    return (
      <div className={cn(className, hasError && 'p-3 border-2 border-red-200 rounded-lg bg-red-50/50')}>
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className={cn('text-base md:text-lg font-semibold', !def?.title && 'capitalize', hasError ? 'text-red-600' : 'text-heading')}>{label}</h3>
          {hasError && <span className="text-xs text-red-600 font-medium bg-red-100 px-2 py-0.5 rounded">Required</span>}
        </div>
        <Textarea
          rows={3}
          value={value?.text || ''}
          placeholder={`Add your ${label.toLowerCase()}`}
          onChange={(event) => onChange(attribute.name, { ...value, text: event.target.value })}
          className="w-full"
        />
      </div>
    );
  }

  return (
    <div className={cn(className, hasError && 'p-3 border-2 border-red-200 rounded-lg bg-red-50/50')}>
      <div className="flex items-center gap-2 mb-1.5">
        <h3 className={cn('text-base md:text-lg font-semibold', !def?.title && 'capitalize', hasError ? 'text-red-600' : 'text-heading')}>{label}</h3>
        {hasError && <span className="text-xs text-red-600 font-medium bg-red-100 px-2 py-0.5 rounded">Required</span>}
      </div>

      {/* Uploaded files */}
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-3 mb-3">
          {files.map((file, index) => (
            <li key={`${file.path || file.url}-${index}`} className="relative group border border-gray-200 rounded p-1 w-20">
              {isImage(file) && fileDisplayUrl(file) ? (
                <img src={fileDisplayUrl(file)} alt={fileLabel(file)} className="w-full h-16 object-contain" />
              ) : (
                <div className="w-full h-16 flex flex-col items-center justify-center text-gray-500">
                  <FileText className="w-6 h-6" />
                </div>
              )}
              <p className="text-[10px] text-gray-600 truncate mt-1" title={fileLabel(file)}>
                {fileLabel(file)}
              </p>
              <button
                type="button"
                onClick={() => removeFile(index)}
                aria-label={`Remove ${fileLabel(file)}`}
                className="absolute -top-2 -right-2 bg-white border border-gray-300 rounded-full p-0.5 shadow-sm hover:bg-gray-100"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* In-flight uploads */}
      {pending.length > 0 && (
        <ul className="space-y-2 mb-3">
          {pending.map((entry) => (
            <li key={entry.id} className="text-xs text-gray-600">
              <div className="flex items-center gap-2">
                {entry.error ? <AlertCircle className="w-3.5 h-3.5 text-red-500" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span className="truncate">{entry.name}</span>
                {!entry.error && <span className="ml-auto">{entry.progress}%</span>}
              </div>
              {entry.error ? (
                <p className="text-red-600 mt-0.5">{entry.error}</p>
              ) : (
                <div className="h-1 bg-gray-100 rounded mt-1">
                  <div className="h-1 bg-gray-800 rounded transition-all" style={{ width: `${entry.progress}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsOver(false);
        }}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
          isOver ? 'border-gray-800 bg-gray-50' : 'border-gray-300 hover:border-gray-400',
        )}
      >
        <Upload className="w-5 h-5 mx-auto text-gray-400 mb-1" />
        <p className="text-sm text-gray-600">
          Drop {def.multiple ? 'files' : 'a file'} here or <span className="underline">browse</span>
        </p>
        {(accepted.length > 0 || def.maxFiles) && (
          <p className="text-xs text-gray-400 mt-1">
            {accepted.length > 0 && accepted.join(', ')}
            {accepted.length > 0 && def.multiple && def.maxFiles ? ' · ' : ''}
            {def.multiple && def.maxFiles ? `up to ${def.maxFiles} files` : ''}
          </p>
        )}
        <input ref={inputRef} type="file" className="hidden" multiple={!!def.multiple} accept={def.accept || undefined} onChange={handleSelect} />
      </div>

      {limitMessage && <p className="text-xs text-amber-600 mt-2">{limitMessage}</p>}
      {authRequired && <p className="text-xs text-red-600 mt-2">Please <Link className="underline font-medium" href={`/login?callbackUrl=${encodeURIComponent(pathname || '/store')}`}>sign in</Link> to upload files for this product. Return here after signing in to choose your file.</p>}
    </div>
  );
};
