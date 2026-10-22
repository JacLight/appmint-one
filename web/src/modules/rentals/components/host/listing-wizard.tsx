"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createListingAction } from "@/modules/rentals/actions/host";
import { Alert } from "@/components/alert";
import { routes } from "@/lib/nav";
import { STORAGE_CLASSES } from "@/modules/rentals/lib/classes";

const TYPES = STORAGE_CLASSES.map((c) => ({ v: c.slug, label: c.label }));
const FEATURES = ["Indoor", "Covered", "Climate controlled", "Gated", "CCTV", "Drive-up", "24/7 access", "Ground floor", "Lighting", "EV charging"];
const PHASES = ["Your space", "The basics", "Details", "Price & publish"];

type Form = {
  spaceType: string; title: string; city: string; capacity: string; size: string;
  staffing: "manned" | "unmanned"; accessHours: "24/7" | "daytime" | "by arrangement";
  features: string[]; description: string; bookingInstructions: string; price: string; priceUnit: "hour" | "day" | "week" | "month";
};

export function ListingWizard() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<Form>({
    spaceType: "", title: "", city: "", capacity: "1", size: "", staffing: "unmanned",
    accessHours: "24/7", features: [], description: "", bookingInstructions: "", price: "", priceUnit: "day",
  });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggleFeat = (x: string) => setF((s) => ({ ...s, features: s.features.includes(x) ? s.features.filter((y) => y !== x) : [...s.features, x] }));

  const canNext =
    (step === 0 && f.spaceType && f.title.trim()) ||
    (step === 1 && f.city.trim() && Number(f.capacity) >= 1) ||
    step === 2 ||
    step === 3;

  function submit(publish: boolean) {
    setError(null);
    start(async () => {
      const r = await createListingAction({
        title: f.title.trim(),
        spaceType: f.spaceType,
        description: f.description.trim(),
        bookingInstructions: f.bookingInstructions.trim() || undefined,
        address: { city: f.city.trim() },
        capacity: Number(f.capacity) || 1,
        size: f.size.trim(),
        staffing: f.staffing,
        accessHours: f.accessHours,
        features: f.features,
        price: f.price ? Number(f.price) : undefined,
        priceUnit: f.priceUnit,
        status: publish ? "active" : "draft",
      });
      if (r.ok) { router.push(routes.hostListing(r.id)); router.refresh(); }
      else setError(r.error);
    });
  }

  return (
    <div className="wiz">
      <div className="wizbar">{PHASES.map((_, i) => <span key={i} className={i <= step ? "on" : ""} />)}</div>
      <p className="wizphase">{step + 1} · {PHASES[step]}</p>
      {error && <Alert kind="error" onDismiss={() => setError(null)}>{error}</Alert>}

      {step === 0 && (
        <div className="wizstep">
          <h2>What are you listing?</h2>
          <p className="hint">Pick the closest match — you can fine-tune the details next.</p>
          <div className="optgrid">
            {TYPES.map((t) => (
              <button key={t.v} type="button" className="opt" onClick={() => set("spaceType", t.v)} style={f.spaceType === t.v ? { borderColor: "var(--primary)", background: "var(--primary-soft)" } : undefined}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="field" style={{ marginTop: 18 }}>
            <label>Give it a title</label>
            <input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Secure garage near Downtown" />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="wizstep">
          <h2>Where is it, and how much fits?</h2>
          <p className="hint">The exact address stays private until a booking is confirmed.</p>
          <div className="field"><label>City</label><input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="San Francisco" /></div>
          <div className="frow">
            <div className="field"><label>Capacity (units / slots)</label><input type="number" min={1} value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></div>
            <div className="field"><label>Size / what fits</label><input value={f.size} onChange={(e) => set("size", e.target.value)} placeholder="5×5 ft · fits an SUV" /></div>
          </div>
          <div className="frow">
            <div className="field"><label>Staffing</label>
              <select value={f.staffing} onChange={(e) => set("staffing", e.target.value as Form["staffing"])}><option value="unmanned">Unmanned (self-serve)</option><option value="manned">Manned (staffed)</option></select>
            </div>
            <div className="field"><label>Access hours</label>
              <select value={f.accessHours} onChange={(e) => set("accessHours", e.target.value as Form["accessHours"])}><option value="24/7">24/7</option><option value="daytime">Daytime</option><option value="by arrangement">By arrangement</option></select>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="wizstep">
          <h2>Make it stand out</h2>
          <p className="hint">Pick the features that apply and describe the space.</p>
          <div className="chips">
            {FEATURES.map((x) => (
              <button key={x} type="button" className={`chip${f.features.includes(x) ? " on" : ""}`} onClick={() => toggleFeat(x)}>{x}</button>
            ))}
          </div>
          <div className="field" style={{ marginTop: 18 }}>
            <label>Description</label>
            <textarea rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Tell guests what makes this spot great, how access works, anything to know…" />
          </div>
          <div className="field" style={{ marginTop: 18 }}>
            <label>Booking instructions <span className="muted" style={{ fontWeight: 400 }}>— shown to the guest right after they book</span></label>
            <textarea rows={4} value={f.bookingInstructions} onChange={(e) => set("bookingInstructions", e.target.value)} placeholder="Exactly how to drop off and collect: gate code, which locker/bay, where to meet, hours, and how to reach you on arrival." />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="wizstep">
          <h2>Set your price</h2>
          <p className="hint">You keep 82% of every booking. You can change this any time.</p>
          <div className="frow">
            <div className="field"><label>Price</label><input type="number" min={0} step="0.5" value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="0" /></div>
            <div className="field"><label>Per</label>
              <select value={f.priceUnit} onChange={(e) => set("priceUnit", e.target.value as Form["priceUnit"])}><option value="hour">hour</option><option value="day">day</option><option value="week">week</option><option value="month">month</option></select>
            </div>
          </div>
          <div className="tcard" style={{ marginTop: 8 }}>
            <b style={{ fontFamily: "var(--font-display)" }}>{f.title || "Your listing"}</b>
            <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>{f.spaceType.replace(/-/g, " ")} · {f.city || "—"} · capacity {f.capacity} · {f.staffing}</div>
          </div>
        </div>
      )}

      <div className="wiznav">
        {step > 0 ? <button type="button" className="btn ghost" onClick={() => setStep((s) => s - 1)}>← Back</button> : <span />}
        {step < 3 ? (
          <button type="button" className="btn clay" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continue</button>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn ghost" disabled={pending} onClick={() => submit(false)}>{pending ? "Saving…" : "Save as draft"}</button>
            <button type="button" className="btn clay" disabled={pending} onClick={() => submit(true)}>{pending ? "Publishing…" : "Publish listing"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
