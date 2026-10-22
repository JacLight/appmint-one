// from base-app/src/components/my-account/reservation-display.ts
/** Reservation dates describe the booked appointment, never record creation. */
export function reservationDisplay(record: any) {
  const data = record?.data || record || {};
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  // serviceName is the human label the booking was saved with (the booking type's title when no
  // service was picked); `service` can be a slug such as "initial-legal-consultation".
  const service = text(data.serviceName) || text(data.service?.name) || text(data.service?.data?.name) || text(data.service) || 'Service not available';
  const status = text(data.status).toLowerCase() || 'unknown';
  const zone = text(data.timezone) || text(data.businessTimezone);
  let validZone = false;
  try { if (zone) { new Intl.DateTimeFormat('en-US', {timeZone: zone}).format(0); validZone = true; } } catch {}
  const parse = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return null;
    // An instant must include an offset; do not silently use the browser zone.
    if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
    const result = new Date(value);
    return Number.isFinite(result.getTime()) ? result : null;
  };
  const start = parse(data.startTime), end = parse(data.endTime);
  const timeZone = validZone ? zone : 'UTC';
  const format = (date: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', {...options, timeZone}).format(date);
  const date = start ? format(start, {month:'short', day:'numeric', year:'numeric'}) : 'Date not available';
  const clock = (value: Date) => format(value, {hour:'numeric', minute:'2-digit'});
  const differentDay = start && end && format(start, {year:'numeric',month:'numeric',day:'numeric'}) !== format(end,{year:'numeric',month:'numeric',day:'numeric'});
  const time = start ? `${clock(start)}${end && end >= start ? ` – ${differentDay ? format(end,{month:'short',day:'numeric'})+' ' : ''}${clock(end)}` : ''}` : 'Time not available';
  return {service, status, date, time, timezone: validZone ? zone : 'UTC (business timezone unavailable)', reference:text(data.name), type:text(data.serviceType)||text(data.type)};
}
export function matchesReservation(record: any, query: string, status: string) {
  const display = reservationDisplay(record);
  return (status === 'all' || display.status === status.toLowerCase()) &&
    [display.service,display.type,display.reference].some(value=>value.toLowerCase().includes(query.trim().toLowerCase()));
}
