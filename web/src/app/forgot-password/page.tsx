import { SiteHeader } from "@/components/site-header";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <SiteHeader />
      <ForgotPasswordForm />
    </>
  );
}
