// @ts-nocheck — base-app compiles without strict mode; kept as-is rather than retyped.
'use client';
// from base-app/src/components/ui/mobile-event-component.tsx — ported verbatim; only import paths rewired.
import React, { useState } from 'react';

const MobileEventComponent = ({ onDoubleTap = (event) => {}, onLongPress = (event) => {}, delay = 500, children, ...props }) => {
  const [lastTap, setLastTap] = useState(0);
  const [longPressTimeout, setLongPressTimeout] = useState(null);

  // Handle Double Tap
  const handleDoubleTap = (event) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // 300ms for double tap detection

    if (now - lastTap < DOUBLE_TAP_DELAY) {
      onDoubleTap(event); // Trigger double tap action
    }
    setLastTap(now);
  };

  // Handle Long Press
  const startLongPress = (event) => {
    const timeout = setTimeout(() => {
      onLongPress(event); // Trigger long press action
    }, delay);
    setLongPressTimeout(timeout);
  };

  const endLongPress = () => {
    clearTimeout(longPressTimeout); // Clear timeout if touch ends before delay
  };

  return (
    <div
      {...props}
      onTouchStart={(event) => {
        handleDoubleTap(event);
        startLongPress(event);
      }}
      onTouchEnd={endLongPress}
      onTouchCancel={endLongPress}
    >
      {children}
    </div>
  );
};

export default MobileEventComponent;
