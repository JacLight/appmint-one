export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getOAuthUrl } from "@/lib/oauth";

export default async function GoogleAuth() {
  redirect(await getOAuthUrl("google"));
}
