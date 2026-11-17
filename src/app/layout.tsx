import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import { SiteHeader } from '@/components/SiteHeader';
import { SetupNotice } from '@/components/SetupNotice';
import { ErrorReporter } from '@/components/debug/ErrorReporter';
import './globals.css';

// O cabeçalho depende da sessão do usuário: sempre renderizar no servidor a cada pedido.
export const dynamic = 'force-dynamic';

const nunito = Nunito({ variable: '--font-nunito', subsets: ['latin'], weight: ['400', '600', '700', '800', '900'] });

const DIAG = `(function(){if(location.pathname.indexOf('/sala/')!==0)return;var errs=[];window.addEventListener('error',function(e){errs.push(String(e.message||e.type)+' @'+(e.filename||(e.target&&(e.target.src||e.target.href))||''))},true);setTimeout(function(){try{var m=document.querySelector('main');var r=m?m.getBoundingClientRect():null;var info={where:'diag '+location.pathname,message:JSON.stringify({kids:m?m.children.length:-1,h:r?Math.round(r.height):-1,first:m&&m.firstElementChild?(m.firstElementChild.tagName+'.'+m.firstElementChild.className+' hidden='+m.firstElementChild.hidden):'',hiddenDivs:document.querySelectorAll('div[hidden]').length,templates:document.querySelectorAll('template').length,loads:(function(){try{var n=+(sessionStorage.getItem('nxLoads')||0)+1;sessionStorage.setItem('nxLoads',String(n));return n}catch(x){return -1}})(),nav:(performance.getEntriesByType('navigation')[0]||{}).type,html:m?m.innerHTML.slice(0,1800):'',nextReady:!!(window.next&&window.next.router),errs:errs.slice(0,8)}),ua:navigator.userAgent};navigator.sendBeacon('/api/erro-cliente',new Blob([JSON.stringify(info)],{type:'application/json'}))}catch(x){}},6000)})();`;

export const metadata: Metadata = {
  title: { default: '100 pro Draft', template: '%s · 100 pro Draft' },
  description: 'Leilão de campeões de League of Legends: R$ 100 fictícios, cinco rotas e um campeonato no Summoner’s Rift.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${nunito.variable} font-sans antialiased`}>
        <ErrorReporter />
        {/* Diagnóstico temporário (tela branca da sala): roda mesmo se o React não carregar. */}
        <script dangerouslySetInnerHTML={{ __html: DIAG }} />
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
