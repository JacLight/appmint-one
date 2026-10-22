"use server";
/**
 * Server actions for the Money screens. Each one goes through the adapter (never
 * straight to an API) and returns a plain result the client can render. In sample
 * mode nothing moves: transfers come back as a sample confirmation.
 */
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getSetup } from "@/lib/setup";
import { isOn } from "@/setups/modules";
import { bank } from "../api/adapter";
import {
  BankError, type BankErrorCode, type Card, type CardLimitsInput, type IdentityFileInput, type IdentityInput, type IdentityView, type MemberLookup, type MoneyRequest, type NewMoneyRequest,
  type NewRecipient, type ReceiveDetails, type Recipient, type RoutingLookup, type StepUpAction, type StepUpChallenge,
  type StepUpProof, type Transfer, type TransferInput, type TransferPreview,
} from "../api/types";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: BankErrorCode; field?: string };

const BASE = "/account/banking";

async function run<T>(fn: () => Promise<T>, revalidate?: string[]): Promise<Result<T>> {
  try {
    const session = await getSession();
    if (!session.signedIn) return { ok: false, error: "Your session ended. Sign in again.", code: "UNAUTHENTICATED" };
    if (!isOn(await getSetup(), "money")) return { ok: false, error: "Banking isn’t available here.", code: "UNAVAILABLE" };
    const data = await fn();
    for (const p of revalidate || []) revalidatePath(p);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof BankError) return { ok: false, error: e.message, code: e.code, field: e.field };
    return { ok: false, error: "Something went wrong on our side. Nothing was sent. Try again in a moment.", code: "UNAVAILABLE" };
  }
}

export async function previewTransferAction(input: TransferInput): Promise<Result<TransferPreview>> {
  return run(async () => (await bank()).previewTransfer(input));
}
export async function submitTransferAction(previewId: string, idempotencyKey: string, proof?: StepUpProof): Promise<Result<Transfer>> {
  return run(async () => (await bank()).submitTransfer(previewId, idempotencyKey, proof), [BASE]);
}
export async function startStepUpAction(action: StepUpAction): Promise<Result<StepUpChallenge>> {
  return run(async () => (await bank()).startStepUp(action));
}

export async function lookupRoutingAction(routingNumber: string): Promise<Result<RoutingLookup>> {
  return run(async () => (await bank()).lookupRouting(routingNumber));
}
export async function lookupMemberAction(query: string): Promise<Result<MemberLookup>> {
  return run(async () => (await bank()).lookupMember(query));
}
export async function addRecipientAction(input: NewRecipient, proof?: StepUpProof): Promise<Result<Recipient>> {
  return run(async () => (await bank()).addRecipient(input, proof), [`${BASE}/recipients`]);
}
export async function updateRecipientAction(id: string, nickname: string): Promise<Result<Recipient>> {
  return run(async () => (await bank()).updateRecipient(id, { nickname }), [`${BASE}/recipients`]);
}
export async function removeRecipientAction(id: string): Promise<Result<true>> {
  return run(async () => { await (await bank()).removeRecipient(id); return true as const; }, [`${BASE}/recipients`]);
}

export async function revealAccountNumberAction(accountId: string, proof: StepUpProof): Promise<Result<ReceiveDetails>> {
  return run(async () => (await bank()).receiveDetails(accountId, proof));
}

export async function createRequestAction(input: NewMoneyRequest): Promise<Result<MoneyRequest>> {
  return run(async () => (await bank()).createRequest(input), [`${BASE}/request`]);
}
export async function cancelRequestAction(id: string): Promise<Result<MoneyRequest>> {
  return run(async () => (await bank()).cancelRequest(id), [`${BASE}/request`]);
}
export async function declineRequestAction(id: string): Promise<Result<MoneyRequest>> {
  return run(async () => (await bank()).declineRequest(id), [`${BASE}/request`]);
}
export async function payRequestAction(id: string, fromAccountId: string, idempotencyKey: string, proof?: StepUpProof): Promise<Result<Transfer>> {
  return run(async () => (await bank()).payRequest(id, fromAccountId, idempotencyKey, proof), [`${BASE}/request`]);
}

export async function freezeCardAction(id: string, frozen: boolean): Promise<Result<Card>> {
  return run(async () => (frozen ? (await bank()).freezeCard(id) : (await bank()).unfreezeCard(id)), [`${BASE}/cards`, `${BASE}/home`]);
}
export async function setCardLimitsAction(id: string, input: CardLimitsInput, proof: StepUpProof): Promise<Result<Card>> {
  return run(async () => (await bank()).setCardLimits(id, input, proof), [`${BASE}/cards`]);
}

export async function submitIdentityAction(input: IdentityInput): Promise<Result<IdentityView>> {
  return run(async () => (await bank()).submitIdentity(input), [`${BASE}/identity`, `${BASE}/home`]);
}
export async function attachIdentityFileAction(input: IdentityFileInput): Promise<Result<IdentityView>> {
  return run(async () => (await bank()).attachIdentityFile(input), [`${BASE}/identity`]);
}
