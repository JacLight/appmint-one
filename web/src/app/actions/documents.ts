"use server";

import { revalidatePath } from "next/cache";
import { documents } from "@/lib/documents";
import { getErrorMessage } from "@/lib/errors";

export async function deleteDocumentAction(path: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!path || path.includes("..")) return { ok: false, error: "That file can't be removed." };
    await documents.remove(path);
    revalidatePath("/account/documents");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not remove the file.") };
  }
}
