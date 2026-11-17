'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';

/** Menu de três riscos do celular: fecha ao escolher uma opção, ao trocar de página ou ao tocar fora. */
export function MobileMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => { if (ref.current) ref.current.open = false; }, [path]);
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const d = ref.current;
      if (d?.open && !d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, []);
  return (
    <details ref={ref} className="st-menu md:hidden">
      <summary aria-label="Menu"><span /><span /><span /></summary>
      <div
        className="st-menu-pop"
        onClick={e => { if ((e.target as HTMLElement).closest('a,button') && ref.current) ref.current.open = false; }}
      >
        {children}
      </div>
    </details>
  );
}
