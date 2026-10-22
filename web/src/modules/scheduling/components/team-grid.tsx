import type { TeamMember } from "../lib/types";
import { Img } from "./bits";

/** People: round headshots (studio), tall portraits (clinic, firm). */
export function TeamGrid({ people, variant = "round", children }: { people: TeamMember[]; variant?: "round" | "portrait"; children?: (m: TeamMember) => React.ReactNode }) {
  return (
    <div className={`sc-team ${variant}`}>
      {people.map((m) => (
        <article key={m.email} className="sc-person">
          <div className="sc-person-ph"><Img src={m.photo} alt={m.name} w={variant === "round" ? 400 : 600} /></div>
          <div className="sc-person-b">
            <h3>{m.name}</h3>
            {m.title && <p className="sc-person-t">{m.title}</p>}
            {m.specialties?.length ? <p className="sc-person-s">{m.specialties.join(" · ")}</p> : m.practice ? <p className="sc-person-s">{m.practice}</p> : null}
            {variant === "portrait" && m.credentials && <p className="sc-person-c">{m.credentials}</p>}
            {m.languages?.length ? <p className="sc-person-c">Speaks {m.languages.join(", ")}</p> : null}
            {children?.(m)}
          </div>
        </article>
      ))}
    </div>
  );
}
