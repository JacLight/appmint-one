import { redirect } from "next/navigation";

/** The Store's account home moved to /account/orders; older links land there. */
export default function StoreAccountRedirect() {
  redirect("/account/orders");
}
