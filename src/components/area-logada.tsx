import Link from 'next/link';
import type { ReactNode } from 'react';
import { Marca } from './ui';
import type { Perfil } from '@/lib/tipos';

type ItemMenu = { href: string; rotulo: string };

const MENUS: Record<Perfil['papel'], ItemMenu[]> = {
  profissional: [
    { href: '/profissional', rotulo: 'Painel' },
    { href: '/profissional/perfil', rotulo: 'Meu perfil' },
    { href: '/profissional/competencias', rotulo: 'Competências' },
    { href: '/profissional/avaliacao', rotulo: 'Avaliação' },
    { href: '/profissional/convites', rotulo: 'Convites' },
  ],
  empresa: [
    { href: '/empresa', rotulo: 'Demandas' },
    { href: '/empresa/demandas/nova', rotulo: 'Nova demanda' },
    { href: '/empresa/equipe', rotulo: 'Equipe' },
  ],
  avaliador: [{ href: '/avaliador', rotulo: 'Minhas avaliações' }],
  admin: [
    { href: '/admin', rotulo: 'Visão geral' },
    { href: '/admin/demandas', rotulo: 'Curadoria' },
    { href: '/admin/avaliacoes', rotulo: 'Avaliações' },
    { href: '/admin/questoes', rotulo: 'Questões' },
    { href: '/admin/pessoas', rotulo: 'Avaliadores' },
    { href: '/admin/empresas', rotulo: 'Empresas' },
    { href: '/admin/catalogo', rotulo: 'Catálogo' },
    { href: '/admin/configuracoes', rotulo: 'Preços e provas' },
  ],
};

export function AreaLogada({ perfil, children }: { perfil: Perfil; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-linha bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" aria-label="Início">
            <Marca />
          </Link>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto text-sm sm:order-none sm:w-auto">
            {MENUS[perfil.papel].map((m) => (
              <Link key={m.href} href={m.href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-tinta-2 hover:bg-black/5">
                {m.rotulo}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link href="/conta" className="rounded-md px-3 py-1.5 text-tinta-2 hover:bg-black/5" title="Minha conta">
              <span className="hidden md:inline">{perfil.nome.split(' ')[0]} · </span>Minha conta
            </Link>
            <form action="/auth/sair" method="post">
              <button className="rounded-md px-3 py-1.5 text-tinta-2 hover:bg-black/5">Sair</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
