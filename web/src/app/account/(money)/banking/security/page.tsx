import { usesEngineBanking } from "@/modules/money/api/adapter";
import { BankSecurityPanel } from "@/modules/money/components/bank-security-panel";
export default function BankingSecurityPage() { return <><h1>Banking security</h1>{usesEngineBanking() ? <BankSecurityPanel /> : <p>Contact your bank about security settings for this connection.</p>}</>; }
