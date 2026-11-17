'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChatBox } from './ChatBox';
import { roomChannel } from './shared';
import './chat.css';

const KEY = 'ch-global-open';

/** Botão flutuante (canto inferior direito) que abre o chat global. */
export function GlobalChatDock({ meId, canSend }: { meId: string; canSend: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false); // só conecta depois da primeira abertura
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === '1') { setOpen(true); setMounted(true); }
    } catch { /* sem armazenamento */ }
  }, []);
  const toggle = () => {
    const v = !open;
    setOpen(v);
    if (v) { setMounted(true); setUnread(0); }
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* ignora */ }
  };

  return (
    <div className="ch-dock right">
      {mounted && (
        <section className="ch-panel" hidden={!open} aria-label="Chat global">
          <header><b>🌙 Chat global</b><button onClick={toggle} aria-label="Fechar">✕</button></header>
          <ChatBox
            channel="global" meId={meId} canSend={canSend}
            readOnlyHint={<>Convidados só leem o chat global. <Link href="/cadastro">Crie uma conta</Link> para conversar.</>}
            onNew={() => { if (!open) setUnread(n => n + 1); }}
          />
        </section>
      )}
      {!open && (
        <button className="ch-fab" onClick={toggle} aria-label="Abrir chat global">
          💬 <span>Chat global</span>{unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}
        </button>
      )}
    </div>
  );
}

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
