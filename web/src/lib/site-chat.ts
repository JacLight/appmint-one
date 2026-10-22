import "server-only";
import { apiReq } from "@/lib/api";
import { getSetup } from "@/lib/setup";
import { isOn } from "@/setups/modules";
import { runtimeEnv } from "@/lib/runtime-env";

export type ChatSettings = { configId?: string; appId?: string; source: string };

/** Cached for a minute — the config changes rarely and this runs on every page. */
let cache: { at: number; key: string; value: ChatSettings } | null = null;
const TTL_MS = 60_000;

/**
 * Which chat the support widget opens, first match wins:
 *   1. env PORTAL_CHAT_CONFIG_ID + PORTAL_CHAT_APP_ID (per deployment),
 *   2. the setup's `support.chat`,
 *   3. Rentals setups: `GET client/stowbo/chat-config` (the chat the org's Stowbo
 *      site points at — the only engine route that serves this today).
 * Nothing set → no widget, never another org's config.
 */
export async function getChatSettings(): Promise<ChatSettings> {
  const setup = await getSetup();
  if (cache && cache.key === setup.id && Date.now() - cache.at < TTL_MS) return cache.value;
  let value: ChatSettings = { source: "none" };
  const envCfg = runtimeEnv("PORTAL_CHAT_CONFIG_ID");
  const envApp = runtimeEnv("PORTAL_CHAT_APP_ID");
  if (envCfg && envApp) value = { configId: envCfg, appId: envApp, source: "env" };
  else if (setup.support.chat?.configId && setup.support.chat?.appId) value = { ...setup.support.chat, source: `setup:${setup.id}` };
  else if (isOn(setup, "rentals")) {
    try {
      const cc: any = await apiReq("GET", "client/stowbo/chat-config");
      if (cc?.configId && cc?.appId) value = { configId: cc.configId, appId: cc.appId, source: `site:${cc.site || "stowbo"}` };
    } catch { /* engine without the route → no chat rather than a guessed config */ }
  }
  cache = { at: Date.now(), key: setup.id, value };
  return value;
}
