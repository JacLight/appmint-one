"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const LOADER = "https://web.appmint.space/chat-client/appmint-chat.js";

export type ChatUser = { email?: string; name?: string; phone?: string };
type Props = {
  orgId?: string; configId?: string; appId?: string;
  theme?: string; language?: string; containerId?: string;
  /** "/chat" opens straight into the conversation; the widget's own default is its launcher. */
  defaultPath?: string;
  mode?: "chat" | "qa";
  /** Pre-pass the signed-in person so the widget skips its registration form. */
  chatUser?: ChatUser;
  /** Render inline (a panel inside the page) instead of the floating launcher. */
  inline?: boolean;
  /** Engine the widget should talk to (local dev); unset = the widget's own default. */
  apiHost?: string;
  /** where the config came from — surfaced as a data attribute for debugging */
  source?: string;
};

/** One shared load of the AppMint chat loader. The loader daily-cache-busts itself
 *  (`?d=`) so a new release reaches this site within a day without a CDN purge; the
 *  loader in turn versions the widget's own main.js / main.css. */
function loadChatClient(): Promise<void> {
  const w = window as unknown as { __appmintChatLoad?: Promise<void>; AppmintChat?: unknown };
  if (w.AppmintChat) return Promise.resolve();
  if (w.__appmintChatLoad) return w.__appmintChatLoad;
  w.__appmintChatLoad = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.id = "appmint-chat-script";
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    s.src = `${LOADER}?d=${day}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load the AppmintChat script."));
    document.body.appendChild(s);
  });
  return w.__appmintChatLoad;
}

/** AppMint's hosted chat widget — the same embed appmint.io uses (ported from its
 *  src/components/AppmintChat.tsx). The widget brings its own styles. */
function AppmintChatWidget({ orgId, configId, appId, theme = "light", language = "en", containerId = "appmint-chat-container", defaultPath = "", mode, chatUser, inline, apiHost, source }: Props) {
  useEffect(() => {
    let live = true;
    loadChatClient().then(() => {
      if (!live) return;
      const w = window as unknown as { AppmintChat?: { init: (o: Record<string, unknown>) => void } };
      if (!w.AppmintChat) { console.error("AppmintChat is not available on window."); return; }
      w.AppmintChat.init({
        containerId, orgId, configId, appId, className: "", style: {}, defaultPath, theme, language,
        ...(mode ? { mode } : {}),
        ...(inline ? { inline: true } : {}),
        ...(apiHost ? { apiHost } : {}),
        ...(chatUser && (chatUser.email || chatUser.phone) ? { chatUser } : {}),
      });
    }).catch((e) => console.error(e));
    return () => { live = false; };
  }, [orgId, configId, appId, theme, language, containerId, defaultPath, mode, inline, apiHost, chatUser?.email, chatUser?.name, chatUser?.phone]);

  return <div id={containerId} className={inline ? "appmint-chat appmint-chat-inline" : "appmint-chat"} data-chat-config={configId} data-chat-source={source} />;
}

export function AppmintChat(props: Props) {
  const path = usePathname() || "/";
  if (!props.configId || !props.appId) return null;
  // The Support page embeds the chat inline — the floating launcher would be a second copy.
  if (!props.inline && path.startsWith("/account/support")) return null;
  return <AppmintChatWidget {...props} />;
}
