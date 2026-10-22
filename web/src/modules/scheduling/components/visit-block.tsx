import type { SchedulingConfig } from "@/setups/scheduling-config";
import { Ic, Img } from "./bits";

/** Where to find the business: address, hours, phone, with a photo of the place. */
export function VisitBlock({ cfg, title }: { cfg: SchedulingConfig; title?: string }) {
  const p = cfg.place;
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.street}, ${p.city}`)}`;
  return (
    <section className="wrap sc-sec sc-visit">
      <div className="sc-visit-ph"><Img src={p.image} alt={`Inside ${p.name}`} w={1200} /></div>
      <div className="sc-visit-b">
        <p className="eyebrow">{title || "Visit us"}</p>
        <h2>{p.name}</h2>
        <a className="sc-visit-addr" href={map} target="_blank" rel="noreferrer"><Ic n="pin" /> <span>{p.street}<br />{p.city}</span></a>
        {p.phone && <a className="sc-visit-addr" href={`tel:${p.phone.replace(/[^0-9+]/g, "")}`}><Ic n="phone" /> <span>{p.phone}</span></a>}
        <ul className="sc-hours">{p.hours.map(([d, h]) => <li key={d}><span>{d}</span><b>{h}</b></li>)}</ul>
        {p.note && <p className="sc-visit-note">{p.note}</p>}
      </div>
    </section>
  );
}
