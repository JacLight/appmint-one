/**
 * Which engine cart is this visitor's. The shop bag and the food basket are separate
 * carts (a food basket is one restaurant; the bag ships), each id kept in its own
 * httpOnly cookie on the setup's host.
 */
import "server-only";
import { cookies } from "next/headers";
import { newCart, readCart } from "@/api/store";
import type { Cart } from "./types";

export type CartKind = "bag" | "food";
const NAME: Record<CartKind, string> = { bag: "st_bag", food: "st_food" };
const MAX_AGE = 60 * 60 * 24 * 30;

export async function cartIdOf(kind: CartKind): Promise<string | undefined> {
  return (await cookies()).get(NAME[kind])?.value || undefined;
}

/** The visitor's cart, or null (no cookie / cart gone). Safe in Server Components. */
export async function currentCart(kind: CartKind): Promise<Cart | null> {
  const id = await cartIdOf(kind);
  return id ? readCart(id) : null;
}

/** Server Actions only (sets the cookie): the visitor's cart, made when missing. */
export async function ensureCart(kind: CartKind): Promise<Cart> {
  const have = await currentCart(kind);
  if (have?.id) return have;
  const c = await newCart();
  await rememberCart(kind, c.id);
  return c;
}

export async function rememberCart(kind: CartKind, id: string) {
  (await cookies()).set(NAME[kind], id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: MAX_AGE, secure: process.env.NODE_ENV === "production" });
}

export async function forgetCart(kind: CartKind) {
  (await cookies()).delete(NAME[kind]);
}
