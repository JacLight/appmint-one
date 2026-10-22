"use server";

import { revalidatePath } from "next/cache";
import { community, type SendMessageInput } from "@/lib/community";
import { getErrorMessage } from "@/lib/errors";

export type SendResult = { ok: true } | { ok: false; error: string };

/** Send a message to a host/guest by email (or sk). Threads are implicit. */
export async function sendMessageAction(input: SendMessageInput): Promise<SendResult> {
  if (!input.recipientId) return { ok: false, error: "No recipient for this conversation." };
  if (!input.content?.trim()) return { ok: false, error: "Type a message first." };
  try {
    await community.send({ ...input, content: input.content.trim() });
    revalidatePath("/host/messages");
    revalidatePath("/account/messages");
    revalidatePath(`/host/messages/${encodeURIComponent(input.recipientId)}`);
    revalidatePath(`/account/messages/${encodeURIComponent(input.recipientId)}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not send the message.") };
  }
}

export async function markThreadReadAction(otherUser: string): Promise<void> {
  try { await community.markThreadRead(otherUser); } catch { /* non-critical */ }
}
