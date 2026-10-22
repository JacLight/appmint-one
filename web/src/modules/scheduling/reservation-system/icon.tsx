// Stands in for base-app/src/components/ui/icon-renderer (same props), drawing lucide icons.
import { Calendar, Check, CheckCircle, Clock, Mail, MapPin, Phone, Search, User, X, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { Calendar, Check, CheckCircle, Clock, Mail, MapPin, Phone, Search, User, X };

export function IconRenderer({ icon, className, color }: { icon: string; className?: string; color?: string }) {
  const I = ICONS[icon] || Calendar;
  return <I className={className} color={color} aria-hidden />;
}
