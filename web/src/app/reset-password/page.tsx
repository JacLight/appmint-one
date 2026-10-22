import { SiteHeader } from "@/components/site-header";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <SiteHeader />
      <ResetPasswordForm token={typeof token === "string" ? token : ""} />
    </>
  );
}
