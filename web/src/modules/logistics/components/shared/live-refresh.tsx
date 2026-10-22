"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Live-ish tracking: there is no tracking socket, so while a job is moving the page
 *  re-reads the job from the engine every `seconds` (only while the tab is visible). */
export function LiveRefresh({ seconds = 10, active = true }: { seconds?: number; active?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const tick = () => { if (document.visibilityState === "visible") router.refresh(); };
    const id = window.setInterval(tick, Math.max(5, seconds) * 1000);
    const onVis = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [router, seconds, active]);
  return null;
}
