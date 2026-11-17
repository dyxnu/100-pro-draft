'use client';

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { authRealtime, getBrowserClient } from '@/lib/supabase/client';
import { itemById } from '@/lib/store/catalog';
import { sendChatAction } from '@/app/social/actions';
import { CHAT_HISTORY, CHAT_MAX, MISSING_SOCIAL, type ChatMessage, isMissingSchema } from './shared';
import './chat.css';

type Channel = ReturnType<ReturnType<typeof getBrowserClient>['channel']>;
const COLS = 'id, channel, user_id, username, title_id, is_vip, body, created_at';

/**
 * Caixa de chat de um canal ('global' ou 'sala:<id>'): carrega as últimas 50, recebe as novas
 * pelo Realtime e envia pela ação do servidor. `onNew` avisa mensagens de outras pessoas (contador).
 */
export function ChatBox({ channel, meId, canSend, readOnlyHint, placeholder = 'Escreva uma mensagem…', onNew, className = '' }: {
  channel: string;
  meId: string | null;
  canSend: boolean;
  readOnlyHint?: React.ReactNode;
  placeholder?: string;
  onNew?: (m: ChatMessage) => void;
  className?: string;
}) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const onNewRef = useRef(onNew);
  useEffect(() => { onNewRef.current = onNew; }, [onNew]);

  useEffect(() => {
    const sb = getBrowserClient();
    let cancelled = false;
    let ch: Channel | null = null;
    const add = (m: ChatMessage) => setMsgs(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, m].slice(-CHAT_HISTORY * 2)));
    void (async () => {
      await authRealtime();
      const { data, error: e } = await sb.from('chat_messages').select(COLS)
        .eq('channel', channel).order('created_at', { ascending: false }).limit(CHAT_HISTORY);
      if (cancelled) return;
      if (e) { setStatus(isMissingSchema(e) ? 'missing' : 'error'); return; }
      setMsgs(((data ?? []) as ChatMessage[]).reverse());
      setStatus('ok');
      // Tópico próprio (o saguão já usa "sala:<id>" para presença).
      ch = sb.channel(`chat-${channel}-${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel=eq.${channel}` },
          (p: { new: ChatMessage }) => {
            if (!p.new?.id) return;
            add(p.new);
            if (p.new.user_id !== meId) onNewRef.current?.(p.new);
          })
        .subscribe();
    })();
    return () => { cancelled = true; if (ch) void sb.removeChannel(ch); };
  }, [channel, meId]);

  // Rolagem automática quando a pessoa já está no fim da conversa.
  useLayoutEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);
  const onScroll = () => {
    const el = list.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const send = () => {
    const body = text.trim();
    if (!body || pending) return;
    start(async () => {
      setError(undefined);
      const r = await sendChatAction(channel, body);
      if (!r.ok) { setError(r.error); return; }
      setText('');
      stick.current = true;
      setMsgs(prev => (prev.some(x => x.id === r.message.id) ? prev : [...prev, r.message]));
    });
  };

  if (status === 'missing') return <div className={`ch-box ${className}`}><p className="ch-empty">{MISSING_SOCIAL}</p></div>;

  return (
    <div className={`ch-box ${className}`}>
      <div className="ch-list" ref={list} onScroll={onScroll} aria-live="polite">
        {status === 'loading' && <p className="ch-empty">Carregando…</p>}
        {status === 'error' && <p className="ch-empty">Não foi possível carregar o chat agora.</p>}
        {status === 'ok' && !msgs.length && <p className="ch-empty">Ninguém falou ainda. Diga oi! 👋</p>}
        {msgs.map(m => <Line key={m.id} m={m} mine={m.user_id === meId} />)}
      </div>
      {canSend ? (
        <form className="ch-form" onSubmit={e => { e.preventDefault(); send(); }}>
          <input
            value={text} maxLength={CHAT_MAX} placeholder={placeholder} aria-label="Mensagem"
            disabled={status !== 'ok'}
            onChange={e => { setText(e.target.value); if (error) setError(undefined); }}
          />
          <button type="submit" disabled={pending || !text.trim() || status !== 'ok'} aria-label="Enviar">➤</button>
        </form>
      ) : (
        <p className="ch-readonly">{readOnlyHint ?? 'Você só pode ler este chat.'}</p>
      )}
      {error && <p className="ch-error" role="alert">{error}</p>}
    </div>
  );
}

function Line({ m, mine }: { m: ChatMessage; mine: boolean }) {
  const title = m.title_id ? itemById(m.title_id)?.name : null;
  const time = new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return (
    <p className={`ch-line ${mine ? 'mine' : ''}`}>
      <span className="ch-meta">
        <b className={m.is_vip ? 'ch-vip' : ''}>{m.is_vip && '★ '}{m.username}</b>
        {title && <span className="ch-title">{title}</span>}
        <time>{time}</time>
      </span>
      <span className="ch-body">{m.body}</span>
    </p>
  );
}
