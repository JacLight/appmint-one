// from base-app/src/lib/storefront-upload.ts — ported verbatim; only import paths rewired.
/**
 * File uploads for storefront customization (artwork, instructions, design proofs).
 *
 * This deliberately does NOT go through `AppEngineClient.processRequest` — that
 * path forces `Content-Type: application/json`, which strips the multipart
 * boundary. We post the FormData directly so the browser sets the boundary, and
 * we get upload progress for free.
 *
 * Transport is isolated here on purpose: the endpoint below is the customer
 * file store, which requires a signed-in customer. If/when a public storefront
 * upload lands, only `UPLOAD_ENDPOINT` changes.
 */

import axios from 'axios';
import { useEffect, useState } from 'react';
import { appmintEndpoints } from './appmint-endpoints';
import { getProxiedUrl } from './proxy-utils';
import { activeSession } from './active-session';
import type { FileInfo } from '@/modules/store/components/storefront/utils/custom-attributes';

/** `client-data/files/upload` — authenticated customer only. */
const UPLOAD_ENDPOINT = appmintEndpoints.client_file_upload;

export class UploadAuthRequiredError extends Error {
  constructor(message = 'Please sign in to upload files.') {
    super(message);
    this.name = 'UploadAuthRequiredError';
  }
}

/** Uploads are stored per-product so the fulfillment team can find them. */
export const artworkLocation = (sku?: string): string => (sku ? `storefront/artwork/${sku}` : 'storefront/artwork');

/**
 * Normalize whatever the file store returns into a FileInfo. The server echoes
 * `path` / `url` but is inconsistent about nesting and about carrying the
 * original filename, which we need for display.
 */
const toFileInfo = (response: any, file?: File): FileInfo => {
  const raw = response?.data ?? response ?? {};
  const record = Array.isArray(raw) ? raw[0] : raw;

  const relativePath = record?.path || record?.location || '';
  const user = activeSession.getUser();
  const identity = user?.data?.email || user?.data?.username || user?.sk;
  // The customer upload API returns a path relative to this private folder.
  const storagePath = identity && relativePath && !relativePath.startsWith('client-account/')
    ? `client-account/${identity}/${relativePath}` : relativePath;
  return {
    path: storagePath,
    url: record?.url || record?.publicUrl || '',
    contentType: record?.contentType || file?.type || '',
    isPublic: record?.isPublic,
    meta: {
      ...(record?.meta || {}),
      name: record?.meta?.name || record?.name || file?.name,
      size: record?.meta?.size ?? record?.size ?? file?.size,
    },
  };
};

export interface UploadOptions {
  /** Folder to store under, e.g. `storefront/artwork/SKU-123`. */
  location?: string;
  /** 0–100. */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/**
 * Private customer uploads come back without a viewable URL (the file store is
 * signed-in only), so the shopper's own image could never be shown on the page:
 * the Design Preview said "Artwork attached" and the chip showed a file icon.
 * Keep a browser-local preview of each file this visitor uploaded, keyed by its
 * storage path. It never leaves the page (nothing is persisted on the cart line).
 */
const localPreviews = new Map<string, string>();
// After a page change the browser-local preview is gone; the signed-in customer's own file list
// carries short-lived signed links, so look the file up there (cached for a few minutes).
const signedPreviews = new Map<string, string>();
let signedLoaded = 0;
let signedPending: Promise<boolean> | null = null;
const relativeOf = (path: string) => path.replace(/^client-account\/[^/]+\//, '');
export const fileDisplayUrl = (file?: Partial<FileInfo>): string =>
  file?.url || (file?.path ? localPreviews.get(file.path) || signedPreviews.get(relativeOf(file.path)) || '' : '');
/** Resolves true when new signed links arrived (callers re-render). */
export const loadSignedPreviews = (): Promise<boolean> => {
  const token = activeSession.getToken();
  if (!token || token === 'Bearer ') return Promise.resolve(false);
  if (Date.now() - signedLoaded < 5 * 60 * 1000) return Promise.resolve(false);
  if (!signedPending) {
    signedPending = axios
      .get(getProxiedUrl(appmintEndpoints.client_files.path, ''), { headers: { authorization: token } })
      .then((response) => {
        const files = response?.data?.files || response?.data?.data?.files || [];
        files.forEach((entry: any) => { if (entry?.path && entry?.url) signedPreviews.set(entry.path, entry.url); });
        signedLoaded = Date.now();
        return files.length > 0;
      })
      .catch(() => false)
      .finally(() => { signedPending = null; });
  }
  return signedPending;
};

/** Upload a single file and return its FileInfo. */
export const uploadStorefrontFile = async (file: File, options: UploadOptions = {}): Promise<FileInfo> => {
  const token = activeSession.getToken();
  if (!token || token === 'Bearer ') {
    throw new UploadAuthRequiredError();
  }

  const formData = new FormData();
  formData.append('file', file);
  if (options.location) formData.append('location', options.location);

  try {
    const response = await axios.post(getProxiedUrl(UPLOAD_ENDPOINT.path, ''), formData, {
      headers: { authorization: token },
      signal: options.signal,
      onUploadProgress: (event) => {
        if (!options.onProgress) return;
        const total = event.total || file.size;
        if (!total) return;
        options.onProgress(Math.min(100, Math.round((event.loaded / total) * 100)));
      },
    });
    const info = toFileInfo(response?.data, file);
    if (!info.url && info.path && (file.type || '').startsWith('image/') && typeof URL !== 'undefined' && URL.createObjectURL) {
      localPreviews.set(info.path, URL.createObjectURL(file));
    }
    return info;
  } catch (error: any) {
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      throw new UploadAuthRequiredError();
    }
    throw new Error(error?.response?.data?.message || error?.message || 'Upload failed');
  }
};

/** Upload a canvas-rendered design proof. */
export const uploadDesignComposite = async (blob: Blob, fileName: string, options: UploadOptions = {}): Promise<FileInfo> => {
  const file = new File([blob], fileName, { type: blob.type || 'image/png' });
  return uploadStorefrontFile(file, options);
};

/** Can the current visitor upload at all? Drives the sign-in prompt on the product page. */
export const canUploadFiles = (): boolean => {
  const token = activeSession.getToken();
  return !!token && token !== 'Bearer ';
};

/** Re-render once the signed links for private uploads are known (cart, checkout, confirmation). */
export const useSignedPreviews = (needed: boolean) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!needed) return;
    let live = true;
    loadSignedPreviews().then((changed) => { if (live && changed) setTick((t) => t + 1); });
    return () => { live = false; };
  }, [needed]);
};
