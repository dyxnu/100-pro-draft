'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChatBox } from './ChatBox';
import { roomChannel } from './shared';
import './chat.css';

/** Chat da sala flutuante (canto inferior esquerdo) durante o leilão e o campeonato. */
export function RoomChatDock({ roomId, meId, canSend }: { roomId: string; meId: string; canSend: boolean }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  return (
    <div className="ch-dock left">
      <section className="ch-panel" hidden={!open} aria-label="Chat da sala">
        <header><b>🛡 Chat da sala</b><button onClick={() => setOpen(false)} aria-label="Minimizar">—</button></header>
        <ChatBox
          channel={roomChannel(roomId)} meId={meId} canSend={canSend}
          readOnlyHint="Só quem está na sala pode falar aqui."
          onNew={() => { if (!open) setUnread(n => n + 1); }}
        />
      </section>
      {!open && (
        <button className="ch-fab room" onClick={() => { setOpen(true); setUnread(0); }} aria-label="Abrir chat da sala">
          🛡 <span>Chat da sala</span>{unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}
        </button>
      )}
    </div>
  );
}

/** Aviso para quem entrou como convidado (some até a próxima sessão ao fechar). */
export function GuestBanner() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try { if (sessionStorage.getItem('ch-guest-hide') === '1') setHidden(true); } catch { /* ignora */ }
  }, []);
  if (hidden) return null;
  return (
    <div className="ch-guest" role="note">
      <p>👤 Você está jogando como <b>convidado</b> — crie uma conta para ganhar elo, essência azul, skins e histórico.</p>
      <Link href="/cadastro" className="ch-guest-cta">Criar conta</Link>
      <button aria-label="Fechar aviso" onClick={() => { setHidden(true); try { sessionStorage.setItem('ch-guest-hide', '1'); } catch { /* ignora */ } }}>✕</button>
    </div>
  );
}
