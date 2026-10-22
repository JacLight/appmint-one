import { SiteHeader } from "@/components/site-header";
import { SignupForm } from "@/components/auth/signup-form";
import { getSetup } from "@/lib/setup";
import { authCopy } from "@/lib/auth-copy";

export const metadata = { title: "Create your account" };

export default async function SignupPage() {
  const setup = await getSetup();
  return (
    <>
      <SiteHeader />
      <SignupForm copy={authCopy(setup)} />
    </>
  );
}
