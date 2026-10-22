export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getOAuthUrl } from "@/lib/oauth";

export default async function FacebookAuth() {
  redirect(await getOAuthUrl("facebook"));
}
