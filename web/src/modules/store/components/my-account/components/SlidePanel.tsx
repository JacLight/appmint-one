'use client';
// from base-app/src/components/my-account/components/SlidePanel.tsx — ported verbatim; only import paths rewired.
import React, { useEffect, useRef } from 'react';
import { IconRenderer } from '@/modules/store/components/ui/icon-renderer';

interface SlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export const SlidePanel: React.FC<SlidePanelProps> = ({ isOpen, onClose, title, children, width = '1000px' }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop — clicking the page behind a drawer is how everyone closes
          one, and there was nothing here to click: the wrapper took no pointer
          events, so only the X and Escape worked. */}
      <div className="absolute inset-0 bg-black/20 transition-opacity" onClick={onClose} aria-hidden />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`absolute inset-y-0 right-0 h-full bg-white shadow-2xl transform transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width, maxWidth: '90vw' }}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors group">
              <IconRenderer icon="X" className="w-6 h-6 text-gray-400 group-hover:text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto h-full">{children}</div>
      </div>
    </div>
  );
};
