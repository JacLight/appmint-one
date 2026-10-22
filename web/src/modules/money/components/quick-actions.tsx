import Link from "next/link";
import { Icon, type IconName } from "./icons";

const B = "/account/banking";
const ACTIONS: { label: string; href: string; icon: IconName; primary?: boolean }[] = [
  { label: "Send", href: `${B}/send`, icon: "sendUp", primary: true },
  { label: "Receive", href: `${B}/receive`, icon: "receive" },
  { label: "Request", href: `${B}/request`, icon: "request" },
  { label: "Move", href: `${B}/send/own`, icon: "swap" },
];

/** Send · Receive · Request · Move — pills on desktop, round buttons on a phone. */
export function QuickActions() {
  return (
    <nav className="mn-qa" aria-label="Move money">
      {ACTIONS.map((a) => (
        <Link key={a.label} href={a.href} className={a.primary ? "primary" : ""}>
          <span className="ic"><Icon name={a.icon} size={18} /></span>
          <span className="lb">{a.label}</span>
        </Link>
      ))}
    </nav>
  );
}
