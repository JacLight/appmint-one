import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSetup } from "@/lib/setup";
import { bookingTypes, myBooking } from "@/modules/scheduling/lib/data";
import { isClosed } from "@/modules/scheduling/lib/catalog";
import { MovePicker } from "@/modules/scheduling/components/account/move-picker";

export const metadata: Metadata = { title: "Move to another time" };
type P = Promise<{ id: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Move one of my bookings (POST crm/reservations/reschedule/:id). */
export default async function ReschedulePage({ params, searchParams }: { params: P; searchParams: SP }) {
  const [{ id }, sp, setup] = await Promise.all([params, searchParams, getSetup()]);
  const [detail, types] = await Promise.all([myBooking(id), bookingTypes()]);
  if (!detail) notFound();
  const b = detail.booking;
  if (isClosed(b.status) || Date.parse(b.startTime) <= Date.now()) redirect(`/account/scheduling/${id}`);
  const type = types.find((t) => t.id === b.definitionId);
  if (!type) notFound();
  return (
    <MovePicker cfg={setup.scheduling!} detail={detail} type={type} who={{ id }} base={`/account/scheduling/${id}/reschedule?`}
      back={`/account/scheduling/${id}`} done={`/account/scheduling/${id}?moved=1`} day={one(sp.day)} at={one(sp.at)} />
  );
}
