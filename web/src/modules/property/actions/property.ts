"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import { getSetup } from "@/lib/setup";
import * as R from "@/api/reservations";
import * as P from "@/api/property";
import { findHome } from "../lib/homes";
import { myTenancy } from "../lib/resident";

type Fail = { ok: false; error: string; signIn?: boolean };

const clean = (v: any, max = 2000) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max);

/**
 * Send a rental application, or a commercial lease application when the unit is a
 * commercial space (its own CRM form, business answers instead of household ones). The home is looked up again here, so the unit, its title
 * and the posted rent on the application are the listing's, not what the page sent.
 * Documents were uploaded to the applicant's own files first; only their paths come in.
 */
export async function applyAction(unitId: string, answers: Record<string, string>, documents: string[]): Promise<{ ok: true } | Fail> {
  const session = await getSession();
  if (!session.signedIn || !session.customer?.email) return { ok: false, error: "Sign in to apply.", signIn: true };
  const cfg = (await getSetup()).property;
  if (!cfg) return { ok: false, error: "Applications are not open here." };
  const found = await findHome(cfg, unitId);
  const unit = found?.unit;
  if (!found || !unit) return { ok: false, error: "That listing is no longer available." };
  if (!unit.available) return { ok: false, error: "That space has just been leased. Have a look at what else is available." };

  const biz = unit.segment === "commercial";
  if (biz && !cfg.commercial) return { ok: false, error: "Commercial applications are not open here." };
  const a: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers || {})) a[k] = clean(v);
  const required = biz
    ? ["companyName", "entityType", "firstName", "lastName", "signerTitle", "phone", "moveIn", "leaseTerm", "use", "headcount", "yearsInBusiness", "annualRevenue", "guarantor"]
    : ["firstName", "lastName", "phone", "moveIn", "leaseTerm", "monthlyIncome"];
  for (const k of required) {
    if (!a[k]) return { ok: false, error: "Some required answers are missing. Go back and check each step." };
  }
  try {
    await R.submitForm(biz ? cfg.commercial!.form : cfg.applicationForm, {
      ...a,
      email: session.customer.email,
      unitId: unit.id,
      unitTitle: unit.title,
      homeId: found.home.id,
      homeTitle: found.home.title,
      rent: unit.rent ?? "",
      ...(biz ? { segment: "commercial", sqft: unit.sqft ?? "", ratePsf: unit.ratePsf ?? "", leaseType: unit.leaseType || "" } : {}),
      documents: (documents || []).map((d) => clean(d, 300)).filter(Boolean).slice(0, 12),
      consent: a.consent === "yes" ? "yes" : "",
    });
    revalidatePath("/account/applications");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "We couldn’t send your application. Please try again.") };
  }
}

/**
 * Send a repair request. The engine files it under the signed-in resident with status
 * "new" and starts the org's ticket workflow, which is where the response clock runs.
 */
export async function requestRepairAction(input: {
  category: string; area: string; title: string; description: string; urgency: string;
  permissionToEnter: string; petsInHome: string; bestTimes: string; photos: string[];
}): Promise<{ ok: true; number: string } | Fail> {
  const session = await getSession();
  if (!session.signedIn) return { ok: false, error: "Sign in to send a request.", signIn: true };
  const cfg = (await getSetup()).property;
  if (!cfg) return { ok: false, error: "Requests are not open here." };
  const title = clean(input.title, 200);
  const description = clean(input.description, 5000);
  if (!title || !description) return { ok: false, error: "Tell us what’s wrong and where." };
  const cat = cfg.requestCategories.find((c) => c.id === input.category);
  const tenancy = await myTenancy(cfg).catch(() => null);
  try {
    const t = await P.createTicket({
      title: cat ? `${cat.label}: ${title}` : title,
      description,
      category: cat?.id || "other",
      area: clean(input.area, 60),
      urgency: input.urgency === "urgent" ? "urgent" : "routine",
      permissionToEnter: input.permissionToEnter === "no" ? "no" : "yes",
      petsInHome: clean(input.petsInHome, 200),
      bestTimes: clean(input.bestTimes, 300),
      photos: (input.photos || []).map((p) => clean(p, 300)).filter(Boolean).slice(0, 6),
      unitId: tenancy?.unit.id || "",
      unitTitle: tenancy?.unit.title || "",
      homeTitle: tenancy?.home.title || "",
      reportedByPhone: clean(session.customer?.phone, 40),
    });
    revalidatePath("/account/requests");
    revalidatePath("/account/home");
    return { ok: true, number: String(t?.data?.name || "") };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "We couldn’t send your request. Please try again, or call the office.") };
  }
}

/** Ask to join the building's notice board; the office approves residents. */
export async function joinBoardAction(pageId: string): Promise<{ ok: true } | Fail> {
  const session = await getSession();
  if (!session.signedIn) return { ok: false, error: "Sign in first.", signIn: true };
  try {
    await P.joinBoard(pageId);
    revalidatePath("/account/notices");
    revalidatePath("/account/home");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "We couldn’t send that. Please try again.") };
  }
}
