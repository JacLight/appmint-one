import "./tokens.css";
import "./storefront.css";
import { getSession } from "@/lib/auth";
import { StoreSession } from "./components/store-session";
import { Toaster } from "./shims/sonner";

/** Wraps the ported base-app storefront: the token map (tokens.css), the signed-in
 *  customer for its activeSession, and the toast line its `toast()` calls show in. */
export async function StoreShell({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const c = s.signedIn ? s.customer : undefined;
  return (
    <div className="sf-store">
      <StoreSession user={c ? { id: c.id, email: c.email, firstName: c.firstName, lastName: c.lastName, phone: c.phone } : null} />
      {children}
      <Toaster />
    </div>
  );
}

/** What base-app's Checkout prefills from (its `userData` prop). */
export async function checkoutUser() {
  const s = await getSession();
  const c = s.signedIn ? s.customer : undefined;
  return c ? { email: c.email, firstName: c.firstName || "", lastName: c.lastName || "", phone: c.phone || "", name: [c.firstName, c.lastName].filter(Boolean).join(" ") } : undefined;
}
