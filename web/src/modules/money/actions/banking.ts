"use server";
/**
 * Server actions for the Money screens. Each one goes through the adapter (never
 * straight to an API) and returns a plain result the client can render. In sample
 * mode nothing moves: transfers come back as a sample confirmation.
 */
import { apiReq } from "@/lib/api";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getSetup } from "@/lib/setup";
import { isOn } from "@/setups/modules";
import { bank } from "../api/adapter";
import {
  BankError,
  type BankErrorCode,
  type Card,
  type CardLimitsInput,
  type IdentityFileInput,
  type IdentityInput,
  type IdentityView,
  type MemberLookup,
  type MoneyRequest,
  type NewMoneyRequest,
  type NewRecipient,
  type ReceiveDetails,
  type Recipient,
  type RoutingLookup,
  type StepUpAction,
  type StepUpChallenge,
  type StepUpProof,
  type Transfer,
  type TransferInput,
  type TransferPreview,
} from "../api/types";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: BankErrorCode; field?: string };

const BASE = "/account/banking";

async function run<T>(
  fn: () => Promise<T>,
  revalidate?: string[]
): Promise<Result<T>> {
  try {
    const session = await getSession();
    if (!session.signedIn)
      return {
        ok: false,
        error: "Your session ended. Sign in again.",
        code: "UNAUTHENTICATED",
      };
    if (!isOn(await getSetup(), "money"))
      return {
        ok: false,
        error: "Banking isn’t available here.",
        code: "UNAVAILABLE",
      };
    const data = await fn();
    for (const p of revalidate || []) revalidatePath(p);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof BankError)
      return { ok: false, error: e.message, code: e.code, field: e.field };
    return {
      ok: false,
      error:
        "We couldn’t confirm the result. Check your activity before trying again.",
      code: "UNAVAILABLE",
    };
  }
}

export async function previewTransferAction(
  input: TransferInput
): Promise<Result<TransferPreview>> {
  return run(async () => (await bank()).previewTransfer(input));
}
export async function submitTransferAction(
  previewId: string,
  idempotencyKey: string,
  proof?: StepUpProof
): Promise<Result<Transfer>> {
  return run(
    async () => (await bank()).submitTransfer(previewId, idempotencyKey, proof),
    [BASE]
  );
}
export async function startStepUpAction(
  action: StepUpAction
): Promise<Result<StepUpChallenge>> {
  return run(async () => (await bank()).startStepUp(action));
}

export async function lookupRoutingAction(
  routingNumber: string
): Promise<Result<RoutingLookup>> {
  return run(async () => (await bank()).lookupRouting(routingNumber));
}
export async function lookupMemberAction(
  query: string
): Promise<Result<MemberLookup>> {
  return run(async () => (await bank()).lookupMember(query));
}
export async function addRecipientAction(
  input: NewRecipient,
  proof?: StepUpProof
): Promise<Result<Recipient>> {
  return run(
    async () => (await bank()).addRecipient(input, proof),
    [`${BASE}/recipients`]
  );
}
export async function updateRecipientAction(
  id: string,
  nickname: string
): Promise<Result<Recipient>> {
  return run(
    async () => (await bank()).updateRecipient(id, { nickname }),
    [`${BASE}/recipients`]
  );
}
export async function removeRecipientAction(id: string): Promise<Result<true>> {
  return run(async () => {
    await (await bank()).removeRecipient(id);
    return true as const;
  }, [`${BASE}/recipients`]);
}

export async function revealAccountNumberAction(
  accountId: string,
  proof: StepUpProof
): Promise<Result<ReceiveDetails>> {
  return run(async () => (await bank()).receiveDetails(accountId, proof));
}

export async function createRequestAction(
  input: NewMoneyRequest
): Promise<Result<MoneyRequest>> {
  return run(
    async () => (await bank()).createRequest(input),
    [`${BASE}/request`]
  );
}
export async function cancelRequestAction(
  id: string
): Promise<Result<MoneyRequest>> {
  return run(async () => (await bank()).cancelRequest(id), [`${BASE}/request`]);
}
export async function declineRequestAction(
  id: string
): Promise<Result<MoneyRequest>> {
  return run(
    async () => (await bank()).declineRequest(id),
    [`${BASE}/request`]
  );
}
export async function payRequestAction(
  id: string,
  fromAccountId: string,
  idempotencyKey: string,
  proof?: StepUpProof
): Promise<Result<Transfer>> {
  return run(
    async () =>
      (await bank()).payRequest(id, fromAccountId, idempotencyKey, proof),
    [`${BASE}/request`]
  );
}

export async function freezeCardAction(
  id: string,
  frozen: boolean
): Promise<Result<Card>> {
  return run(
    async () =>
      frozen ? (await bank()).freezeCard(id) : (await bank()).unfreezeCard(id),
    [`${BASE}/cards`, `${BASE}/home`]
  );
}
export async function setCardLimitsAction(
  id: string,
  input: CardLimitsInput,
  proof: StepUpProof
): Promise<Result<Card>> {
  return run(
    async () => (await bank()).setCardLimits(id, input, proof),
    [`${BASE}/cards`]
  );
}

export async function submitIdentityAction(
  input: IdentityInput
): Promise<Result<IdentityView>> {
  return run(
    async () => (await bank()).submitIdentity(input),
    [`${BASE}/identity`, `${BASE}/home`]
  );
}
export async function attachIdentityFileAction(
  input: IdentityFileInput
): Promise<Result<IdentityView>> {
  return run(
    async () => (await bank()).attachIdentityFile(input),
    [`${BASE}/identity`]
  );
}

async function servicing<T>(
  call: (api: Awaited<ReturnType<typeof bank>>) => Promise<T>
): Promise<Result<T>> {
  return run(async () => call(await bank()), [BASE]);
}
export async function fileDisputeAction(input: {
  transaction: string;
  reason: string;
  description: string;
}) {
  return servicing(async (api) => {
    if (!api.fileDispute)
      throw new BankError(
        "UNAVAILABLE",
        "Disputes are unavailable in this connection."
      );
    return api.fileDispute(input);
  });
}
export async function withdrawDisputeAction(id: string, verification?: Record<string, unknown>) {
  return servicing(async (api) => {
    if (!api.withdrawDispute)
      throw new BankError(
        "UNAVAILABLE",
        "Disputes are unavailable in this connection."
      );
    return api.withdrawDispute(id, verification);
  });
}
export async function cancelTransactionAction(id: string, verification?: Record<string, unknown>) {
  return servicing(async (api) => {
    if (!api.cancelTransaction)
      throw new BankError(
        "UNAVAILABLE",
        "Cancellation is unavailable in this connection."
      );
    return api.cancelTransaction(id, verification);
  });
}
export async function withdrawLoanApplicationAction(id: string) {
  return servicing(async (api) => {
    if (!api.withdrawLoanApplication)
      throw new BankError(
        "UNAVAILABLE",
        "Loan servicing is unavailable in this connection."
      );
    return api.withdrawLoanApplication(id);
  });
}
export async function answerLoanCounterofferAction(
  id: string,
  accept: boolean
) {
  return servicing(async (api) => {
    if (!api.answerLoanCounteroffer)
      throw new BankError(
        "UNAVAILABLE",
        "Loan servicing is unavailable in this connection."
      );
    return api.answerLoanCounteroffer(id, accept);
  });
}
export async function applyForLoanAction(input: Record<string, unknown>) {
  return servicing(async (api) => {
    if (!api.applyForLoan)
      throw new BankError(
        "UNAVAILABLE",
        "Loan applications are unavailable in this connection."
      );
    return api.applyForLoan(input);
  });
}
export async function payLoanAction(
  id: string,
  input: { from: string; amount: number; idempotencyKey: string; bankingProof?: string }
) {
  return servicing(async (api) => {
    if (!api.payLoan)
      throw new BankError(
        "UNAVAILABLE",
        "Loan payments are unavailable in this connection."
      );
    return api.payLoan(id, input);
  });
}

export async function startPayeeVerificationAction(id: string) {
  return servicing(async (api) => {
    if (!api.startPayeeVerification)
      throw new BankError(
        "UNAVAILABLE",
        "Payee verification is unavailable in this connection."
      );
    return api.startPayeeVerification(id);
  });
}
export async function confirmPayeeVerificationAction(
  id: string,
  amounts: number[]
) {
  return servicing(async (api) => {
    if (!api.confirmPayeeVerification)
      throw new BankError(
        "UNAVAILABLE",
        "Payee verification is unavailable in this connection."
      );
    return api.confirmPayeeVerification(id, amounts);
  });
}

export async function setPersonalCardLimitsAction(
  id: string,
  controls: Record<string, number | null>
) {
  return servicing(async (api) => {
    if (!api.setPersonalCardLimits)
      throw new BankError(
        "UNAVAILABLE",
        "Personal limits are unavailable in this connection."
      );
    return api.setPersonalCardLimits(id, controls);
  });
}

export async function updateLoanApplicationAction(
  id: string,
  changes: Record<string, unknown>
) {
  return servicing(async (api) => {
    if (!api.updateLoanApplication)
      throw new BankError(
        "UNAVAILABLE",
        "Application corrections are unavailable in this connection."
      );
    return api.updateLoanApplication(id, changes);
  });
}
export async function attachLoanDocumentAction(
  id: string,
  input: { path: string; kind?: string; note?: string }
) {
  return servicing(async (api) => {
    if (!api.attachLoanDocument)
      throw new BankError(
        "UNAVAILABLE",
        "Document submission is unavailable in this connection."
      );
    return api.attachLoanDocument(id, input);
  });
}
export async function respondToLoanConditionAction(
  id: string,
  index: number,
  input: {
    text?: string;
    documents?: { path: string; kind?: string; note?: string }[];
  }
) {
  return servicing(async (api) => {
    if (!api.respondToLoanCondition)
      throw new BankError(
        "UNAVAILABLE",
        "Condition responses are unavailable in this connection."
      );
    return api.respondToLoanCondition(id, index, input);
  });
}

export async function openBankAccountAction(input: {
  product: string;
  nickname?: string;
  business?: Record<string, unknown>;
}) {
  return servicing(async (api) => {
    if (!api.openBankAccount)
      throw new BankError(
        "UNAVAILABLE",
        "Account opening is unavailable in this connection."
      );
    return api.openBankAccount(input);
  });
}
export async function renameBankAccountAction(id: string, nickname: string) {
  return servicing(async (api) => {
    if (!api.renameBankAccount)
      throw new BankError(
        "UNAVAILABLE",
        "Account settings are unavailable in this connection."
      );
    return api.renameBankAccount(id, nickname);
  });
}
export async function setBankOverdraftAction(id: string, optedIn: boolean) {
  return servicing(async (api) => {
    if (!api.setBankOverdraft)
      throw new BankError(
        "UNAVAILABLE",
        "Account settings are unavailable in this connection."
      );
    return api.setBankOverdraft(id, optedIn);
  });
}
export async function orderBankCardAction(
  id: string,
  input: { form: string; shipping?: Record<string, unknown> }
) {
  return servicing(async (api) => {
    if (!api.orderBankCard)
      throw new BankError(
        "UNAVAILABLE",
        "Card ordering is unavailable in this connection."
      );
    return api.orderBankCard(id, input);
  });
}
export async function activateBankCardAction(id: string, last4: string) {
  return servicing(async (api) => {
    if (!api.activateBankCard)
      throw new BankError(
        "UNAVAILABLE",
        "Card activation is unavailable in this connection."
      );
    return api.activateBankCard(id, last4);
  });
}
export async function replaceBankCardAction(
  id: string,
  why: string,
  shipping?: Record<string, unknown>
) {
  return servicing(async (api) => {
    if (!api.replaceBankCard)
      throw new BankError(
        "UNAVAILABLE",
        "Card replacement is unavailable in this connection."
      );
    return api.replaceBankCard(id, why, shipping);
  });
}

// Existing session/module guard and transport; enrollment remains the platform security flow.
export async function bankSecurityReviewAction(operation: string, request: Record<string, unknown>, previewId?: string) {
  return run<any>(async () => { const api: any = await bank(); return previewId ? api.bankPortalReview ? api.bankPortalReview(previewId, request.bankingProof) : { required: false } : api.bankSecurityReview ? api.bankSecurityReview(operation, request) : { required: false }; });
}
export async function bankSecurityVerifyAction(challengeId: string, code: string) { return run<any>(async () => (await bank() as any).bankSecurityVerify(challengeId, code)); }
export async function bankSecurityStatusAction() { return run<any>(async () => (await bank() as any).bankSecurityStatus()); }
export async function bankSecuritySetupAction() { return run<any>(() => apiReq("POST", "profile/security/2fa/setup/authenticator", { data: {} })); }
export async function bankSecurityConfirmSetupAction(code: string) { return run<any>(() => apiReq("POST", "profile/security/2fa/verify-setup", { data: { code } })); }
export async function bankSecurityRotateAction(request: Record<string, unknown>) { return run<any>(async () => (await bank() as any).bankSecurityRotate(request)); }

export async function bankAutopayStatusAction(loanId: string) { return run<any>(async () => { const api: any = await bank(); return api.bankAutopay ? api.bankAutopay(loanId) : { available: false, status: "off" }; }); }
export async function bankAutopayChangeAction(action: "agreement" | "confirm" | "revoke", loanId: string, request: Record<string, unknown>) { return run<any>(async () => { if (!["agreement", "confirm", "revoke"].includes(action)) throw new BankError("UNAVAILABLE", "Unsupported instruction."); return (await bank() as any).bankAutopayAction(action, loanId, request); }, [`${BASE}/loans/${loanId}`]); }

export async function bankReceivingStatusAction() { return run<any>(async () => (await bank() as any).bankReceivingStatus()); }
export async function bankReceivingUpdateAction(request: Record<string, unknown>) { return run<any>(async () => (await bank() as any).bankReceivingUpdate(request)); }
export async function bankMemberResolveAction(username: string) { return run<any>(async () => (await bank() as any).bankMemberResolve(username)); }
export async function bankRequestsListAction(direction: "incoming" | "outgoing", page = 1) { return run<any>(async () => (await bank() as any).bankRequestsList(direction, page)); }
export async function bankRequestGetAction(id: string, token?: string) { return run<any>(async () => (await bank() as any).bankRequestGet(id, token)); }
export async function bankRequestCreateAction(request: Record<string, unknown>) { return run<any>(async () => (await bank() as any).bankRequestCreate(request)); }
export async function bankRequestCloseAction(id: string, action: "cancel" | "decline") { return run<any>(async () => { if (!["cancel", "decline"].includes(action)) throw new BankError("UNAVAILABLE", "Unsupported request change."); return (await bank() as any).bankRequestClose(id, action); }); }
export async function bankRequestShareAction(id: string) { return run<any>(async () => (await bank() as any).bankRequestShare(id)); }
export async function bankRequestPreviewAction(request: Record<string, unknown>) { return run<any>(async () => (await bank() as any).bankRequestPreview(request)); }
export async function bankMemberPreviewAction(request: Record<string, unknown>) { return run<any>(async () => (await bank() as any).bankMemberPreview(request)); }
