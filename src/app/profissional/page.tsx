import Link from 'next/link';
import { Cartao, SeloNivel, Titulo } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { dataBR } from '@/lib/regras';
import { resumoProfissional } from './dados';

export const metadata = { title: 'Painel' };

export default async function PainelProfissional() {
  const { supabase, user, perfil } = await exigirPapel('profissional');
  const r = await resumoProfissional(supabase, user.id);
  const ultimaProva = r.tentativas[0];
  const av = r.avaliacao;

  const passos = [
    { feito: Boolean(r.prof?.titulo), titulo: 'Complete seu perfil', href: '/profissional/perfil' },
    { feito: r.nComp > 0, titulo: 'Declare suas competências TOTVS RM', href: '/profissional/competencias' },
    { feito: Boolean(av), titulo: 'Seja aprovado na prova online', href: '/profissional/avaliacao' },
    { feito: Boolean(av?.caso_enviado_em), titulo: 'Envie o caso prático', href: '/profissional/avaliacao' },
    { feito: av?.status === 'concluida', titulo: 'Faça a entrevista técnica', href: '/profissional/avaliacao' },
  ];
  const proximo = passos.find((p) => !p.feito);

  return (
    <>
      <Titulo sub="Acompanhe sua jornada até o selo Otto.">Olá, {perfil.nome.split(' ')[0]}!</Titulo>

      {r.convitesPendentes > 0 && (
        <Link href="/profissional/convites" className="mb-6 block rounded-xl bg-ambar px-5 py-4 font-semibold text-white">
          Você tem {r.convitesPendentes} empresa(s) interessada(s) no seu perfil. Responder agora →
        </Link>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Cartao className="md:col-span-2">
          <h2 className="mb-4 font-semibold">Seu progresso</h2>
          <ol className="space-y-3">
            {passos.map((p, i) => (
              <li key={p.titulo}>
                <Link href={p.href} className="flex items-center gap-3 rounded-lg p-2 hover:bg-black/5">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      p.feito ? 'bg-verde text-white' : p === proximo ? 'bg-ambar text-white' : 'bg-black/10 text-suave'
                    }`}
                  >
                    {p.feito ? '✓' : i + 1}
                  </span>
                  <span className={p.feito ? 'text-suave line-through' : 'font-medium'}>{p.titulo}</span>
                  {p === proximo && <span className="ml-auto text-sm font-semibold text-ambar">Próximo passo →</span>}
                </Link>
              </li>
            ))}
          </ol>
        </Cartao>

        <Cartao>
          <h2 className="mb-4 font-semibold">Selo Otto</h2>
          {r.selo ? (
            <div className="space-y-2">
              <SeloNivel nivel={r.selo.nivel} nota={r.selo.nota_final} />
              <p className="text-sm text-suave">TOTVS RM · válido até {dataBR(r.selo.valido_ate)}</p>
              <p className="text-sm">Você já pode ser indicado para empresas.</p>
            </div>
          ) : (
            <p className="text-sm text-suave">
              {ultimaProva?.status === 'finalizada' && !av
                ? `Última prova: nota ${Number(ultimaProva.nota).toFixed(0)}. Você poderá tentar novamente em breve.`
                : 'Conclua as etapas da avaliação para receber seu selo.'}
            </p>
          )}
        </Cartao>
      </div>
    </>
  );
}
