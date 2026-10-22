import { redirect } from "next/navigation";

/** The module's account path; the banking home lives at /account/banking/home. */
export default function BankingIndex() {
  redirect("/account/banking/home");
}
