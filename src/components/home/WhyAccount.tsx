const PERKS: { t: string; d: string; icon: string }[] = [
  { t: 'Partidas ranqueadas', d: 'Suba de Ferro a Desafiante com PDL de verdade.', icon: 'M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z M9 12l2 2 4-4' },
  { t: 'Elo e ranking mundial', d: 'Seu nome no topo da lista, visível para todos.', icon: 'M5 20V10 M12 20V4 M19 20v-7' },
  { t: 'Essência azul', d: 'Ganhe a cada partida e gaste do jeito que quiser.', icon: 'M12 3l6 7-6 11-6-11z M6 10h12' },
  { t: 'Loja', d: 'Ícones, bordas, temas e efeitos de vitória.', icon: 'M5 8h14l-1 12H6z M9 8a3 3 0 016 0' },
  { t: 'Skins no leilão', d: 'Leve seus campeões com as skins que você tem.', icon: 'M4 18l6-12 4 7 2-3 4 8z' },
  { t: 'Maestria', d: 'Cada campeão evolui com você, partida a partida.', icon: 'M12 4l2.4 5 5.6.8-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.6-.8z' },
  { t: 'Histórico', d: 'Todos os seus times, lances e campanhas salvos.', icon: 'M12 7v5l3 2 M4 12a8 8 0 108-8 8 8 0 00-6.5 3.3 M4 4v4h4' },
  { t: 'Honra', d: 'Elogie quem joga limpo e seja reconhecido.', icon: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z' },
];

/** Bloco "Por que criar conta?" com os benefícios da conta. */
export function WhyAccount() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {PERKS.map(p => (
        <li key={p.t} className="panel hm-perk flex gap-3 p-4">
          <span className="hm-perk-ico shrink-0">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={p.icon} />
            </svg>
          </span>
          <span>
            <span className="block font-black text-gold2">{p.t}</span>
            <span className="block text-sm text-muted">{p.d}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
