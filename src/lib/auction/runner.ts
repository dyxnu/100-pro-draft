// Relógio do servidor. Em ambiente serverless não há um processo rodando o tempo todo:
// a cada pedido (lance, escolha de rota ou "cutucada" de algum cliente), o servidor
// reproduz em ordem TODOS os eventos com prazo vencido (fim de lote, bots, escolha
// automática de rota) usando o horário em que eles deveriam ter acontecido.
// Resultado: o estado é sempre o mesmo, não importa quando o servidor foi chamado.
import { type AuctionState, nextDeadline, tick } from './engine';
import { type BotBrains, nextBotAction, stepBots } from './bots';

export function nextWake(s: AuctionState, brains: BotBrains): number | null {
  if (s.phase === 'finished') return null;
  const c = [nextDeadline(s), nextBotAction(s, brains)].filter((t): t is number => t != null);
  return c.length ? Math.min(...c) : null;
}

/** Avança o jogo até `now`, processando cada prazo vencido no seu instante exato. */
export function advance(s: AuctionState, brains: BotBrains, now: number): void {
  for (let i = 0; i < 20_000; i++) {
    const t = nextWake(s, brains);
    if (t == null || t > now) break;
    stepBots(s, brains, t);
    tick(s, t);
    stepBots(s, brains, t); // bots reagem ao que acabou de mudar
  }
  stepBots(s, brains, now);
}
