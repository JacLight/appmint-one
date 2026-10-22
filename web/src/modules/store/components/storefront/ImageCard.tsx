// @ts-nocheck — base-app compiles without strict mode; kept as-is rather than retyped.
'use client';
// from base-app/src/components/storefront/ImageCard.tsx — ported verbatim; only import paths rewired.
import React, { useState, useRef, useEffect } from 'react';

/**
 * Scrub-through-images card: moving the pointer across it steps through every
 * product image, with dots showing position.
 *
 * `className` / `aspectClassName` let a template override the default square,
 * rounded-with-shadow presentation without forking the behaviour.
 */
export const ImageCard = ({
  images,
  title,
  onProductClick = undefined,
  className = 'group w-full h-full rounded overflow-hidden shadow-lg relative',
  aspectClassName = 'w-full relative aspect-w-2 aspect-h-3 pb-[100%]',
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const cardRef = useRef(null);
  const touchStartX = useRef(0);
  const isTouching = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isTouching.current && cardRef.current && images && images.length > 0) {
        const { left, width } = cardRef.current.getBoundingClientRect();
        const mouseX = e.clientX - left;
        const percentage = (mouseX / width) * 100;
        const newIndex = Math.floor((percentage / 100) * images.length);
        setCurrentImageIndex(Math.min(Math.max(newIndex, 0), images.length - 1));
      }
    };

    const handleTouchStart = (e) => {
      isTouching.current = true;
      touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e) => {
      if (cardRef.current && images && images.length > 0) {
        const touchEndX = e.touches[0].clientX;
        const { width } = cardRef.current.getBoundingClientRect();
        const deltaX = touchEndX - touchStartX.current;
        const percentage = (deltaX / width) * 100;
        const indexChange = Math.round((percentage / 100) * images.length);
        const newIndex = Math.min(Math.max(currentImageIndex - indexChange, 0), images.length - 1);
        setCurrentImageIndex(newIndex);
      }
    };

    const handleTouchEnd = () => {
      isTouching.current = false;
      touchStartX.current = 0;
    };

    const handleMouseLeave = () => {
      if (!isTouching.current) {
        setCurrentImageIndex(0);
      }
    };

    const card = cardRef.current;
    if (card) {
      card.addEventListener('mousemove', handleMouseMove);
      card.addEventListener('mouseleave', handleMouseLeave);
      card.addEventListener('touchstart', handleTouchStart);
      card.addEventListener('touchmove', handleTouchMove);
      card.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      if (card) {
        card.removeEventListener('mousemove', handleMouseMove);
        card.removeEventListener('mouseleave', handleMouseLeave);
        card.removeEventListener('touchstart', handleTouchStart);
        card.removeEventListener('touchmove', handleTouchMove);
        card.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [images, currentImageIndex]);

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <div ref={cardRef} className={className} onClick={onProductClick}>
      <div className={aspectClassName}>
        {images.map((image, index) => (
          <img
            key={index}
            className={`
                            absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out
                            ${index === currentImageIndex ? 'opacity-100 scale-110' : 'opacity-0 scale-100'}
                        `}
            src={image}
            alt={`${title || 'Product'} - ${index + 1}`}
          />
        ))}
      </div>
      <div className="absolute bottom-2 left-0 w-full flex justify-center opacity-0 group-hover:opacity-80">
        {images.map((_, index) => (
          <div
            key={index}
            className={`
                            w-2 h-2 rounded-full mx-1
                            ${index === currentImageIndex ? 'bg-white' : 'bg-gray-400'}
                        `}
          />
        ))}
      </div>
    </div>
  );
};
