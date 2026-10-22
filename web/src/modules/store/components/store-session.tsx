'use client';
// Hands the signed-in customer (read on the server) to the ported storefront's activeSession.
import { activeSession } from '@/modules/store/lib/active-session';

export interface StoreSessionUser { id: string; email: string; firstName?: string; lastName?: string; phone?: string }

export function StoreSession({ user }: { user: StoreSessionUser | null }) {
  activeSession.setSessionUser(user ? {
    sk: user.id, id: user.id, email: user.email, name: user.email,
    data: { email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone },
  } : null);
  return null;
}
