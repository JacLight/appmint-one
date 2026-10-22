import { redirect } from "next/navigation";

/** A trip's page is the live trip screen (map + trip card): /trip/[id]. */
export default async function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/trip/${encodeURIComponent(id)}`);
}
