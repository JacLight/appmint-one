import { ImageResponse } from "next/og";
import { getSetup } from "@/lib/setup";

export const alt = "Share card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default social share card, drawn from the active setup's palette. */
export default async function OgImage() {
  const { brand } = await getSetup();
  const c = brand.colors;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: c.bg, padding: "72px 80px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: c.accent, display: "flex", alignItems: "center", justifyContent: "center", color: c.accentInk || "#fff", fontSize: 40, fontWeight: 700 }}>{brand.name.slice(0, 1).toUpperCase()}</div>
          <div style={{ fontSize: 40, fontWeight: 700, color: c.text, letterSpacing: -1 }}>{brand.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, color: c.text, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>{brand.tagline}</div>
          <div style={{ fontSize: 30, color: c.muted, lineHeight: 1.35, maxWidth: 900 }}>{brand.description}</div>
        </div>
        <div style={{ display: "flex", width: 120, height: 10, borderRadius: 5, background: c.primary }} />
      </div>
    ),
    { ...size },
  );
}
