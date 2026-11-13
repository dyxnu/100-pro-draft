# Nexus Draft

Leilão de campeões de League of Legends com R$ 100 fictícios. Projeto em Next.js + TypeScript + Supabase.

## Rodar localmente
```bash
npm install
cp .env.example .env.local   # preencha com os dados do Supabase
npm run dev                  # http://localhost:3000
```

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Testes do motor do leilão (Vitest), incluindo 250 drafts simulados |
| `npm run typecheck` | Checagem de tipos |
| `npm run lint` | ESLint |
| `npm run build` | Build de produção |

## Configurar o Supabase (uma vez)
1. Crie um projeto em https://supabase.com (o plano gratuito serve).
2. **SQL Editor** → cole o conteúdo de `supabase/migrations/0001_foundation.sql` → **Run**.
3. **Project Settings → API**: copie a *Project URL* e a *anon public key* para o `.env.local`.
4. **Authentication → URL Configuration**:
   - *Site URL*: `http://localhost:3000` (depois, o domínio de produção)
   - *Redirect URLs*: adicione `http://localhost:3000/auth/confirm`
5. (Recomendado) **Authentication → Email Templates**: nos templates *Confirm signup* e *Reset password*, troque o link por
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next={{ .RedirectTo }}`.
   O link padrão também funciona, porque a rota `/auth/confirm` aceita os dois formatos.

## Estrutura
```
src/
  app/
    page.tsx                 página inicial
    (auth)/entrar|cadastro|recuperar-senha|redefinir-senha
    auth/actions.ts          server actions de login/cadastro/senha/perfil
    auth/confirm/route.ts    destino dos links de e-mail
    perfil/                  perfil do usuário logado (protegido)
    jogador/[username]/      perfil público
  components/
  lib/
    auction/engine.ts        motor do leilão (puro, serializável, autoritativo)
    auction/bots.ts          bots
    auction/champions.ts     catálogo inicial
    supabase/                clientes e configuração
  middleware.ts              renova sessão e protege /perfil
supabase/migrations/         esquema do banco + RLS + seed dos campeões
public/prototipo/            protótipo jogável contra bots (HTML puro, roda no navegador)
```

## Segurança (decisões da Fase 1)
- O navegador **não tem permissão de escrita** em `rooms`, `room_members`, `auctions`, `bids` e `rosters` (RLS sem policies de escrita). Na Fase 2 essas escritas vão passar por rotas do servidor usando a *service role*.
- Usuário comum só edita o próprio perfil, e um trigger impede que ele altere `is_admin`, `is_banned`, `level`, `xp` e `tag`.
- O estado do leilão (`auctions.state`) é o JSON do `AuctionState`, com a coluna `version` para trava otimista contra condição de corrida.
- A recuperação de senha responde igual exista ou não o e-mail, para não revelar quais contas existem.

## Fases
- [x] **Fase 1: fundação.** Next.js, TypeScript, Supabase, cadastro/login, perfis, esquema inicial, motor do leilão em TS com testes.
- [ ] **Fase 2: salas.** Criar sala, entrar por link/código, lobby de 6 vagas, bots.
- [ ] **Fase 3: leilão em tempo real.** Ações no servidor, Supabase Realtime, reconexão e AFK.
- [ ] Fase 4: resultados, histórico e compartilhamento.
- [ ] Fases 5–7: simulador, ranked, lançamento.

## Pendências conhecidas
- `npm audit` aponta falhas em `postcss` (usado só no build) e `sharp` (otimização de imagens) dentro do Next 15. Vale reavaliar ao migrar para o Next 16.
- O uso de nomes e imagens da Riot exige autorização antes de qualquer uso comercial (veja a seção 17 do documento de visão).
