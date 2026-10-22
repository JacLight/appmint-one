import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, de-duping conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(cents: number | null | undefined, currency = "USD") {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}
