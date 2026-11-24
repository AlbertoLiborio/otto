import Link from 'next/link';
import { BotaoLink, Marca } from '@/components/ui';

const passosEmpresa = [
  ['Abra a demanda', 'Diga o módulo, o nível e o tipo de contratação: CLT, PJ ou freelance.'],
  ['Receba a shortlist', 'Só profissionais aprovados em prova, caso prático e entrevista técnica.'],
  ['Contrate com segurança', 'Veja notas por competência e o parecer do avaliador antes da primeira conversa.'],
];

const passosProfissional = [
  ['Cadastre-se grátis', 'Monte seu perfil e declare as competências que você domina.'],
  ['Seja avaliado', 'Prova online, caso prático e entrevista com um especialista da sua área.'],
  ['Receba indicações', 'Com o selo Otto, você entra nas shortlists das empresas. Seu contato só é liberado se você aceitar.'],
];

const areas = [
  ['ERP · TOTVS RM', true],
  ['Contabilidade', false],
  ['Saúde', false],
  ['Educação', false],
  ['Engenharia', false],
] as const;

export default function Inicio() {
  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Marca className="text-3xl" />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/entrar" className="rounded-md px-3 py-2 text-tinta-2 hover:bg-black/5">
            Entrar
          </Link>
          <BotaoLink href="/cadastro">Criar conta</BotaoLink>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pt-16">
        <p className="mb-4 inline-flex rounded-full bg-ambar-claro px-3 py-1 text-xs font-bold uppercase tracking-wider text-ambar">
          Indicação com curadoria técnica
        </p>
        <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight sm:text-6xl">
          Profissionais que já passaram pela avaliação técnica.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-tinta-2">
          O Otto avalia consultores e especialistas antes de indicá-los. Sua empresa recebe uma shortlist pronta e
          economiza a etapa mais difícil do processo seletivo.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <BotaoLink href="/cadastro?tipo=empresa" className="px-6 py-3 text-base">
            Quero contratar
          </BotaoLink>
          <BotaoLink href="/cadastro?tipo=profissional" variante="secundario" className="px-6 py-3 text-base">
            Quero ser avaliado
          </BotaoLink>
        </div>
      </section>

      <section className="border-y border-linha bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2">
          {[
            ['Para empresas', passosEmpresa],
            ['Para profissionais', passosProfissional],
          ].map(([titulo, passos]) => (
            <div key={titulo as string}>
              <h2 className="mb-6 font-display text-2xl font-bold">{titulo as string}</h2>
              <ol className="space-y-5">
                {(passos as string[][]).map(([t, d], i) => (
                  <li key={t} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tinta text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold">{t}</p>
                      <p className="text-sm text-tinta-2">{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="mb-2 font-display text-2xl font-bold">Uma plataforma, várias áreas</h2>
        <p className="mb-6 text-tinta-2">Começamos por TOTVS RM. Em breve, outras áreas.</p>
        <div className="flex flex-wrap gap-2">
          {areas.map(([nome, ativa]) => (
            <span
              key={nome}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                ativa ? 'bg-tinta text-white' : 'border border-linha bg-white text-suave'
              }`}
            >
              {nome}
              {!ativa && ' · em breve'}
            </span>
          ))}
        </div>
      </section>

      <footer className="border-t border-linha">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-suave">
          <span>© {new Date().getFullYear()} Otto</span>
          <span className="flex gap-4">
            <Link href="/termos" className="hover:text-tinta">Termos de uso</Link>
            <Link href="/privacidade" className="hover:text-tinta">Privacidade</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
