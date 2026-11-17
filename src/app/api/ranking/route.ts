import { NextResponse } from 'next/server';
import { getRanking } from '@/components/home/ranking';

/** Ranking mundial para a atualização ao vivo da página inicial e de /ranking. */
export async function GET(req: Request) {
  const limit = Math.max(1, Math.min(100, Number(new URL(req.url).searchParams.get('limit')) || 10));
  const data = await getRanking(limit);
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
