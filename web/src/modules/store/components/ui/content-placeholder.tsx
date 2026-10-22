// Stand-in for base-app/src/components/ui/content-placeholder.tsx (react-content-loader is
// not installed): the same loading skeleton, drawn with plain blocks.
const ContentPlaceholder = ({ count = 6 }: { count?: number; [k: string]: any }) => (
  <div className="grid grid-cols-2 gap-4 md:grid-cols-3" aria-busy="true">
    {Array.from({ length: count }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-lg bg-muted" />)}
  </div>
);
export default ContentPlaceholder;
