'use server';

import { revalidatePath } from 'next/cache';
import { buyItem, claimBeta, type ActionResult } from '@/lib/store/service';

/** Compra um item da loja com Essência Azul. */
export async function buyItemAction(itemId: string): Promise<ActionResult> {
  if (typeof itemId !== 'string' || itemId.length > 80) return { ok: false, error: 'Item inválido.' };
  const r = await buyItem(itemId);
  if (r.ok) revalidatePath('/', 'layout'); // cabeçalho mostra o saldo novo
  return r;
}

/** Resgata o bônus de Alpha Tester (uma vez por conta). */
export async function claimBetaAction(): Promise<ActionResult> {
  const r = await claimBeta();
  if (r.ok) revalidatePath('/', 'layout');
  return r;
}
