'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarPicker } from './Avatar';

/** Ícone do próprio perfil, clicável para trocar. */
export function ProfileAvatar({ current }: { current: string | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group relative shrink-0" title="Trocar ícone">
        <Avatar id={current} size={80} color="#b48a2f" />
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold2 px-2 py-0.5 text-[10px] font-bold text-white opacity-90 group-hover:opacity-100">
          Trocar
        </span>
      </button>
      {open && <AvatarPicker current={current} onClose={() => setOpen(false)} onSaved={() => router.refresh()} />}
    </>
  );
}
