"use client";

type Kind = "error" | "success" | "info";

const styles: Record<Kind, { bg: string; border: string; fg: string }> = {
  error: { bg: "#fbe9e2", border: "#e7b39c", fg: "#a5401f" },
  success: { bg: "var(--accent-soft)", border: "#bcd3b0", fg: "var(--accent-strong)" },
  info: { bg: "var(--primary-soft)", border: "#ecd3c2", fg: "var(--text-2)" },
};

/**
 * Inline, PERSISTENT alert. It stays visible until the user dismisses it or the
 * source is fixed — no auto-dismissing popups/toasts anywhere in the app.
 */
export function Alert({
  kind = "error",
  children,
  onDismiss,
}: {
  kind?: Kind;
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const s = styles[kind];
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.fg,
        borderRadius: 12,
        padding: "12px 14px",
        fontSize: 14,
        lineHeight: 1.45,
        margin: "0 0 16px",
      }}
    >
      <span aria-hidden style={{ fontWeight: 700, flex: "none", marginTop: -1 }}>
        {kind === "error" ? "⚠" : kind === "success" ? "✓" : "ℹ"}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{ flex: "none", background: "none", border: 0, color: s.fg, cursor: "pointer", fontSize: 16, lineHeight: 1, opacity: 0.7 }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
