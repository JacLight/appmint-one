import { Suspense } from "react";
import { CheckoutSuccess } from "@/modules/store/components/storefront/CheckoutSuccess";

export const metadata = { title: "Order", robots: { index: false } };

export default function CheckoutSuccessPage() {
  return <Suspense><CheckoutSuccess storePage="shop" /></Suspense>;
}
