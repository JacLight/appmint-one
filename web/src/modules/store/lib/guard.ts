import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSetup } from "@/lib/setup";
import { storeView, type StoreView } from "./config";

/** The retail shop pages: food-only setups go to /eat. */
export async function requireRetail(): Promise<StoreView> {
  const view = storeView(await getSetup());
  if (!view.retail) { if (view.food) redirect("/eat"); notFound(); }
  return view;
}

/** The food pages: retail-only setups have none. */
export async function requireFood(): Promise<StoreView> {
  const view = storeView(await getSetup());
  if (!view.food) notFound();
  return view;
}
