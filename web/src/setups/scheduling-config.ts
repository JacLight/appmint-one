/**
 * Scheduling module: how one business books (a studio's class timetable, a clinic's
 * visits, a firm's consultations) and the facts its pages show about the place itself.
 * The bookable things — types, people, times, prices, plans — come from the engine
 * (reservation definitions whose name starts with `prefix`, plans starting with
 * `planPrefix`); nothing bookable is written here.
 */
export type SchedulingStyle = "studio" | "clinic" | "firm";

export interface SchedulingPlace {
  name: string;
  street: string;
  city: string;
  phone?: string;
  /** [days, hours] rows, e.g. ["Mon–Fri", "8:00 AM – 5:00 PM"]. */
  hours: [string, string][];
  /** One line under the address (parking, transit, entrance). */
  note?: string;
  image?: string;
}

export interface SchedulingConfig {
  style: SchedulingStyle;
  /** Booking types (reservation definitions) whose `name` starts with this. */
  prefix: string;
  /** Existing booking types (reservation definition names) this business also offers. */
  include?: string[];
  /** Plans (memberships / class packs) whose `name` starts with this. Studio only. */
  planPrefix?: string;
  /** Existing plans (subscription plan names) this business also sells. */
  includePlans?: string[];
  /** IANA zone the business runs in — every time on screen is shown in it. */
  timezone: string;
  hero: {
    kicker?: string;
    /** Headline; `em` is the italic / accented word(s) appended after it. */
    title: string;
    em?: string;
    sub: string;
    image: string;
    imageAlt: string;
    cta: string;
  };
  place: SchedulingPlace;
  /** Short reassurance lines that hang off the main action. */
  lines?: string[];
  /** Plans accepted (clinic). */
  insurance?: string[];
  /** One paragraph on how fees work (firm) or the cancellation rule (studio/clinic). */
  policy?: string;
  /** Section titles in the setup's voice. */
  words: {
    /** "Classes", "Visit types", "Practice areas" */
    types: string;
    /** "Coaches", "Our clinicians", "Attorneys" */
    team: string;
    /** "Book a class", "Book a visit", "Book a consultation" */
    bookCta: string;
  };
}
