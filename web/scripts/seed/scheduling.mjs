#!/usr/bin/env node
/**
 * Seed the three Scheduling setups on an org so every screen has a real business behind it:
 *
 *   Cedar Family Medicine (medical-)  five clinicians, seven visit types, three intake forms,
 *                                     and two weeks of other patients' visits, so each
 *                                     clinician's open times are their own.
 *   Lumen Pilates (studio-)           five coaches, a weekly class timetable (reformer, tower,
 *                                     mat, jumpboard, weekend flow), private sessions, packs
 *                                     and memberships, and the members already in each class.
 *   Hale & Mercer (law-)              four attorneys, four practice areas, a conflict-check
 *                                     intake form and the consultations already on the calendar.
 *
 *   APPENGINE=http://127.0.0.1:3300 ORG=demo APPMINT_EMAIL=… APPMINT_PASSWORD=… \
 *     node scripts/seed/scheduling.mjs [--only medical,studio,law] [--no-load]
 *
 * Sign-in is the same as scripts/seed/property.mjs (APPMINT_STAFF_TOKEN, or email + password
 * with the emailed two-factor code; the staff token is kept in the OS temp folder and shared
 * by both scripts). Safe to re-run: definitions, forms and plans are found by name and
 * updated in place; other people's bookings are only added where that host has nothing yet.
 *
 * Other people's bookings are written as reservation records (repository/create), not through
 * the booking routes, so no confirmation email or SMS goes out for them. Every person here has
 * an @example.com address. Before writing them the script lists any active automation that
 * mentions reservations and stops; pass --allow-automations once you have looked at them.
 * --no-load skips those bookings altogether. Definitions carry no reminder `notifications`.
 *
 * Writes only through staff routes that already exist:
 *   PUT repository/create, POST repository/update/:id, POST repository/find/:datatype
 */
import readline from "node:readline/promises";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const API = (process.env.APPENGINE || "http://127.0.0.1:3300").replace(/\/$/, "");
const ORG = process.env.ORG || "demo";
const argv = process.argv.slice(2);
const ONLY = argv.includes("--only") ? String(argv[argv.indexOf("--only") + 1] || "").split(",").filter(Boolean) : ["medical", "studio", "law"];
const LOAD = !argv.includes("--no-load");
const ALLOW_AUTOMATIONS = argv.includes("--allow-automations");
const TZ = "America/Chicago";

const U = (id, w = 900) => `https://images.unsplash.com/${id}?w=${w}&q=75&auto=format&fit=crop`;
const FACE = (id) => `https://images.unsplash.com/${id}?w=600&h=600&q=75&auto=format&fit=crop&crop=faces`;
const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/* ───────────── Cedar Family Medicine ───────────── */

const CEDAR = {
  okafor: {
    email: "amara.okafor@cedar-family.example.com", name: "Dr. Amara Okafor", title: "Family physician", credentials: "MD, FAAFP",
    photo: FACE("photo-1651008376811-b90baee60c1f"), languages: ["English", "Igbo"],
    specialties: ["Women's health", "High blood pressure", "Diabetes"],
    bio: "Dr. Okafor trained at UT Southwestern and has looked after families on Lower Greenville for eleven years. She spends the first visit listening, then writes the plan down so you leave with it.",
  },
  mehta: {
    email: "rohan.mehta@cedar-family.example.com", name: "Dr. Rohan Mehta", title: "Family physician", credentials: "DO",
    photo: FACE("photo-1612349317150-e413f6a5b16d"), languages: ["English", "Hindi", "Gujarati"],
    specialties: ["Sports and joint injuries", "Preventive care", "Men's health"],
    bio: "Dr. Mehta is an osteopathic physician who also covers the Dallas Running Club medical tent. Sprains, back pain and a check-up you've put off for three years are all his.",
  },
  chen: {
    email: "laura.chen@cedar-family.example.com", name: "Dr. Laura Chen", title: "Family physician", credentials: "MD",
    photo: FACE("photo-1559839734-2b71ea197ec2"), languages: ["English", "Mandarin"],
    specialties: ["Medicare and older adults", "Thyroid", "Women's health"],
    bio: "Dr. Chen sees many of the practice's Medicare patients and their adult children. Annual wellness visits, medication reviews and coordinating with specialists.",
  },
  alvarez: {
    email: "sofia.alvarez@cedar-family.example.com", name: "Sofia Alvarez", title: "Physician assistant", credentials: "PA-C",
    photo: FACE("photo-1594824476967-48c8b964273f"), languages: ["English", "Spanish"],
    specialties: ["Kids and teens", "Sports physicals", "Same-day sick visits"],
    bio: "Sofia sees most of the practice's children, from newborn checks to high-school sports physicals, and keeps the same-day sick schedule moving.",
  },
  bell: {
    email: "marcus.bell@cedar-family.example.com", name: "Marcus Bell", title: "Nurse practitioner", credentials: "FNP-C",
    photo: FACE("photo-1622253692010-333f2da6031d"), languages: ["English"],
    specialties: ["Colds, flu and infections", "Video visits", "Follow-ups"],
    bio: "Marcus runs the practice's video visits, including Saturday mornings, and the quick in-person sick visits during the week.",
  },
};
const C = CEDAR;
const host = (p) => ({ email: p.email, name: p.name });

const LUNCH = [{ startTime: "12:00", endTime: "13:00", label: "Lunch" }];
const clinicDef = (o) => ({
  name: `medical-${o.slug}`, title: o.title, description: o.description, type: "service", status: "active",
  services: [{ name: o.title, duration: o.duration, price: o.price, breakAfter: o.breakAfter ?? 0, description: o.description }],
  hosts: o.people.map(host), team: o.people, spots: o.people.length,
  ...(o.roundRobin ? { bookingType: "round-robin" } : {}),
  workDays: o.days || WEEK, officeHours: { timezone: TZ, startTime: o.start || "08:00", endTime: o.end || "17:00" },
  blockedTime: o.blocked ?? LUNCH, form: o.form, image: o.image ? { url: o.image } : undefined,
  portal: { kind: "visit", category: o.category, video: !!o.video, sameDay: !!o.sameDay },
});

const MEDICAL_TYPES = [
  clinicDef({
    slug: "new-patient", title: "New patient visit", duration: 45, breakAfter: 15, price: 195, category: "Get started", form: "medical-new-patient",
    people: [C.okafor, C.mehta, C.chen],
    description: "Your first visit with the doctor who'll be yours. We go through your history, medicines and what you want help with, and agree a plan.",
  }),
  clinicDef({
    slug: "annual-physical", title: "Annual physical", duration: 40, breakAfter: 20, price: 175, category: "Prevention", form: "medical-intake", end: "16:00",
    people: [C.okafor, C.mehta, C.chen, C.alvarez],
    description: "A yearly check-up: blood pressure, labs, screenings due for your age and the vaccines you're behind on. Covered in full by most plans.",
  }),
  clinicDef({
    slug: "sick-visit", title: "Sick visit", duration: 20, price: 95, category: "Same day", form: "medical-intake", sameDay: true, roundRobin: true,
    people: [C.alvarez, C.bell, C.mehta],
    description: "Fever, cough, sore throat, an earache or a rash. Same-day times open every morning.",
  }),
  clinicDef({
    slug: "follow-up", title: "Follow-up visit", duration: 20, price: 85, category: "Ongoing care", form: "medical-intake",
    people: [C.okafor, C.mehta, C.chen, C.alvarez, C.bell],
    description: "Check in on a condition, a new medicine or lab results with the clinician you saw last.",
  }),
  clinicDef({
    slug: "well-child", title: "Well-child & sports physical", duration: 30, price: 110, category: "Kids & teens", form: "medical-well-child", start: "08:00", end: "17:00",
    people: [C.alvarez, C.okafor],
    description: "Growth, development and vaccines for newborns to teens, and the signed UIL form for school sports.",
  }),
  clinicDef({
    slug: "womens-health", title: "Women's health visit", duration: 30, breakAfter: 10, price: 140, category: "Prevention", form: "medical-intake",
    people: [C.okafor, C.chen],
    description: "Pap smear, birth control, menopause and breast health with a doctor you choose.",
  }),
  clinicDef({
    slug: "video-visit", title: "Video visit", duration: 15, price: 59, category: "From home", form: "medical-intake", video: true, roundRobin: true,
    days: [...WEEK, "Saturday"], start: "08:00", end: "18:00", blocked: [],
    people: [C.bell, C.alvarez],
    description: "See a clinician from your phone for colds, rashes, refills and follow-ups. Saturday mornings too.",
  }),
];

const str = (title, extra = {}) => ({ type: "string", title, ...extra });
const text = (title) => ({ type: "string", title, "x-control-variant": "textarea" });
const INSURERS = ["Aetna", "Blue Cross Blue Shield of Texas", "Cigna", "UnitedHealthcare", "Humana", "Medicare", "Self-pay"];

const MEDICAL_FORMS = [
  {
    name: "medical-intake", title: "Before your visit", description: "So your clinician can read it before you walk in.", status: "active",
    schema: {
      type: "object", required: ["reason", "insurance"],
      properties: {
        reason: text("What would you like help with?"), since: str("When did it start?", { format: "date" }),
        medications: text("Medicines and supplements you take"), allergies: text("Allergies"),
        insurance: str("Insurance", { enum: INSURERS }), memberId: str("Member ID"), pharmacy: str("Preferred pharmacy"),
        consent: { type: "boolean", title: "I agree to Cedar Family Medicine's consent to treat and privacy notice" },
      },
    },
  },
  {
    name: "medical-new-patient", title: "New patient forms", description: "About ten minutes. We'll go through it with you at the visit.", status: "active",
    schema: {
      type: "object", required: ["reason", "dob", "insurance", "emergencyName", "emergencyPhone"],
      properties: {
        reason: text("What would you like help with?"), dob: str("Date of birth", { format: "date" }),
        sex: str("Sex assigned at birth", { enum: ["Female", "Male", "Intersex", "Prefer not to say"] }), pronouns: str("Pronouns"),
        conditions: text("Ongoing conditions"), surgeries: text("Past surgeries and hospital stays"), family: text("Family history (parents, siblings)"),
        medications: text("Medicines and supplements you take"), allergies: text("Allergies"),
        smoking: str("Tobacco or vaping", { enum: ["Never", "Former", "Current"] }), alcohol: str("Drinks per week"),
        insurance: str("Insurance", { enum: INSURERS }), memberId: str("Member ID"), pharmacy: str("Preferred pharmacy"),
        lastDoctor: str("Previous doctor (for records)"), emergencyName: str("Emergency contact"), emergencyPhone: str("Emergency contact phone"),
        consent: { type: "boolean", title: "I agree to Cedar Family Medicine's consent to treat and privacy notice" },
      },
    },
  },
  {
    name: "medical-well-child", title: "Before your child's visit", description: "Filled in by a parent or guardian.", status: "active",
    schema: {
      type: "object", required: ["childName", "childDob", "guardian", "insurance"],
      properties: {
        childName: str("Child's name"), childDob: str("Child's date of birth", { format: "date" }), guardian: str("Parent or guardian bringing them"),
        visitFor: str("This visit is for", { enum: ["Well-child check", "School or camp form", "UIL sports physical", "Vaccines only"] }),
        school: str("School and grade"), sport: str("Sport (for physicals)"), concerns: text("Anything you'd like us to look at"),
        allergies: text("Allergies"), medications: text("Medicines"), insurance: str("Insurance", { enum: INSURERS }), memberId: str("Member ID"),
        consent: { type: "boolean", title: "I am the parent or legal guardian and consent to treatment" },
      },
    },
  },
];

/* ───────────── Lumen Pilates ───────────── */

const LUMEN = {
  maya: { email: "maya.ortiz@lumen-pilates.example.com", name: "Maya Ortiz", title: "Founder & lead coach", credentials: "STOTT Pilates full certification", photo: FACE("photo-1580489944761-15a19d654956"), specialties: ["Reformer", "Pre- and post-natal"], bio: "Maya opened Lumen in 2019 after ten years teaching in Austin. Her 6:30 AM class fills by Sunday night." },
  theo: { email: "theo.grant@lumen-pilates.example.com", name: "Theo Grant", title: "Coach", credentials: "Balanced Body reformer & jumpboard", photo: FACE("photo-1507003211169-0a1dd7228f2d"), specialties: ["Jumpboard", "Athletes", "Weekend flow"], bio: "A former college sprinter who came to Pilates for a hamstring and stayed. Expect cardio and a lot of laughing." },
  jess: { email: "jess.romero@lumen-pilates.example.com", name: "Jess Romero", title: "Coach", credentials: "Polestar Pilates comprehensive", photo: FACE("photo-1494790108377-be9c29b29330"), specialties: ["Beginners", "Foundations", "Posture"], bio: "Jess teaches Foundations, so she's the one who makes your first class feel easy to come back to." },
  nia: { email: "nia.adeyemi@lumen-pilates.example.com", name: "Nia Adeyemi", title: "Coach", credentials: "Physical therapist (DPT), STOTT rehab", photo: FACE("photo-1531123897727-8f129e1688ce"), specialties: ["Tower", "Injury recovery", "Privates"], bio: "Nia is a physical therapist by day. Her tower classes are slow, precise and humbling." },
  camila: { email: "camila.reyes@lumen-pilates.example.com", name: "Camila Reyes", title: "Coach", credentials: "BASI mat & reformer", photo: FACE("photo-1567532939604-b6b5b0db2604"), specialties: ["Mat", "Core", "Mobility"], bio: "Camila's mat class is the studio's best-kept secret: fourteen mats, no machines, and a core you'll feel on Thursday." },
};
const L = LUMEN;

/** A class on the timetable. Times are carved from one day with blocked gaps, since a
 *  definition has one opening window: `at` is the list of start times (HH:mm). */
const klass = (o) => {
  const step = o.duration + 10;
  const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const starts = o.at.map(mins).sort((a, b) => a - b);
  const blocked = [];
  for (let i = 0; i < starts.length - 1; i++) {
    // Close everything between the end of one class's step and the next start.
    if (starts[i + 1] - starts[i] > step) blocked.push({ startTime: hhmm(starts[i] + step), endTime: hhmm(starts[i + 1]), label: "No class" });
  }
  for (const s of starts) if ((s - starts[0]) % step) throw new Error(`${o.slug}: ${hhmm(s)} is off the ${step}-minute grid from ${hhmm(starts[0])}`);
  return {
    name: `studio-${o.slug}`, title: o.title, description: o.description, type: "service", status: "active",
    services: [{ name: o.title, duration: o.duration, price: o.price ?? 32, breakAfter: 10, description: o.description }],
    hosts: [host(o.coach)], team: [o.coach], spots: o.spots ?? 10,
    workDays: o.days || WEEK, officeHours: { timezone: TZ, startTime: hhmm(starts[0]), endTime: hhmm(starts[starts.length - 1] + o.duration) },
    blockedTime: blocked, form: "studio-first-class", image: { url: U(o.image) },
    portal: { kind: "class", category: o.category, level: o.level, room: o.room },
  };
};

const STUDIO_TYPES = [
  klass({ slug: "reformer-flow", title: "Reformer Flow", coach: L.maya, duration: 50, at: ["06:30", "12:30", "17:30"], category: "Reformer", level: "All levels", room: "Reformer room", image: "photo-1747238415033-b74eec07eb59",
    description: "The class most people mean when they say Pilates: a full-body reformer workout at a steady pace, springs set for you." }),
  klass({ slug: "foundations", title: "Reformer Foundations", coach: L.jess, duration: 50, at: ["07:30", "18:30"], category: "Reformer", level: "Beginner", room: "Reformer room", image: "photo-1783841193384-4269c68aa050",
    description: "Start here. How the reformer works, the five basics and how to set your springs, with time to ask questions." }),
  klass({ slug: "jumpboard", title: "Jumpboard Cardio", coach: L.theo, duration: 50, at: ["09:30", "19:30"], category: "Reformer", level: "Intermediate", room: "Reformer room", image: "photo-1518310383802-640c2de311b2",
    description: "Low-impact jumping on the reformer's jumpboard between strength blocks. Heart rate up, knees happy." }),
  klass({ slug: "tower", title: "Tower", coach: L.nia, duration: 50, at: ["08:00", "18:00"], category: "Tower", level: "Intermediate", room: "Tower studio", spots: 6, image: "photo-1593810450967-f9c42742e326",
    description: "Springs mounted on the wall unit for slow, precise work on hips, shoulders and spine. Six people, lots of attention." }),
  klass({ slug: "mat", title: "Mat Pilates", coach: L.camila, duration: 45, at: ["09:00"], days: [...WEEK, "Saturday"], category: "Mat", level: "All levels", room: "Mat room", spots: 14, price: 24, image: "photo-1518611012118-696072aa579a",
    description: "Classical mat sequence with small props. No machines, so it's the best value on the schedule and the hardest on your core." }),
  klass({ slug: "weekend-flow", title: "Weekend Reformer Flow", coach: L.theo, duration: 50, at: ["08:00", "09:00", "10:00", "11:00"], days: ["Saturday", "Sunday"], category: "Reformer", level: "All levels", room: "Reformer room", image: "photo-1588286840104-8957b019727f",
    description: "Saturday and Sunday mornings. Same workout as Reformer Flow, with a longer stretch at the end." }),
  {
    name: "studio-private", title: "Private session", type: "service", status: "active",
    description: "One-on-one on the reformer or tower with the coach you choose. Good for first-timers, injuries and anyone who wants a programme.",
    services: [{ name: "Private session", duration: 55, price: 95, breakAfter: 5, description: "55 minutes, one coach, one client." }],
    hosts: [L.maya, L.nia, L.jess, L.theo].map(host), team: [L.maya, L.nia, L.jess, L.theo], spots: 4,
    workDays: [...WEEK, "Saturday"], officeHours: { timezone: TZ, startTime: "10:00", endTime: "17:00" }, blockedTime: [],
    form: "studio-first-class", image: { url: U("photo-1540206063137-4a88ca974d1a") },
    portal: { kind: "private", category: "Private", level: "All levels", room: "Private studio" },
  },
];

const feat = (name, value, description) => ({ name, value: String(value), ...(description ? { description } : {}) });
const STUDIO_PLANS = [
  { name: "studio-intro", title: "Intro offer · 3 classes", price: 59, duration: 1, durationUnit: "month", description: "Three classes in your first month, any class on the schedule.",
    features: [feat("kind", "pack"), feat("credits", 3), feat("scope", "class"), feat("badge", "New here"), feat("perk", "", "Free grip socks at your first class"), feat("perk", "", "Use within 30 days")] },
  { name: "studio-5-pack", title: "5-class pack", price: 155, duration: 2, durationUnit: "month", description: "Five classes to use in two months.",
    features: [feat("kind", "pack"), feat("credits", 5), feat("scope", "class"), feat("perk", "", "$31 a class"), feat("perk", "", "Share with a friend")] },
  { name: "studio-10-pack", title: "10-class pack", price: 290, duration: 4, durationUnit: "month", description: "Ten classes to use in four months.",
    features: [feat("kind", "pack"), feat("credits", 10), feat("scope", "class"), feat("perk", "", "$29 a class"), feat("perk", "", "Pause once for travel")] },
  { name: "studio-8-month", title: "8 classes a month", price: 209, duration: 1, durationUnit: "month", description: "Two classes a week, renewed monthly.",
    features: [feat("kind", "membership"), feat("credits", 8), feat("scope", "class"), feat("perk", "", "Book 14 days ahead"), feat("perk", "", "10% off privates")] },
  { name: "studio-unlimited", title: "Unlimited", price: 259, duration: 1, durationUnit: "month", description: "Every class, every day, renewed monthly.",
    features: [feat("kind", "membership"), feat("credits", "unlimited"), feat("scope", "class"), feat("badge", "Most popular"), feat("perk", "", "Book 21 days ahead"), feat("perk", "", "One guest pass a month"), feat("perk", "", "15% off privates")] },
  { name: "studio-private-3", title: "3 private sessions", price: 270, duration: 3, durationUnit: "month", description: "Three one-on-one sessions with the coach you choose.",
    features: [feat("kind", "pack"), feat("credits", 3), feat("scope", "private"), feat("perk", "", "$90 a session"), feat("perk", "", "Written programme to take home")] },
].map((p) => ({ ...p, currency: "USD", status: "active" }));

const STUDIO_FORMS = [{
  name: "studio-first-class", title: "Before your first class", description: "Two minutes. Your coach reads it before class.", status: "active",
  schema: {
    type: "object", required: ["experience", "emergencyName", "emergencyPhone"],
    properties: {
      experience: str("Pilates experience", { enum: ["Brand new", "A few classes", "Regular (6+ months)", "Instructor"] }),
      goals: text("What brings you to Pilates?"), injuries: text("Injuries, surgeries or pain we should know about"),
      pregnant: str("Pregnant or within 6 months postpartum", { enum: ["No", "Yes"] }),
      emergencyName: str("Emergency contact"), emergencyPhone: str("Emergency contact phone"),
      waiver: { type: "boolean", title: "I've read and accept the Lumen Pilates liability waiver" },
    },
  },
}];

/* ───────────── Hale & Mercer ───────────── */

const FIRM = {
  hale: { email: "thomas.hale@halemercer.example.com", name: "Thomas Hale", title: "Founding partner", credentials: "JD, SMU Dedman · Board certified, Civil Trial Law", photo: FACE("photo-1560250097-0b93528c311a"), practice: "Business & contracts", languages: ["English"], specialties: ["Contracts", "Partner disputes", "Buying or selling a business"], bio: "Thomas has represented Dallas founders and family businesses for twenty-two years, from first operating agreement to sale. He'd rather fix the contract now than litigate it later." },
  mercer: { email: "claire.mercer@halemercer.example.com", name: "Claire Mercer", title: "Founding partner", credentials: "JD, UT Austin · Board certified, Commercial Real Estate Law", photo: FACE("photo-1573496359142-b8d87734a5a2"), practice: "Real estate", languages: ["English", "French"], specialties: ["Commercial leases", "Purchases and closings", "Landlord–tenant"], bio: "Claire negotiates leases and purchases for owners, tenants and lenders across North Texas, and reviews more commercial leases in a month than most lawyers see in a year." },
  shah: { email: "priya.shah@halemercer.example.com", name: "Priya Shah", title: "Partner", credentials: "JD, Baylor · LL.M. Taxation", photo: FACE("photo-1534528741775-53994a69daeb"), practice: "Estate planning", languages: ["English", "Hindi"], specialties: ["Wills and trusts", "Probate", "Guardianship"], bio: "Priya writes wills and trusts for young families and business owners, and walks families through probate when a parent dies without a plan." },
  osei: { email: "daniel.osei@halemercer.example.com", name: "Daniel Osei", title: "Associate", credentials: "JD, Texas A&M", photo: FACE("photo-1500648767791-00dcc994a43e"), practice: "Employment", languages: ["English", "Twi"], specialties: ["Wrongful termination", "Wage claims", "Employment agreements"], bio: "Daniel advises employees and small employers on firings, unpaid wages, non-competes and severance before they turn into lawsuits." },
};
const F = FIRM;

const firmDef = (o) => ({
  name: `law-${o.slug}`, title: `${o.area} consultation`, description: o.description, type: "service", status: "active",
  services: [{ name: `${o.area} consultation`, duration: o.duration, price: o.price, breakAfter: 15, description: o.description }],
  hosts: o.people.map(host), team: o.people, spots: o.people.length,
  workDays: WEEK, officeHours: { timezone: TZ, startTime: "09:00", endTime: "17:00" }, blockedTime: LUNCH, form: "law-intake",
  image: { url: U(o.image) }, portal: { kind: "consultation", area: o.area, video: true },
});

const LAW_TYPES = [
  firmDef({ slug: "business", area: "Business & contracts", duration: 45, price: 175, people: [F.hale, F.osei], image: "photo-1556761175-b413da4baf72",
    description: "Forming an LLC, partner agreements, a contract you've been sent, or buying or selling a business." }),
  firmDef({ slug: "real-estate", area: "Real estate", duration: 45, price: 175, people: [F.mercer], image: "photo-1450101499163-c8848c66ca85",
    description: "Commercial and residential leases, purchase contracts, title problems and landlord–tenant disputes." }),
  firmDef({ slug: "estate-planning", area: "Estate planning", duration: 60, price: 150, people: [F.shah], image: "photo-1521791055366-0d553872125f",
    description: "Wills, trusts, powers of attorney and probate. Most families leave the first meeting with a plan and a flat fee." }),
  firmDef({ slug: "employment", area: "Employment", duration: 45, price: 150, people: [F.osei], image: "photo-1589829545856-d10d557cf95f",
    description: "Fired, underpaid or asked to sign a non-compete or severance agreement. We'll tell you where you stand." }),
];

const LAW_FORMS = [{
  name: "law-intake", title: "Before your consultation", description: "We run a conflict check on every name here before we meet. Nothing you write creates an attorney–client relationship.", status: "active",
  schema: {
    type: "object", required: ["summary", "otherParties"],
    properties: {
      summary: text("In a few sentences, what happened and what you'd like to happen"),
      otherParties: text("Other people or companies involved (for our conflict check)"),
      deadline: str("Any deadline, court date or letter with a date on it", { format: "date" }),
      company: str("Your company (if this is for a business)"), role: str("Your role"),
      priorCounsel: str("Have you spoken to another lawyer about this?", { enum: ["No", "Yes"] }),
      documents: text("Documents you have (contract, lease, letter, termination notice)"),
      heardFrom: str("How did you hear about us?"),
      acknowledge: { type: "boolean", title: "I understand that booking a consultation does not make Hale & Mercer my lawyers" },
    },
  },
}];

/* ───────────── other people on the calendar ───────────── */

const FIRST = ["Olivia", "Marcus", "Grace", "Diego", "Hannah", "Kwame", "Lauren", "Mateo", "Priya", "Ethan", "Chloe", "Jamal", "Sofia", "Ben", "Aisha", "Tyler", "Mei", "Carlos", "Rachel", "Noah", "Fatima", "Jordan", "Elena", "Sam", "Imani", "Luke", "Nadia", "Owen", "Zoe", "Andre"];
const LAST = ["Nguyen", "Walker", "Patel", "Hernandez", "Brooks", "Mensah", "Kim", "Garcia", "Coleman", "Rivera", "Foster", "Ibrahim", "Sullivan", "Tran", "Ellis", "Morales", "Bennett", "Okoro", "Price", "Diaz"];

/** A small deterministic generator, so a re-run picks the same people and times. */
const rng = (seed) => {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507), h = Math.imul(h ^ (h >>> 13), 3266489909), (h ^= h >>> 16) >>> 0) / 4294967296);
};
const person = (r) => {
  const first = FIRST[Math.floor(r() * FIRST.length)], last = LAST[Math.floor(r() * LAST.length)];
  return { name: `${first} ${last}`, email: `${first}.${last}${Math.floor(r() * 90 + 10)}@example.com`.toLowerCase() };
};

/** The UTC instant of a wall-clock time in `tz` on `day` (YYYY-MM-DD). */
function zoned(day, hhmm, tz = TZ) {
  const [y, m, d] = day.split("-").map(Number), [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asIf = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (asIf - guess));
}
function businessDays(n, days) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const out = [];
  for (let i = 0; out.length < n && i < n * 3; i++) {
    const dt = new Date(`${today}T12:00:00Z`); dt.setUTCDate(dt.getUTCDate() + i);
    const key = dt.toISOString().slice(0, 10);
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(dt);
    if (days.includes(wd)) out.push({ key, wd });
  }
  return out;
}
const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const blockedAt = (def, start, end) => (def.blockedTime || []).some((b) => start < mins(b.endTime) && end > mins(b.startTime));

/* ───────────── engine calls (as scripts/seed/property.mjs) ───────────── */

// APPMINT_APP_TOKEN: the app's own token (POST profile/app/key with the APP_ID, APP_KEY and APP_SECRET
// from .env.local), the way the Stowbo seeder signs in; no staff password or two-factor code needed.
const APP_TOKEN = process.env.APPMINT_APP_TOKEN || "";
let TOKEN = APP_TOKEN || process.env.APPMINT_STAFF_TOKEN || "";

async function call(method, path, body) {
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: { "content-type": "application/json", orgid: ORG, ...(TOKEN ? { authorization: `Bearer ${TOKEN}`, ...(APP_TOKEN ? {} : { "x-client-authorization": TOKEN }) } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const txt = await res.text();
  let json; try { json = txt ? JSON.parse(txt) : null; } catch { json = txt; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${typeof json === "string" ? json.slice(0, 300) : JSON.stringify(json).slice(0, 300)}`);
  return json;
}

const STATE = join(tmpdir(), `appmint-seed-${ORG}.json`);
const state = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {});

async function signIn() {
  if (TOKEN) return;
  const saved = state();
  TOKEN = saved.token || "";
  if (TOKEN && (await fetch(`${API}/client/community/pages/mine`, { headers: { orgid: ORG, authorization: `Bearer ${TOKEN}`, "x-client-authorization": TOKEN } })).ok) return;
  TOKEN = "";
  const code = (process.env.APPMINT_2FA_CODE || "").trim();
  if (code && saved.challengeToken) {
    const v = await call("POST", "profile/security/challenge/verify", { challengeToken: saved.challengeToken, code });
    TOKEN = v?.token || v?.access_token || v?.data?.token;
  } else {
    const email = process.env.APPMINT_EMAIL, password = process.env.APPMINT_PASSWORD;
    if (!email || !password) throw new Error("Set APPMINT_STAFF_TOKEN, or APPMINT_EMAIL and APPMINT_PASSWORD.");
    const r = await call("POST", "profile/user/signin", { email, password });
    if (r?.requiresTwoFactor) {
      if (!process.stdin.isTTY) {
        writeFileSync(STATE, JSON.stringify({ challengeToken: r.challengeToken }), { mode: 0o600 });
        console.log("Two-factor code sent to the account's email. Run again with APPMINT_2FA_CODE=<code>.");
        process.exit(2);
      }
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const typed = (await rl.question("Two-factor code (check the account's email): ")).trim();
      rl.close();
      const v = await call("POST", "profile/security/challenge/verify", { challengeToken: r.challengeToken, code: typed });
      TOKEN = v?.token || v?.access_token || v?.data?.token;
    } else {
      TOKEN = r?.token || r?.access_token || r?.data?.token;
    }
  }
  if (!TOKEN) throw new Error("Signed in but no token came back.");
  writeFileSync(STATE, JSON.stringify({ token: TOKEN }), { mode: 0o600 });
}

async function byName(datatype, name) {
  const r = await call("POST", `repository/find/${datatype}`, { query: { "data.name": name }, options: { page: 1, pageSize: 1 } });
  return (r?.data || [])[0] || null;
}

async function upsert(datatype, data) {
  const clean = JSON.parse(JSON.stringify(data));
  const existing = await byName(datatype, clean.name);
  if (existing) {
    await call("POST", `repository/update/${existing.sk}`, { ...existing, data: { ...existing.data, ...clean } });
    return { ...existing, data: { ...existing.data, ...clean } };
  }
  return call("PUT", "repository/create", { datatype, name: clean.name, data: clean });
}

/** Active automations or workflows that mention reservations: these could fire on the
 *  reservation records below, so the run stops and names them unless told to go on. */
async function reservationAutomations() {
  const out = [];
  for (const dt of ["automation", "workflow_definition"]) {
    const r = await call("POST", `repository/find/${dt}`, { query: {}, options: { page: 1, pageSize: 500 } }).catch(() => ({ data: [] }));
    for (const a of r?.data || []) {
      const s = JSON.stringify(a.data || {}).toLowerCase();
      const active = !["inactive", "disabled", "draft", "paused"].includes(String(a.data?.status || "active").toLowerCase()) && a.data?.enabled !== false && a.data?.active !== false;
      if (active && s.includes("reservation")) out.push(`${dt} ${a.data?.name || a.data?.title || a.sk}`);
    }
  }
  return out;
}

/** Bookings this script already wrote for these hosts in the window, as "host|start". */
async function seededSlots(source, from, to) {
  const r = await call("POST", "repository/find/reservation", {
    query: { "data.source": source, "data.startTime": { $gte: from.toISOString(), $lt: to.toISOString() } },
    options: { page: 1, pageSize: 5000 },
  });
  const have = new Map();
  for (const x of r?.data || []) {
    const key = `${x.data?.reservationDefinitionId}|${x.data?.startTime}`;
    have.set(key, (have.get(key) || 0) + 1);
    for (const h of String(x.data?.hosts || "").split(",").map((s) => s.trim()).filter(Boolean)) have.set(`${h}|${x.data?.startTime}`, 1);
  }
  return have;
}

let counter = 0;
async function book(def, saved, start, end, who, hostEmail, source, extra = {}) {
  counter++;
  await call("PUT", "repository/create", {
    datatype: "reservation",
    data: {
      name: `S${Date.now().toString(36).toUpperCase().slice(-5)}${counter}`,
      reservationDefinitionId: String(saved.sk), status: "confirmed", source,
      startTime: start.toISOString(), endTime: end.toISOString(), timezone: TZ,
      service: def.services[0].name, serviceName: def.services[0].name,
      hosts: hostEmail || "", customer: { name: who.name, email: who.email, phone: null },
      ...extra,
    },
  });
}

/* ───────────── each setup ───────────── */

async function seedTypes(label, types, forms, plans = []) {
  for (const f of forms) await upsert("crm_form", f);
  const saved = {};
  for (const t of types) saved[t.name] = await upsert("reservation_definition", t);
  for (const p of plans) await upsert("sf_subscription_plan", p);
  console.log(`  ${label}: ${types.length} booking types, ${forms.length} form${forms.length === 1 ? "" : "s"}${plans.length ? `, ${plans.length} plans` : ""}`);
  return saved;
}

/** Other patients/clients through the coming weeks: each person walks their day and takes
 *  a share of their times, so busy people show fewer open times than quiet ones. */
async function loadAppointments(label, types, saved, load, source, days = 10) {
  const window = businessDays(days, [...WEEK, "Saturday"]);
  const from = zoned(window[0].key, "00:00"), to = zoned(window[window.length - 1].key, "23:59");
  const have = await seededSlots(source, from, to);
  const now = Date.now();
  let made = 0;
  for (const [email, share] of Object.entries(load)) {
    const theirs = types.filter((t) => t.hosts.some((h) => h.email === email));
    for (const { key, wd } of window) {
      const r = rng(`${source}|${email}|${key}`);
      const open = theirs.filter((t) => t.workDays.includes(wd));
      if (!open.length) continue;
      let t = Math.min(...open.map((d) => mins(d.officeHours.startTime)));
      const close = Math.max(...open.map((d) => mins(d.officeHours.endTime)));
      while (t < close) {
        const def = open[Math.floor(r() * open.length)];
        const svc = def.services[0], step = svc.duration + (svc.breakAfter || 0);
        const startM = mins(def.officeHours.startTime);
        const aligned = startM + Math.ceil(Math.max(0, t - startM) / step) * step;
        if (aligned + svc.duration > mins(def.officeHours.endTime) || blockedAt(def, aligned, aligned + svc.duration)) { t = aligned + step; continue; }
        if (r() < share) {
          const start = zoned(key, hhmm(aligned)), end = new Date(start.getTime() + svc.duration * 60000);
          if (start.getTime() > now + 30 * 60000 && !have.has(`${email}|${start.toISOString()}`)) {
            await book(def, saved[def.name], start, end, person(r), email, source);
            have.set(`${email}|${start.toISOString()}`, 1);
            made++;
          }
          t = aligned + step;
        } else {
          t = aligned + Math.max(15, Math.min(step, 30));
        }
      }
    }
  }
  console.log(`  ${label}: ${made} other bookings added over the next ${window.length} working days`);
}

/** Members already in each class: from nearly empty to full, so the timetable shows spots left. */
async function loadClasses(types, saved, source, days = 10) {
  const window = businessDays(days + 4, [...WEEK, "Saturday", "Sunday"]).slice(0, days + 4);
  const from = zoned(window[0].key, "00:00"), to = zoned(window[window.length - 1].key, "23:59");
  const have = await seededSlots(source, from, to);
  const now = Date.now();
  let made = 0;
  for (const def of types.filter((t) => t.portal.kind === "class")) {
    const svc = def.services[0], step = svc.duration + 10;
    for (const { key, wd } of window) {
      if (!def.workDays.includes(wd)) continue;
      for (let m = mins(def.officeHours.startTime); m + svc.duration <= mins(def.officeHours.endTime); m += step) {
        if (blockedAt(def, m, m + svc.duration)) continue;
        const start = zoned(key, hhmm(m));
        if (start.getTime() < now + 60 * 60000) continue;
        const r = rng(`${source}|${def.name}|${key}|${m}`);
        // Early mornings and evenings fill; mid-day and far-off days are lighter.
        const peak = m < 8 * 60 || m >= 17 * 60 || wd === "Saturday";
        const soon = Math.max(0.35, 1 - (start.getTime() - now) / (14 * 864e5));
        const want = Math.min(def.spots, Math.round(def.spots * (peak ? 0.75 + r() * 0.35 : 0.3 + r() * 0.4) * soon));
        const already = have.get(`${saved[def.name].sk}|${start.toISOString()}`) || 0;
        for (let i = already; i < want; i++) {
          await book(def, saved[def.name], start, new Date(start.getTime() + svc.duration * 60000), person(r), def.hosts[0].email, source);
          made++;
        }
      }
    }
  }
  console.log(`  Lumen Pilates: ${made} class spots taken by other members`);
}

async function main() {
  console.log(`Seeding Scheduling setups (${ONLY.join(", ")}) on ${API} (org ${ORG})`);
  await signIn();

  if (LOAD) {
    const autos = await reservationAutomations();
    if (autos.length && !ALLOW_AUTOMATIONS) {
      console.log("These active automations mention reservations and could run on the seeded bookings:");
      for (const a of autos) console.log(`  - ${a}`);
      console.log("Look at them first, then re-run with --allow-automations, or with --no-load to skip other people's bookings.");
      process.exit(3);
    }
  }

  if (ONLY.includes("medical")) {
    const saved = await seedTypes("Cedar Family Medicine", MEDICAL_TYPES, MEDICAL_FORMS);
    if (LOAD) await loadAppointments("Cedar Family Medicine", MEDICAL_TYPES, saved, {
      [C.okafor.email]: 0.7, [C.chen.email]: 0.55, [C.mehta.email]: 0.45, [C.alvarez.email]: 0.4, [C.bell.email]: 0.25,
    }, "seed:cedar");
  }
  if (ONLY.includes("studio")) {
    const saved = await seedTypes("Lumen Pilates", STUDIO_TYPES, STUDIO_FORMS, STUDIO_PLANS);
    if (LOAD) {
      await loadClasses(STUDIO_TYPES, saved, "seed:lumen");
      await loadAppointments("Lumen Pilates privates", STUDIO_TYPES.filter((t) => t.portal.kind === "private"), saved, {
        [L.nia.email]: 0.35, [L.maya.email]: 0.2, [L.jess.email]: 0.15, [L.theo.email]: 0.1,
      }, "seed:lumen-private");
    }
  }
  if (ONLY.includes("law")) {
    const saved = await seedTypes("Hale & Mercer", LAW_TYPES, LAW_FORMS);
    if (LOAD) await loadAppointments("Hale & Mercer", LAW_TYPES, saved, {
      [F.hale.email]: 0.35, [F.mercer.email]: 0.45, [F.shah.email]: 0.3, [F.osei.email]: 0.25,
    }, "seed:halemercer");
  }
  console.log("Done.");
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
