import { requireModule } from "@/lib/guards";

/** Money module public routes — only where `money` is on. */
export default async function MoneyLayout({ children }: { children: React.ReactNode }) {
  await requireModule("money");
  return <>{children}</>;
}
