// from base-app/src/components/content-player/ContentPlayerRoute.tsx — the same reads and the
// same way in (refusal stage → code box / sign in / not available), the same one-page rule
// and benefit drawing. Changed: reads go through src/api/content.ts (the customer's session
// rides on apiReq), the page is always "learn", there are no Site Features or site language,
// and base-app's PageState / FormCodeGate are drawn with this module's own empty-state markup.
import "server-only";
import Link from "next/link";
import { benefitApplication, courseItem, courseOutline, myCourses } from "@/api/content";
import {
  benefitsIn,
  inLanguage,
  pickLanguage,
  playerItemHtml,
  playerMineHtml,
  playerOverviewHtml,
  withBenefits,
  withCollectionForms,
  withLang,
  type BenefitLookup,
  type PlayerContext,
} from "./content-player";
import { ContentPlayerRuntime } from "./runtime";
import { CourseLanding } from "../components/landing";
import { LessonChrome } from "../components/lesson-chrome";

export const PLAYER_PAGE = "learn";

const html = (markup: string) => (
  <>
    <div className="content-player lm-cp" dangerouslySetInnerHTML={{ __html: markup }} />
    <ContentPlayerRuntime />
  </>
);

type Refusal = { status?: number; reason?: string; stage?: string; message?: string; title?: string };

/** A client/content-studio read as this visitor, or why not. */
async function lookup<T>(call: () => Promise<T>): Promise<{ view?: T; refusal?: Refusal }> {
  try {
    const res: any = await call();
    return { view: res };
  } catch (err) {
    const res = (err as any)?.response;
    const data = res?.data ?? {};
    // The exception filter puts a thrown object's fields either flat or under `error`.
    const body: any = data && typeof data.error === "object" && data.error !== null ? data.error : data;
    const message = typeof body?.message === "string" ? body.message : typeof body?.error === "string" ? body.error : undefined;
    return { refusal: { status: res?.status ?? data?.statusCode, reason: body?.reason, stage: body?.stage, title: body?.title, message } };
  }
}

/** The language the post is shown in: the one picked (`?lang=`), else the reader's profile language. */
function languageOf(view: any, picked: string, baseQuery: string, viewerLanguage?: string | null): Pick<PlayerContext, "lang" | "languages" | "baseQuery" | "originalLabel" | "query"> {
  const languages: string[] = Array.isArray(view?.course?.languages) ? view.course.languages : [];
  const lang = pickLanguage(languages, picked, viewerLanguage, "");
  return { lang, languages, baseQuery, originalLabel: "Original", query: withLang(baseQuery, picked) };
}

/** A page's benefit applications (`<wm-form data-benefit>`), drawn on the server. */
async function drawBenefits(page: any, step: { done?: boolean; preview?: boolean; signInHref: string }, forms?: Record<string, any>) {
  if (page && /<wm-form\b[^>]*\bdata-collection=/i.test(page.content || "")) page = { ...page, content: withCollectionForms(page.content, forms || page.forms) };
  const names = benefitsIn(page?.content);
  if (!names.length) return page;
  const found: Record<string, BenefitLookup> = {};
  await Promise.all(
    names.map(async (name) => {
      const { view, refusal } = await lookup(() => benefitApplication(name));
      found[name] = view ? { app: view } : { status: refusal?.status, message: refusal?.message };
    }),
  );
  return { ...page, content: withBenefits(page.content, found, step) };
}

function State({ title, message, action }: { title: string; message?: string; action?: { label: string; href: string } }) {
  return (
    <main className="wrap lm-page">
      <div className="lm-empty">
        <h3>{title}</h3>
        {message && <p>{message}</p>}
        {action && <Link className="btn clay sm" href={action.href}>{action.label}</Link>}
      </div>
    </main>
  );
}

/** base-app's FormCodeGate: the course asks for an access code. */
function CodeGate({ title, message, wrong }: { title?: string; message?: string; wrong?: boolean }) {
  return (
    <main className="wrap lm-page">
      <form className="lm-empty" method="get">
        <h3>{title || "Enter your access code"}</h3>
        <p>{wrong ? "That code isn’t right. Check it and try again." : message || "This needs an access code."}</p>
        <input name="code" className="lm-code" placeholder="Access code" autoComplete="off" required aria-label="Access code" />
        <button className="btn clay sm" type="submit">Open</button>
      </form>
    </main>
  );
}

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) || "";

export async function ContentPlayerRoute({ course, item, searchParams = {}, signedIn, exitLabel, mineTitle }: {
  course?: string; item?: string; searchParams?: { [key: string]: string | string[] | undefined }; signedIn: boolean; exitLabel?: string; mineTitle?: string;
}) {
  const hereQuery = withLang(first(searchParams.code) ? `code=${encodeURIComponent(first(searchParams.code))}` : "", first(searchParams.lang));
  const here = `/${[PLAYER_PAGE, course, item].filter(Boolean).map((s) => encodeURIComponent(String(s))).join("/")}${hereQuery ? `?${hereQuery}` : ""}`;
  const signIn = (title: string, message: string) => <State title={title} message={message} action={{ label: "Sign in", href: `/login?redirect=${encodeURIComponent(here)}` }} />;

  if (!course) {
    if (!signedIn) return signIn("Sign in to see your courses", "Your courses are kept with your account.");
    const { view: rows } = await lookup(() => myCourses());
    return html(playerMineHtml(Array.isArray(rows) ? rows : [], { page: PLAYER_PAGE, query: "", mineTitle }));
  }

  const code = first(searchParams.code);
  const { view, refusal } = await lookup(() => courseOutline(course, code || undefined));

  if (refusal) {
    // What to offer comes from which rule refused, never from the wording.
    if (refusal.stage === "access") return <CodeGate title={refusal.title} message={refusal.message} wrong={refusal.reason !== "code-required"} />;
    if (refusal.stage === "identity") return signIn(refusal.title ? `Sign in to open ${refusal.title}` : "Sign in to continue", refusal.message || "This asks who is taking it.");
    if (refusal.status === 404) return null;
    return (
      <State
        title={refusal.stage === "open" ? "Not open right now" : "This isn’t available"}
        message={refusal.message || "Nothing is published at this address."}
        action={{ label: "All courses", href: `/${PLAYER_PAGE}` }}
      />
    );
  }

  const v: any = view;
  const baseQuery = code ? `code=${encodeURIComponent(code)}` : "";
  const ctx: PlayerContext = {
    page: PLAYER_PAGE,
    // Signed out, the way in is to sign in and come back here — not a Start that fails.
    signInHref: signedIn ? "" : `/login?redirect=${encodeURIComponent(here)}`,
    exitLabel,
    ...languageOf(v, first(searchParams.lang), baseQuery, v?.viewerLanguage),
  };

  // A one-page post (a blog post, a gallery) is its page: no course page in front of it.
  const pages = (v?.items || []).filter((i: any) => i.kind === "page");
  const only = !item && pages.length === 1 ? pages[0].id : "";

  // Reading an open item needs nobody; a locked one says why on the course page.
  if (item || only) {
    const want = item || only;
    const { view: opened, refusal: closed } = await lookup(() => courseItem(course, want, code || undefined));
    const o: any = opened;
    if (o?.item) {
      const page = await drawBenefits(inLanguage(o.page, ctx.lang), { done: !!o.progress?.done, signInHref: `/login?redirect=${encodeURIComponent(here)}` }, o.forms);
      // appmint-one: the page is base-app's, framed by the lesson bar (components/lesson-chrome.tsx).
      return <LessonChrome view={v} current={o.item.id}>{html(playerItemHtml(v, { ...o, page }, ctx))}</LessonChrome>;
    }
    return overview(v, ctx, closed?.message, signedIn);
  }
  return overview(v, ctx, undefined, signedIn);
}

/**
 * appmint-one: a course (`layout: "sidebar"`) gets the landing page drawn from the same
 * outline (components/landing.tsx — same Start / sign in / Continue contract). Anything
 * else (an application, a stepped form) keeps base-app's overview as it is.
 */
function overview(v: any, ctx: PlayerContext, notice: string | undefined, signedIn: boolean) {
  if (v?.course?.layout === "sidebar" && v?.course?.navigation !== "top") {
    return <CourseLanding view={v} signInHref={ctx.signInHref || ""} notice={notice} query={ctx.query} signedIn={signedIn} />;
  }
  return html(playerOverviewHtml(v, notice ? { ...ctx, notice } : ctx));
}

