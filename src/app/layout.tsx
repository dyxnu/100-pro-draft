import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SiteHeader } from '@/components/SiteHeader';
import { SetupNotice } from '@/components/SetupNotice';
import './globals.css';

// O cabeçalho depende da sessão do usuário: sempre renderizar no servidor a cada pedido.
export const dynamic = 'force-dynamic';

const inter =Inter({ variable: '--font-inter', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'Nexus Draft', template: '%s · Nexus Draft' },
  description: 'Monte o melhor time com R$ 100 fictícios. Leilão de campeões entre amigos.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} font-sans antialiased`}>
        <SetupNotice />
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
