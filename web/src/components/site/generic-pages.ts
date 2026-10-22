import type { LegalNode, PageBlock, Setup, SitePage } from "@/setups/types";
import { MODULES, lower, moduleLabel, term } from "@/setups/modules";

/** Help + legal pages for setups that don't ship their own (everything except Stowbo).
 *  Kept deliberately short: a business that wants a full website uses an AppMint site.
 *  Blank legal/support fields are reported as "not supplied yet" — never invented. */

const name = (s: Setup) => s.legal.shortName || s.brand.name;
const contactLine = (s: Setup) =>
  s.legal.email || s.support.email
    ? `Questions? Email [${s.legal.email || s.support.email}](mailto:${s.legal.email || s.support.email}).`
    : "Questions? Message us from [your account](/account/support).";

function missing(s: Setup): string[] {
  const out: string[] = [];
  if (!s.legal.entityName) out.push("legal entity name");
  if (!s.legal.jurisdiction) out.push("governing law");
  if (!s.legal.email) out.push("legal contact email");
  if (!s.legal.effectiveDate) out.push("effective date");
  return out;
}

function draftCallout(s: Setup): { title: string; body: string } | undefined {
  const gaps = missing(s);
  if (!gaps.length) return undefined;
  return {
    title: "Not supplied yet",
    body: `${name(s)} hasn't supplied its ${gaps.join(", ")}. This page is a template and is not a binding agreement until those details are added.`,
  };
}

function head(s: Setup, title: string, sub: string): PageBlock {
  return {
    type: "pagehead", eyebrow: "Legal", title, sub,
    updated: s.legal.effectiveDate ? `Last updated ${s.legal.effectiveDate}` : undefined,
  };
}

const entity = (s: Setup) => s.legal.entityName || name(s);

export function helpPage(s: Setup): SitePage {
  const customer = lower(s, "customer");
  const faqSection = s.home.sections.find((x) => x.type === "faq");
  const modules = s.modules.map((id) => `**${moduleLabel(s, id)}** — ${s.moduleCopy?.[id]?.blurb || MODULES[id].customer[0] || ""}`.trim());
  const groups: Extract<PageBlock, { type: "faq" }>["groups"] = [];
  if (faqSection && faqSection.type === "faq") groups.push({ id: "common", title: "Common questions", items: faqSection.items });
  groups.push({
    id: "account", title: "Your account",
    items: [
      { q: "How do I create an account?", a: `[Create an account](/signup) with your email, or sign in with Google or Facebook. One account covers everything ${name(s)} offers.` },
      { q: "I forgot my password", a: "Use [Forgot password](/forgot-password) on the sign-in page. We'll email you a link to set a new one." },
      { q: "Where are my documents?", a: "Files you upload and forms you've submitted are under [Documents](/account/documents) in your account." },
      { q: "How do I contact the team?", a: `Send a message from [Support](/account/support) in your account${s.support.email ? ` or email [${s.support.email}](mailto:${s.support.email})` : ""}.` },
    ],
  });
  return {
    slug: "help",
    title: "Help Center",
    description: `Answers for ${customer}s of ${name(s)}.`,
    blocks: [
      { type: "helphero", title: "How can we help?", sub: `Quick answers about your ${name(s)} account${modules.length ? " and what you can do with it" : ""}.` },
      ...(modules.length ? [{ type: "checklist", head: { eyebrow: "What's here", title: `What you can do with ${name(s)}` }, columns: [{ title: term(s, "account"), items: [...modules, "**Wallet** — balance and payment history", "**Messages** — talk to the team", "**Documents** — files and forms"] }] } as PageBlock] : []),
      { type: "faq", flush: true, groups },
      {
        type: "cta", flush: true, eyebrow: "Still need help?", title: `Talk to ${name(s)}`,
        body: [s.support.hours, s.support.phone].filter(Boolean).join(" · ") || "Message us from your account and we'll get back to you.",
        actions: [{ label: "Contact support", href: "/account/support", kind: "lime" }],
      },
    ],
  };
}

export function termsPage(s: Setup): SitePage {
  const e = entity(s);
  const sections: { id: string; title: string; body: LegalNode[] }[] = [
    { id: "agreement", title: "1. Agreement", body: [{ p: `These terms are an agreement between you and ${e} ("we") for using the ${name(s)} website and account.` }] },
    { id: "account", title: "2. Your account", body: [{ ul: ["You must give accurate information and keep your sign-in details safe.", "You're responsible for activity on your account.", "We may suspend accounts that break these terms."] }] },
    { id: "payments", title: "3. Payments", body: [{ p: "Prices, fees and refund rules are shown before you pay. Payments are processed by our payment provider." }] },
    { id: "content", title: "4. Your content", body: [{ p: "You keep ownership of files and messages you upload. You give us permission to store and show them to provide the service." }] },
    { id: "liability", title: "5. Liability", body: [{ p: "The service is provided as is. To the extent the law allows, we aren't liable for indirect or consequential losses." }] },
    { id: "law", title: "6. Governing law", body: [{ p: s.legal.jurisdiction ? `These terms are governed by the laws of ${s.legal.jurisdiction}.` : "Governing law: not supplied yet." }] },
  ];
  return {
    slug: "terms", title: "Terms of Service",
    blocks: [head(s, "Terms of Service", `The agreement between you and ${e} when you use ${name(s)}.`),
      { type: "legal", toc: sections.map((x) => ({ id: x.id, label: x.title.replace(/^\d+\.\s*/, "") })), callout: draftCallout(s), sections, contact: contactLine(s) }],
  };
}

export function privacyPage(s: Setup): SitePage {
  const e = entity(s);
  const sections: { id: string; title: string; body: LegalNode[] }[] = [
    { id: "collect", title: "1. What we collect", body: [{ ul: ["Account details: name, email, phone.", "What you do in your account: bookings, orders, messages, uploaded files.", "Payment records (card details are held by our payment provider, not by us).", "Basic device and usage data."] }] },
    { id: "use", title: "2. How we use it", body: [{ p: "To run your account, process payments, answer you, keep the service secure and meet legal obligations. We don't sell your personal information." }] },
    { id: "share", title: "3. Who we share it with", body: [{ p: "Service providers that host, process payments or send messages for us, and authorities when the law requires it." }] },
    { id: "rights", title: "4. Your choices", body: [{ p: "You can view and update your details in your account settings, and ask us to export or delete your data." }] },
  ];
  return {
    slug: "privacy", title: "Privacy Policy",
    blocks: [head(s, "Privacy Policy", `How ${e} collects, uses and protects your information.`),
      { type: "legal", toc: sections.map((x) => ({ id: x.id, label: x.title.replace(/^\d+\.\s*/, "") })), callout: draftCallout(s), sections, contact: contactLine(s) }],
  };
}

export function cookiesPage(s: Setup): SitePage {
  const sections: { id: string; title: string; body: LegalNode[] }[] = [
    { id: "what", title: "1. What cookies are", body: [{ p: "Small files a website stores in your browser to remember things between visits." }] },
    { id: "ours", title: "2. Cookies we use", body: [{ table: { head: ["Type", "Why"], rows: [["Essential", "Keep you signed in and secure your session."], ["Preferences", "Remember choices such as your last view."], ["Analytics", "Count visits so we can improve the site (only when enabled)."]] } }] },
    { id: "control", title: "3. Your control", body: [{ p: "You can clear or block cookies in your browser settings. Blocking essential cookies will sign you out." }] },
  ];
  return {
    slug: "cookies", title: "Cookie Policy",
    blocks: [head(s, "Cookie Policy", `How ${name(s)} uses cookies.`),
      { type: "legal", toc: sections.map((x) => ({ id: x.id, label: x.title.replace(/^\d+\.\s*/, "") })), callout: draftCallout(s), sections, contact: contactLine(s) }],
  };
}
