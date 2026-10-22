import type { Metadata } from "next";
import { getSetup } from "@/lib/setup";
import { WeekView } from "@/modules/scheduling/components/provider/week-view";

const titleOf = (style?: string) => (style === "studio" ? "Week" : style === "firm" ? "Calendar" : "Schedule");

export async function generateMetadata(): Promise<Metadata> {
  return { title: titleOf((await getSetup()).scheduling?.style) };
}

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const [sp, setup] = await Promise.all([searchParams, getSetup()]);
  return <WeekView from={typeof sp.from === "string" ? sp.from : undefined} title={titleOf(setup.scheduling?.style)} base="/provider/schedule" />;
}
