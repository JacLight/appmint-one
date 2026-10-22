// Stand-in for base-app/src/context/site-store.ts: only the product card's quick-view
// opener is read; this app links to the product page instead.
const ui = { openQuickView: (_p?: any) => {}, closeQuickView: () => {} };
export function useUIStore<T>(select: (s: typeof ui) => T): T { return select(ui); }
export function useSiteStore<T>(select: (s: any) => T): T { return select({}); }
