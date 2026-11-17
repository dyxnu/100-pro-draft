'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AvatarPicker } from './Avatar';
import { FramedIcon } from './FramedIcon';

/** Ícone do próprio perfil (com borda e nível), clicável para trocar. */
export function ProfileAvatar({ current, border = null, level = 1, ownedIcons }: {
  current: string | null; border?: string | null; level?: number; ownedIcons?: number[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="pf-icon-btn" title="Trocar ícone">
        <FramedIcon id={current} border={border} level={level} />
        <span className="pf-icon-edit">Trocar</span>
      </button>
      {open && <AvatarPicker current={current} ownedIcons={ownedIcons} onClose={() => setOpen(false)} onSaved={() => router.refresh()} />}
    </>
  );
}
