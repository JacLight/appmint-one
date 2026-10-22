import Link from "next/link";

/** Honest empty/placeholder state — never a fake page, never a 404. */
export function EmptyState({
  title,
  note,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  note?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="tcard" style={{ textAlign: "center", padding: "44px 24px" }}>
      <h3 style={{ fontSize: 18 }}>{title}</h3>
      {note && <p className="muted" style={{ marginTop: 8, maxWidth: "44ch", marginInline: "auto" }}>{note}</p>}
      {ctaLabel && ctaHref && (
        <Link className="btn clay sm" href={ctaHref} style={{ marginTop: 16 }}>{ctaLabel}</Link>
      )}
    </div>
  );
}
