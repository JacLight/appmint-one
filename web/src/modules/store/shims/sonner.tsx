'use client';
// Stand-in for the `sonner` toast package (not installed in appmint-one): same toast()
// calls, shown by <Toaster/> as a small status line.
import { useEffect, useState } from 'react';

type Kind = 'success' | 'error' | 'info' | 'warning' | 'message';
type Item = { id: number; kind: Kind; text: string };
let seq = 0;
const listeners = new Set<(i: Item) => void>();
const emit = (kind: Kind, text: any) => { const i = { id: ++seq, kind, text: String(text ?? '') }; listeners.forEach((l) => l(i)); return i.id; };

export const toast: any = Object.assign((t: any) => emit('message', t), {
  success: (t: any) => emit('success', t),
  error: (t: any) => emit('error', t),
  info: (t: any) => emit('info', t),
  warning: (t: any) => emit('warning', t),
  message: (t: any) => emit('message', t),
  dismiss: () => {},
});

export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    const on = (i: Item) => {
      setItems((xs) => [...xs, i].slice(-3));
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== i.id)), 3500);
    };
    listeners.add(on);
    return () => { listeners.delete(on); };
  }, []);
  if (!items.length) return null;
  return (
    <div className="sf-toaster" role="status" aria-live="polite">
      {items.map((i) => <div key={i.id} className={`sf-toast sf-toast-${i.kind}`}>{i.text}</div>)}
    </div>
  );
}
