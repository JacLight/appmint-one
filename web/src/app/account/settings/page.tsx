import { PageTitle } from "@/components/dashboard-shell";
import { requireSession } from "@/lib/guards";
import { ProfileSettings } from "@/components/account/profile-settings";

export const metadata = { title: "Settings" };

export default async function Page() {
  const session = await requireSession();
  const c: any = session.customer ?? {};
  return (
    <>
      <PageTitle title="Settings" />
        <ProfileSettings email={c.email ?? ""} firstName={c.firstName} lastName={c.lastName} phone={c.phone} />
    </>
  );
}
