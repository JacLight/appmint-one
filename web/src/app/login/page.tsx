import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "@/components/auth/login-form";
import { DevQuickLogin } from "@/components/auth/dev-quick-login";
import { getSetup } from "@/lib/setup";
import { authCopy } from "@/lib/auth-copy";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const setup = await getSetup();
  return (
    <>
      <SiteHeader />
      <LoginForm copy={authCopy(setup)} />
      <DevQuickLogin />
    </>
  );
}
