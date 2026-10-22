import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSetup } from "@/lib/setup";
import { bankingMode, load } from "@/modules/money/api/adapter";
import type { TransferKind } from "@/modules/money/api/types";
import { BankHead, ErrorPanel } from "@/modules/money/components/bits";
import { SendFlow } from "@/modules/money/components/send-flow";
import { SendAside } from "@/modules/money/components/send-aside";

const KINDS: TransferKind[] = ["external", "internal", "own"];

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  const k = (await params).kind;
  return { title: k === "own" ? "Move money" : "Send money" };
}

export default async function SendKindPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ to?: string; from?: string; amount?: string }> }) {
  const [{ kind }, sp, setup] = await Promise.all([params, searchParams, getSetup()]);
  if (!KINDS.includes(kind as TransferKind)) notFound();
  const k = kind as TransferKind;
  const [accounts, recipients, options] = await Promise.all([
    load((b) => b.listAccounts()),
    k === "own" ? Promise.resolve({ ok: true as const, data: [] }) : load((b) => b.listRecipients(k as "external" | "internal")),
    load((b) => b.transferOptions(k)),
  ]);
  return (
    <>
      <BankHead title={k === "own" ? "Move money" : "Send money"} back={{ href: "/account/banking/send", label: "All ways to send" }} />
      {!accounts.ok ? <ErrorPanel error={accounts.error} /> : !recipients.ok ? <ErrorPanel error={recipients.error} /> : (
        <div className="mn-sendgrid">
          <SendFlow kind={k} bank={setup.brand.name} sample={bankingMode() === "sample"} accounts={accounts.data.items} recipients={recipients.data}
            speeds={options.ok ? options.data.speeds : undefined} initialTo={sp.to} initialFrom={sp.from} initialAmount={sp.amount} />
          {options.ok && <SendAside options={options.data} />}
        </div>
      )}
    </>
  );
}
