import type { Metadata } from "next";
import { requireSession } from "@/lib/guards";
import { MyLearning } from "@/modules/lms/components/my-learning";

export const metadata: Metadata = { title: "My learning" };

/** My courses, inside the account shell: a big "continue" card for the course in
 *  progress, then the rest, split In progress / Completed. Reads client/content-studio. */
export default async function MyLearningPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireSession();
  const { tab } = await searchParams;
  return <MyLearning tab={tab === "completed" ? "completed" : "progress"} />;
}
