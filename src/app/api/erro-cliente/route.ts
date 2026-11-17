import { NextResponse } from 'next/server';

// Recebe erros da tela do jogador e escreve no log do servidor (Vercel → Logs).
export async function POST(req: Request) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const pick = (k: string, n: number) => String(body[k] ?? '').slice(0, n);
    console.error('[erro-cliente]', JSON.stringify({ where: pick('where', 200), message: pick('message', 500), digest: pick('digest', 100), ua: pick('ua', 200), stack: pick('stack', 2000) }));
  } catch { /* ignora corpo inválido */ }
  return NextResponse.json({ ok: true });
}
