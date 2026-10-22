"use client";
/**
 * The Content Player's browser side, as base-app runs it:
 *   - base-app/src/runtime/content-player-contract.ts (ported verbatim) — forms, "I've read
 *     it", watched %, saved answers, rows and rules;
 *   - base-app/src/runtime/namespaces.ts `contentPlayer` (ported verbatim) — the calls;
 *   - the dispatcher's `data-action` / `data-on-success` handling
 *     (base-app/src/runtime/dispatcher.ts: the click handler, runEffects, interp), cut to
 *     what the player's HTML uses: `contentPlayer.*` actions, `navigate:` / `reload` /
 *     `notify-error:` effects and `{{field}}` from the action's result.
 */
import { useEffect } from "react";
import { installContentPlayerContract } from "./content-player-contract";
import { createContentPlayerNamespace } from "./namespace";
import { Transport } from "./transport";

type Ns = ReturnType<typeof createContentPlayerNamespace>;

const pathInto = (obj: any, path: string) => path.split(".").reduce((v, k) => (v == null ? undefined : v[k]), obj);
const interp = (s: string, result?: unknown) => (s ? s.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, p) => { const v = pathInto(result, String(p).trim()); return v == null ? "" : String(v); }) : s);

function runEffects(spec: string | null, result: unknown) {
  if (!spec) return;
  for (const entry of spec.split("|").map((s) => s.trim()).filter(Boolean)) {
    const colon = entry.indexOf(":");
    const name = colon === -1 ? entry : entry.slice(0, colon);
    const arg = colon === -1 ? "" : interp(entry.slice(colon + 1), result);
    if (name === "navigate") window.location.href = arg;
    else if (name === "reload") window.location.reload();
    else if (name === "notify" || name === "notify-error") window.dispatchEvent(new CustomEvent("appmint:notify", { detail: { message: arg, kind: name === "notify" ? "info" : "error" } }));
  }
}

let installed = false;

function install() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  const ns: Ns = createContentPlayerNamespace(new Transport() as any);
  installContentPlayerContract(ns);

  document.addEventListener("click", async (e) => {
    const el = (e.target as Element)?.closest?.('[data-action^="contentPlayer."]') as HTMLElement | null;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const method = (el.getAttribute("data-action") || "").slice("contentPlayer.".length) as keyof Ns;
    const fn = ns[method] as ((input?: any) => Promise<any>) | undefined;
    if (typeof fn !== "function" || el.hasAttribute("data-loading")) return;
    el.setAttribute("data-loading", "");
    el.setAttribute("disabled", "");
    try {
      const result = await fn({});
      runEffects(el.getAttribute("data-on-success"), result);
    } catch (err: any) {
      const d = err?.details;
      const nested = d && typeof d.error === "object" && d.error ? d.error : d;
      const message = nested?.message || err?.message || "Action failed";
      runEffects(el.getAttribute("data-on-error") || `notify-error:${message}`, err);
      // said where it happened, as the contract does for its own refusals
      let note = el.previousElementSibling as HTMLElement | null;
      if (!note?.matches?.("[data-player-error]")) {
        note = document.createElement("div");
        note.className = "cp-note is-warn";
        note.setAttribute("data-player-error", "");
        note.setAttribute("role", "alert");
        el.insertAdjacentElement("beforebegin", note);
      }
      note.textContent = message;
    } finally {
      el.removeAttribute("data-loading");
      el.removeAttribute("disabled");
    }
  });
}

export function ContentPlayerRuntime() {
  useEffect(() => { install(); }, []);
  return null;
}
