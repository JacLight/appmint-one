import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSetup } from "@/lib/setup";
import { getSession } from "@/lib/auth";
import { bookingForm, bookingTypes, myBooking } from "@/modules/scheduling/lib/data";
import { Empty, Ic } from "@/modules/scheduling/components/bits";
import { IntakeForm, type Field } from "@/modules/scheduling/components/account/intake-form";

export const metadata: Metadata = { title: "Your form" };
type P = Promise<{ id: string }>;

function fieldsOf(schema: any): Field[] {
  const props = schema?.properties || {};
  const req: string[] = Array.isArray(schema?.required) ? schema.required : [];
  return Object.entries<any>(props).filter(([, p]) => !p?.hidden && !p?.readOnly).map(([name, p]) => ({
    name,
    title: String(p?.title || name),
    required: req.includes(name),
    type: p?.type === "boolean" ? "checkbox" : Array.isArray(p?.enum) ? "select" : p?.format === "date" ? "date" : p?.format === "email" ? "email" : p?.["x-control-variant"] === "textarea" ? "textarea" : "text",
    options: Array.isArray(p?.enum) ? p.enum.map(String) : undefined,
  }));
}

/** The booking type's form (the definition's `form`), from client/forms/:name. */
export default async function IntakePage({ params }: { params: P }) {
  const [{ id }, setup, session] = await Promise.all([params, getSetup(), getSession()]);
  const [detail, types] = await Promise.all([myBooking(id), bookingTypes()]);
  if (!detail) notFound();
  const type = types.find((t) => t.id === detail.booking.definitionId);
  const name = type?.form;
  const form = name ? await bookingForm(name) : null;
  const fields = fieldsOf(form?.schema);
  const c = session.customer;
  const initial: Record<string, any> = { email: c?.email, fullName: [c?.firstName, c?.lastName].filter(Boolean).join(" "), phone: c?.phone || "" };
  return (
    <div className="mv">
      <Link href={`/account/scheduling/${id}`} className="bt-back"><Ic n="back" size={16} /> Back</Link>
      <h1 className="mv-h">{form?.title || "Your form"}</h1>
      {form?.description && <p className="cv-quiet">{form.description}</p>}
      {fields.length && name ? (
        <IntakeForm bookingId={id} form={name} fields={fields} initial={initial} />
      ) : (
        <Empty title="This form isn’t online yet">{setup.scheduling?.place.phone ? `We’ll go through it with you at the front desk, or call ${setup.scheduling.place.phone}.` : "We’ll go through it with you when you arrive."}</Empty>
      )}
    </div>
  );
}
