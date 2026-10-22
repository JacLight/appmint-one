"use server";
/**
 * The Content Player's calls, for the browser runtime (player/namespace.ts). Each one
 * returns the engine's answer, or its refusal as a value (status + body) so the ported
 * base-app logic can act on it as it did on a thrown transport error: 401 → sign in,
 * 403 "enroll" → enroll and retry.
 */
import { revalidatePath } from "next/cache";
import { answerCourseItem, applyForBenefit, enrollInCourse, reportCourseProgress } from "@/api/content";

export type PlayerResult<T = any> = { ok: true; data: T } | { ok: false; status?: number; message: string; details?: unknown };

async function run<T>(call: () => Promise<T>, touched?: string): Promise<PlayerResult<T>> {
  try {
    const data = await call();
    if (touched) { revalidatePath("/account/learning"); revalidatePath(`/learn/${touched}`, "layout"); }
    return { ok: true, data };
  } catch (e: any) {
    const status = e?.response?.status ?? e?.status ?? e?.statusCode;
    const details = e?.response?.data ?? e?.data;
    const body = details && typeof details.error === "object" && details.error ? details.error : details;
    const message = (typeof body?.message === "string" && body.message) || (typeof body?.error === "string" && body.error) || e?.message || "That could not be saved.";
    return { ok: false, status, message, details };
  }
}

export async function playerEnroll(course: string, code?: string) {
  return run(() => enrollInCourse(course, code || undefined), course);
}
export async function playerProgress(course: string, item: string, body: { done?: boolean; percent?: number; score?: number }, code?: string) {
  return run(() => reportCourseProgress(course, item, body, code || undefined), body.done ? course : undefined);
}
export async function playerAnswer(course: string, item: string, values: Record<string, any>, done: boolean, code?: string) {
  return run(() => answerCourseItem(course, item, { values, done }, code || undefined), course);
}
export async function playerApplyBenefit(body: { benefit: string; formData?: Record<string, any>; agreementAccepted: boolean }) {
  return run(() => applyForBenefit(body));
}
