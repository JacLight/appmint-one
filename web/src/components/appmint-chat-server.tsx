import Link from "next/link";
import { AppmintChat, type ChatUser } from "@/components/appmint-chat";
import { getChatSettings } from "@/lib/site-chat";
import { runtimeEnv } from "@/lib/runtime-env";

/** The engine the widget (in the browser) talks to: CHAT_API_HOST — the engine's
 *  browser-reachable URL (local: 127.0.0.1:3300; prod: appengine.appmint.io). An in-cluster
 *  service address would be unreachable from a browser, so it is ignored. */
function widgetApiHost(): string | undefined {
  const ep = runtimeEnv("CHAT_API_HOST").replace(/\/+$/, "");
  if (!ep || /\.svc\.cluster\.local|\.internal(:|\/|$)/.test(ep)) return undefined;
  return ep;
}

/** Server wrapper: the chat config comes from lib/site-chat (env → setup → rentals site);
 *  only org and engine host come from env. Must NOT live in the "use client" file —
 *  there `process.env` is empty and the widget renders nothing.
 *  `fallback` renders an honest note when no chat is configured (Support page). */
export async function AppmintChatServer({ inline, chatUser, containerId, fallback }: { inline?: boolean; chatUser?: ChatUser; containerId?: string; fallback?: boolean } = {}) {
  const chat = await getChatSettings();
  if (!chat.configId || !chat.appId) {
    return fallback ? (
      <div className="chat-off">
        <b>Live chat isn’t switched on yet.</b>
        <span>Send us a message from your inbox and we’ll reply there.</span>
        <Link className="btn ghost sm" href="/account/messages">Open messages</Link>
      </div>
    ) : null;
  }
  return (
    <AppmintChat
      configId={chat.configId} appId={chat.appId} orgId={runtimeEnv("ORG_ID")}
      inline={inline} chatUser={chatUser} containerId={containerId}
      apiHost={widgetApiHost()}
      source={chat.source}
      {...(inline ? { defaultPath: "/chat", mode: "chat" as const } : {})}
    />
  );
}
