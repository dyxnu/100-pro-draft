import type { Metadata } from 'next';
import ddragon from '@/lib/champions/ddragon.json';
import { SKINS, profileIconUrl } from '@/lib/store/catalog';
import { canClaimBeta } from '@/lib/store/rules';
import { loadStoreSession } from '@/lib/store/service';
import { avatarUrl } from '@/lib/profile/avatars';
import { StoreView } from './StoreView';
import './store.css';

export const metadata: Metadata = { title: 'Loja', description: 'Skins, ícones, bordas, temas e títulos com Essência Azul.' };

const NAMES = (ddragon as unknown as { champions: Record<string, { name: string }> }).champions;

export default async function StorePage() {
  const s = await loadStoreSession();
  const p = s.profile;
  const champNames = Object.fromEntries(Object.keys(SKINS).map(id => [id, NAMES[id]?.name ?? id]));
  const av = p?.avatar_url;
  const avatar = av?.startsWith('icon:') ? profileIconUrl(Number(av.slice(5))) : avatarUrl(av);

  return (
    <div className="pt-6">
      <StoreView
        loggedIn={!!s.userId}
        isGuest={!!p?.is_guest}
        ready={s.ready}
        vip={s.vip}
        balance={s.ready ? p?.blue_essence ?? 0 : 0}
        owned={[...s.owned]}
        betaClaimable={s.ready && canClaimBeta(p)}
        nameTokens={p?.name_change_tokens ?? 0}
        champNames={champNames}
        avatar={avatar}
      />
    </div>
  );
}
