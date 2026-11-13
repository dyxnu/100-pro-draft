import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminConfigured } from '@/lib/supabase/admin';
import { performAction } from '@/lib/rooms/service';
import type { ClientAction } from '@/lib/rooms/types';
import { ROLES, type Role } from '@/lib/auction/engine';

// Único ponto de entrada para ações do leilão. O navegador só envia a intenção;
// o servidor valida tudo (vez, saldo, rota, tempo) com o horário dele.
export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const now = Date.now();
  const { code } = await params;
  if (!isAdminConfigured) return NextResponse.json({ ok: false, reason: 'Servidor sem chave secreta.', serverNow: now }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  if (b.type === 'bid' && Number.isInteger(b.amount) && (b.amount as number) > 0 && (b.amount as number) <= 100_00)
    return { type: 'bid', amount: b.amount as number };
  if (b.type === 'route' && typeof b.role === 'string' && (ROLES as readonly string[]).includes(b.role))
    return { type: 'route', role: b.role as Role };
  return null;
}
