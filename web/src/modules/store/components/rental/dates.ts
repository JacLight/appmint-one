// from base-app/src/components/rental/dates.ts — ported verbatim; only import paths rewired.
/** A calendar day as YYYY-MM-DD in the browser's own time zone (toISOString gives the UTC day). */
export const localDateString = (d: Date | string | null | undefined): string => {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x.getTime())) return '';
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/**
 * A rental date for display. A plain calendar day ("2026-10-11") is that day wherever the customer is;
 * `new Date("2026-10-11")` reads it as UTC midnight, which shows the day before west of UTC.
 */
export const showRentalDate = (s?: string | null, opts?: Intl.DateTimeFormatOptions): string => {
  if (!s) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(opts ? 'en-US' : undefined, opts);
};

/** "daily" -> "day": the unit a rental rate is per. */
export const rentalUnit = (period?: string): string =>
  ({ hourly: 'hour', daily: 'day', weekly: 'week', monthly: 'month' } as Record<string, string>)[String(period || '')] || String(period || '');

/** Rich text (from Studio's editor) as one plain line for a card: tags removed, entities decoded, spaces collapsed. */
export const plainText = (html?: string | null): string =>
  String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
