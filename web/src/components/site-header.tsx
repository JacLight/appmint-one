import { getSession } from "@/lib/auth";
import { getResolvedSetup } from "@/lib/setup";
import { headerModel } from "@/lib/chrome";
import { HeaderBar } from "./header-bar";

/** Session-aware top bar, driven by the active setup. Delegates to the client
 *  HeaderBar so it can react to the route (customer vs provider mode). */
export async function SiteHeader() {
  const [session, resolved] = await Promise.all([getSession(), getResolvedSetup()]);
  const fallback = resolved.isFallback && process.env.NODE_ENV !== "production" ? resolved.requestedId : undefined;
  return (
    <>
      {fallback && (
        <div className="setup-fallback" role="status">
          PORTAL_SETUP=&quot;{fallback}&quot; is not a known setup — showing the demo setup.
        </div>
      )}
      <HeaderBar model={headerModel(resolved.setup)} signedIn={session.signedIn} host={session.host} email={session.customer?.email ?? ""} />
    </>
  );
}
