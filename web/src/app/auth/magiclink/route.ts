import { NextRequest, NextResponse } from "next/server";
import { auth, isAuthSuccess } from "@/lib/auth";
import { setSessionCookies } from "@/lib/session";
import { publicBaseUrl } from "@/lib/req-url";

/** Landing for the emailed magic LINK: /auth/magiclink?email=&token= → verify → session → dashboard. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const base = publicBaseUrl(request); // NOT request.url — that's the internal 0.0.0.0:3000 host
  const email = url.searchParams.get("email");
  const token = url.searchParams.get("token");
  if (!email || !token) {
    return NextResponse.redirect(new URL("/login?error=Invalid+magic+link", base));
  }
  try {
    const res = await auth.magicVerify({ email, token });
    if (isAuthSuccess(res)) {
      await setSessionCookies(res.token, res.refreshToken);
      return NextResponse.redirect(new URL("/account", base));
    }
    return NextResponse.redirect(new URL("/login?error=Magic+link+expired+or+used", base));
  } catch {
    return NextResponse.redirect(new URL("/login?error=Could+not+verify+magic+link", base));
  }
}
