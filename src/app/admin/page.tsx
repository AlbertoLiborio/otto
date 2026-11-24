import Link from 'next/link';
import { Cartao, Titulo, Vazio } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { ROTULO_NIVEL, type Nivel } from '@/lib/tipos';

export const metadata = { title: 'Visão geral' };

export default async function PainelAdmin() {
  const { supabase } = await exigirPapel('admin');
  const conta = (tabela: string, filtro?: (q: any) => any) => {
    let q = supabase.from(tabela).select('*', { count: 'exact', head: true });
    if (filtro) q = filtro(q);
    return q.then((r: { count: number | null }) => r.count ?? 0);
  };

  const [profissionais, aprovados, semAvaliador, demandasAbertas, contratacoes, questoes, { data: lacunas }] = await Promise.all([
    conta('profissionais'),
    conta('profissionais', (q) => q.eq('status', 'aprovado')),
    conta('avaliacoes', (q) => q.eq('status', 'aguardando_avaliador').is('avaliador_id', null)),
    conta('demandas', (q) => q.in('status', ['aberta', 'em_curadoria'])),
    conta('indicacoes', (q) => q.eq('status', 'contratado')),
    conta('questoes', (q) => q.eq('ativa', true)),
    supabase.from('vw_lacunas_competencia').select('*').gte('respostas', 5).order('pct_erro', { ascending: false }).limit(8),
  ]);

  const kpis: [string, number, string][] = [
    ['Profissionais cadastrados', profissionais, '/admin/avaliacoes'],
    ['Com selo Otto', aprovados, '/admin/avaliacoes?filtro=concluida'],
    ['Aguardando avaliador', semAvaliador, '/admin/avaliacoes'],
    ['Demandas para curar', demandasAbertas, '/admin/demandas'],
    ['Contratações', contratacoes, '/admin/demandas'],
    ['Questões ativas', questoes, '/admin/questoes'],
  ];

  return (
    <>
      <Titulo sub="O que precisa da sua atenção hoje.">Visão geral</Titulo>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-6">
        {kpis.map(([rotulo, valor, href]) => (
          <Link key={rotulo} href={href} className="rounded-2xl border border-linha bg-white p-4 hover:border-tinta-2">
            <p className="font-display text-3xl font-bold">{valor}</p>
            <p className="text-xs text-suave">{rotulo}</p>
          </Link>
        ))}
      </div>

      <Cartao>
        <h2 className="mb-1 font-semibold">Lacunas de conhecimento (base para cursos)</h2>
        <p className="mb-4 text-sm text-suave">Competências com maior percentual de erro na prova online (mínimo de 5 respostas).</p>
        {!lacunas?.length ? (
          <Vazio>Os dados aparecem conforme os profissionais fizerem a prova.</Vazio>
        ) : (
          <ul className="space-y-3">
            {lacunas.map((l) => (
              <li key={`${l.competencia_id}-${l.nivel}`}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>
                    {l.competencia} <span className="text-suave">· {ROTULO_NIVEL[l.nivel as Nivel]}</span>
                  </span>
                  <span className="font-semibold">{Number(l.pct_erro).toFixed(0)}% de erro · {l.profissionais} pessoas</span>
                </div>
                <div className="h-2 rounded-full bg-black/5">
                  <div className="h-2 rounded-full bg-ambar" style={{ width: `${Math.min(100, Number(l.pct_erro))}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </>
  );
}
