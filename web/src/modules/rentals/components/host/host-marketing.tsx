import Link from "next/link";
import { EarningsCalc } from "./earnings-calc";

export function HostMarketing({ cta }: { cta: React.ReactNode }) {
  return (
    <>
      <section className="hosthero">
        <div className="bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="ph-empty" aria-hidden="true" />
        </div>
        <div className="wrap in">
          <div>
            <p className="eyebrow">For hosts</p>
            <h1>
              Turn idle space
              <br />
              into income.
            </h1>
            <p className="sub">
              A back room, a few parking bays, a slow counter — list it on Stowbo and get paid to hold bags, gear and cars. You set the price and the hours. We bring the guests, the payments, and the protection.
            </p>
            {cta}
            <div
              style={{
                display: "flex",
                gap: 22,
                flexWrap: "wrap",
                marginTop: 22,
                color: "#e6efdd",
                fontWeight: 600,
                fontSize: 14.5,
              }}
            >
              <span>✓ Free to list</span>
              <span>✓ Weekly payouts</span>
              <span>✓ You approve every booking</span>
            </div>
          </div>
          <EarningsCalc />
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow">Simple to run</p>
              <h2>From spare space to paid, in three steps</h2>
            </div>
            <a className="more" href="/host-signup">
              Start listing →
            </a>
          </div>
          <div className="worktrack">
            <div className="workcard">
              <span className="num">1</span>
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M4 20h16" />
                  <path d="M6 16l9-9 3 3-9 9H6z" />
                </svg>
              </div>
              <h3>List your space</h3>
              <p>Pick what you can hold, snap a few photos, set your hours and price. Verified — usually same day.</p>
            </div>
            <div className="workcard">
              <span className="num">2</span>
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="7" width="18" height="13" rx="2" />
                  <path d="M9 7l1.5-2h3L15 7" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </div>
              <h3>Accept drop-offs</h3>
              <p>A guest shows a code, you snap a photo and confirm the count. One tap and it&apos;s logged in your queue.</p>
            </div>
            <div className="workcard">
              <span className="num">3</span>
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <path d="M2 10h20" />
                </svg>
              </div>
              <h3>Hand back &amp; get paid</h3>
              <p>Match the code, hand it over, done. Stowbo settles the time and pays you every week.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="how">
            <p className="eyebrow">Why hosts choose Stowbo</p>
            <h2>Low effort, real protection</h2>
            <div className="why" style={{ marginTop: 34 }}>
              <div className="whycard">
                <div
                  className="n"
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 15,
                    background: "rgba(255,255,255,.08)",
                    border: "1px solid rgba(255,255,255,.14)",
                    color: "var(--pop)",
                    display: "grid",
                    placeItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width={24} height={24}>
                    <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
                  </svg>
                </div>
                <h3 style={{ color: "#fff" }}>You&apos;re protected</h3>
                <p style={{ color: "#b7caa6" }}>Every stow covered up to $5,000, with a photo‑and‑count evidence trail.</p>
              </div>
              <div className="whycard">
                <div
                  className="n"
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 15,
                    background: "rgba(255,255,255,.08)",
                    border: "1px solid rgba(255,255,255,.14)",
                    color: "var(--pop)",
                    display: "grid",
                    placeItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width={24} height={24}>
                    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
                  </svg>
                </div>
                <h3 style={{ color: "#fff" }}>You&apos;re in control</h3>
                <p style={{ color: "#b7caa6" }}>Set your price, capacity and hours. Approve bookings, pause anytime.</p>
              </div>
              <div className="whycard">
                <div
                  className="n"
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 15,
                    background: "rgba(255,255,255,.08)",
                    border: "1px solid rgba(255,255,255,.14)",
                    color: "var(--pop)",
                    display: "grid",
                    placeItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width={24} height={24}>
                    <rect x="7" y="2" width="10" height="20" rx="2" />
                    <path d="M11 18h2" />
                  </svg>
                </div>
                <h3 style={{ color: "#fff" }}>Runs on your phone</h3>
                <p style={{ color: "#b7caa6" }}>Scan, photo, count, hand back — the same flow for 2 bags or 200.</p>
              </div>
              <div className="whycard">
                <div
                  className="n"
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 15,
                    background: "rgba(255,255,255,.08)",
                    border: "1px solid rgba(255,255,255,.14)",
                    color: "var(--pop)",
                    display: "grid",
                    placeItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width={24} height={24}>
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <path d="M2 10h20" />
                  </svg>
                </div>
                <h3 style={{ color: "#fff" }}>Paid, reliably</h3>
                <p style={{ color: "#b7caa6" }}>Automatic settlement and weekly payouts to your bank.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="testimonial">
            <div className="q">Stowbo turned our dead 3-to-6 window into our best revenue of the day — people drop bags before the show and buy a coffee on the way out.</div>
            <div className="by">
              <span className="av">V</span>
              <div>
                <b>Verde Coffee</b>
                <br />
                Austin, TX · Superhost since 2025
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="faqwrap">
            <div className="leadcol">
              <p className="eyebrow">Questions</p>
              <h2>Hosting, answered</h2>
              <p>Everything worth knowing before you list. Still stuck? Our host team is quick to reply.</p>
              <div className="faq-support">
                <b>Talk to a human</b>
                <p>Real answers from the Stowbo host team, usually within the hour.</p>
                <a className="btn ghost sm" href="/help">
                  Contact host support
                </a>
              </div>
            </div>
            <div className="acc">
              <details open>
                <summary>What can I host?</summary>
                <p>Whatever you can safely hold — a few parking bays, boxes and luggage, lockers, a spare room, warehouse space, or an event bag &amp; coat drop. You pick the class, set your price (per hour, day or month) and your capacity.</p>
              </details>
              <details>
                <summary>How does the handoff work?</summary>
                <p>The guest arrives with a code. You scan it, photograph the items and confirm the count — that&apos;s the drop-off. On pickup, the code and photo must match before anything leaves. Seconds each, and the same for every booking.</p>
              </details>
              <details>
                <summary>What if something goes wrong?</summary>
                <p>Every booking is Stowbo-protected up to $5,000, and because each handoff has a photo and count on record, claims are provable. Prohibited and high-value items are excluded — the full policy shows at checkout.</p>
              </details>
              <details>
                <summary>How and when do I get paid?</summary>
                <p>Stowbo handles payments and settlement automatically. Your earnings (minus our fee) land in your bank every week via Stripe. No cash, no chasing.</p>
              </details>
              <details>
                <summary>Is there a fee to list?</summary>
                <p>Listing is free. Stowbo takes a service fee (typically 15–20%) only when you actually earn — no bookings, no fee.</p>
              </details>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="hostband" style={{ minHeight: 300 }}>
            <div className="bg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="ph-empty" aria-hidden="true" />
            </div>
            <div className="c">
              <p className="eyebrow">Ready when you are</p>
              <h2>Earn from the space you already have</h2>
              <p>List free in minutes — you approve every booking and get paid weekly.</p>
              {cta}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
