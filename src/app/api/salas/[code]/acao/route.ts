import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminConfigured } from '@/lib/supabase/admin';
import { performAction } from '@/lib/rooms/service';
import type { ClientAction } from '@/lib/rooms/types';
import { ROLES, type Role } from '@/lib/auction/engine';
import { isStrategy } from '@/lib/match/model';

// Único ponto de entrada para ações do leilão. O navegador só envia a intenção;
// o servidor valida tudo (vez, saldo, rota, tempo) com o horário dele.
export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const now = Date.now();
  const { code } = await params;
  if (!isAdminConfigured) return NextResponse.json({ ok: false, reason: 'Servidor sem chave secreta.', serverNow: now }, { status: 503 });

  const supabase = await createClient();
  // getClaims valida o token sem ir ao servidor de login quando possível (menos atraso por lance).
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims?.sub ? { id: claims.claims.sub } : null;
  if (!user) return NextResponse.json({ ok: false, reason: 'Faça login.', serverNow: now }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  const action = parseAction(body);
  if (!action) return NextResponse.json({ ok: false, reason: 'Ação inválida.', serverNow: now }, { status: 400 });

  const res = await performAction(code, user.id, action, now);
  return NextResponse.json(res, { status: res.ok || res.state ? 200 : 400 });
}

function parseAction(body: unknown): ClientAction | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.type === 'tick') return { type: 'tick' };
  if (b.type === 'pass') return { type: 'pass' };
  if (b.type === 'bid' && Number.isInteger(b.amount) && (b.amount as number) > 0 && (b.amount as number) <= 100_00)
    return { type: 'bid', amount: b.amount as number };
  const isRole = (v: unknown): v is Role => typeof v === 'string' && (ROLES as readonly string[]).includes(v);
  if (b.type === 'route' && isRole(b.role)) return { type: 'route', role: b.role };
  if (b.type === 'lineup_swap' && isRole(b.a) && isRole(b.b) && b.a !== b.b) return { type: 'lineup_swap', a: b.a, b: b.b };
  if (b.type === 'ready' && typeof b.ready === 'boolean') return { type: 'ready', ready: b.ready };
  if (b.type === 'strategy' && isStrategy(b.strategy)) return { type: 'strategy', strategy: b.strategy };
  return null;
}
