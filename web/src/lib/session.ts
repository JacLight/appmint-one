import { cookies } from "next/headers";

const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Write the customer JWT into the `token` cookie the connector forwards as x-client-authorization. */
export async function setSessionCookies(token: string, refreshToken?: string) {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const opts = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: MAX_AGE };
  jar.set("token", token, opts);
  if (refreshToken) jar.set("refreshToken", refreshToken, opts);
}

export async function clearSessionCookies() {
  const jar = await cookies();
  jar.delete("token");
  jar.delete("refreshToken");
}
