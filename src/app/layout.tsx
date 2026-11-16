import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import { SiteHeader } from '@/components/SiteHeader';
import { SetupNotice } from '@/components/SetupNotice';
import './globals.css';

// O cabeçalho depende da sessão do usuário: sempre renderizar no servidor a cada pedido.
export const dynamic = 'force-dynamic';

const nunito = Nunito({ variable: '--font-nunito', subsets: ['latin'], weight: ['400', '600', '700', '800', '900'] });

export const metadata: Metadata = {
  title: { default: '100 pro Draft', template: '%s · 100 pro Draft' },
  description: 'Leilão de campeões de League of Legends: R$ 100 fictícios, cinco rotas e um campeonato no Summoner’s Rift.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${nunito.variable} font-sans antialiased`}>
        <SetupNotice />
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-muted sm:px-6">
          100 pro Draft é um projeto de fãs, sem afiliação com a Riot Games. League of Legends, campeões e o mapa são marcas da Riot Games, Inc.
        </footer>
      </body>
    </html>
  );
}
