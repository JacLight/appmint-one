import { SETUPS } from "@/setups";
import { getSetup, setupSwitchAllowed } from "@/lib/setup";

/** Dev / preview only: a small corner menu to flip between setups on one server. */
export async function SetupSwitcher() {
  if (!setupSwitchAllowed()) return null;
  const active = await getSetup();
  return (
    <details className="setup-switcher">
      <summary title={`Setup: ${active.brand.name}`}><b aria-hidden="true">⇄</b><span>Setup: {active.brand.name}</span></summary>
      <ul>
        {SETUPS.map((s) => (
          <li key={s.id}>
            <a href={`/switch-setup?id=${s.id}`} aria-current={s.id === active.id ? "true" : undefined}>
              {s.brand.name} <span>{s.id}</span>
            </a>
          </li>
        ))}
        <li><a href="/switch-setup?id=reset">Reset to PORTAL_SETUP</a></li>
      </ul>
    </details>
  );
}
