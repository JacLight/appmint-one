import { NextResponse, type NextRequest } from "next/server";
import { SETUPS } from "@/setups";
import { SETUP_COOKIE, setupSwitchAllowed } from "@/lib/setup";

/** GET /switch-setup?id=medical — preview another setup on this server (dev / preview only).
 *  id=reset clears the override and goes back to PORTAL_SETUP. */
export async function GET(req: NextRequest) {
  if (!setupSwitchAllowed()) return new NextResponse("Not found", { status: 404 });
  const id = (req.nextUrl.searchParams.get("id") || "").toLowerCase();
  const res = NextResponse.redirect(new URL("/", req.url));
  if (id === "reset") res.cookies.delete(SETUP_COOKIE);
  else if (SETUPS.some((s) => s.id === id)) res.cookies.set(SETUP_COOKIE, id, { path: "/", sameSite: "lax" });
  return res;
}
