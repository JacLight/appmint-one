import { requireModule } from "@/lib/guards";

/** LMS routes. They exist only for setups with `lms` on — anywhere else they 404. */
export default async function LmsLayout({ children }: { children: React.ReactNode }) {
  await requireModule("lms");
  return <>{children}</>;
}
