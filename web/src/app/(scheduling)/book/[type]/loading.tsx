import { SiteHeader } from "@/components/site-header";
import { TypePageSkeleton } from "@/modules/scheduling/components/book/skeleton";

/** While a person's open times load: the page's shape, shimmering, under the real header. */
export default function Loading() {
  return (
    <>
      <SiteHeader />
      <main><TypePageSkeleton /></main>
    </>
  );
}
