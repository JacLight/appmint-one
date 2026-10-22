import { StoreShell } from "@/modules/store/shell";

/** Every /shop page: the store shell (colour tokens, signed-in customer, toasts). */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <StoreShell>{children}</StoreShell>;
}
