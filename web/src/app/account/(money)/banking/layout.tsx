import { getSession } from "@/lib/auth";
import { runtimeEnv } from "@/lib/runtime-env";
import { BankVerificationProvider } from "@/modules/money/components/bank-verification";
import { requireModule } from "@/lib/guards";
import { getSetup } from "@/lib/setup";
import { bankingMode } from "@/modules/money/api/adapter";
import { NotAvailable, SampleBanner } from "@/modules/money/components/bits";
import { BankTabBar } from "@/modules/money/components/tab-bar";

/** Money module (signed-in banking). Exists only where `money` is on. The account
 *  layout above already requires a session. Sample mode → banner on every screen;
 *  production with no banking API → "Not available yet". */
export default async function BankingLayout({ children }: { children: React.ReactNode }) {
  await requireModule("money");
  const setup = await getSetup();
  const mode = bankingMode();
  const session = await getSession();
  const scope = JSON.stringify([runtimeEnv("ORG_ID"), session.customer?.id]);
  return (
    <BankVerificationProvider key={scope} scope={scope}><div className="mn">
      {mode === "sample" && <SampleBanner />}
      {mode === "unavailable" ? <NotAvailable brand={setup.brand.name} /> : children}
      {setup.homeModule === "money" && <BankTabBar />}
    </div></BankVerificationProvider>
  );
}
