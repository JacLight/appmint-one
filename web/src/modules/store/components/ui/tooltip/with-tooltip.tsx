// from base-app/src/components/ui/tooltip/with-tooltip.tsx — ported verbatim; only import paths rewired.
import React from 'react';

// Server-compatible tooltip HOC
export const withTooltip = (Component: any, position?: 'top' | 'right' | 'bottom' | 'left' | 'context', gapY?: number, gapX?: number) => {
  // Return a component that can handle both server and client rendering
  const TooltipWrapper = React.forwardRef((props: any, ref) => {
    const { tooltip, title, ...rest } = props;
    const info = tooltip || title;

    // On server side, just render the component without tooltip functionality
    if (typeof window === 'undefined') {
      return <Component ref={ref} {...rest} title={info} />;
    }

    // On client side, use a simple approach without dynamic imports
    const [isClient, setIsClient] = React.useState(false);

    React.useEffect(() => {
      setIsClient(true);
    }, []);

    // If not yet hydrated on client, render without tooltip
    if (!isClient) {
      return <Component ref={ref} {...rest} title={info} />;
    }

    // Import the client tooltip component directly (this will be tree-shaken on server)
    const { withTooltipClient } = require('./with-tooltip-client');
    const ClientTooltipWrapper = withTooltipClient(Component, position, gapY, gapX);

    // Render with client-side tooltip functionality
    return <ClientTooltipWrapper ref={ref} {...props} />;
  });

  TooltipWrapper.displayName = `withTooltip(${Component.displayName || Component.name || 'Component'})`;

  return TooltipWrapper;
};
