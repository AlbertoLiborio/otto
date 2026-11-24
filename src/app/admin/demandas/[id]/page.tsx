import { notFound } from 'next/navigation';
import { Aviso, Botao, Cartao, Etiqueta, SeloNivel, Titulo, Vazio, lerAviso } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { nivelAtende, reais } from '@/lib/regras';
import {
  ROTULO_MODALIDADE, ROTULO_NIVEL, ROTULO_STATUS_DEMANDA, ROTULO_STATUS_INDICACAO, ROTULO_VINCULO,
  type Modalidade, type Nivel, type Vinculo,
} from '@/lib/tipos';
import { adicionarCandidato, encerrarDemanda, enviarShortlist, removerCandidato } from '../../acoes';

export const metadata = { title: 'Curadoria da demanda' };

type CompProf = { competencia_id: number; nivel_validado: Nivel | null; nota_validada: number | null; competencias: { nome: string } };

export default async function CuradoriaDemanda({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { erro, ok } = await lerAviso(searchParams);
  const { supabase } = await exigirPapel('admin');

  const { data: d } = await supabase
    .from('demandas')
    .select('*, empresas(razao_social, nome_fantasia), demanda_competencias(competencia_id, nivel_minimo, obrigatoria, competencias(nome))')
    .eq('id', id)
    .maybeSingle();
  if (!d) notFound();

  const exigidas = d.demanda_competencias as unknown as { competencia_id: number; nivel_minimo: Nivel; obrigatoria: boolean; competencias: { nome: string } }[];
  const { data: indicacoes } = await supabase
    .from('indicacoes')
    .select('id, status, observacao_curador, feedback_nota, profissional_id, profissionais(titulo, perfis(nome))')
    .eq('demanda_id', id)
    .order('created_at');
  const jaIndicados = new Set((indicacoes ?? []).map((i) => i.profissional_id));

  // Candidatos: selo válido na especialidade da demanda
  const { data: selos } = await supabase
    .from('selos')
    .select('profissional_id, nivel, nota_final, profissionais!inner(id, titulo, uf, aceita_remoto, vinculos_aceitos, status, perfis(nome), competencias_profissional(competencia_id, nivel_validado, nota_validada, competencias(nome)))')
    .eq('especialidade_id', d.especialidade_id)
    .gt('valido_ate', new Date().toISOString())
    .order('nota_final', { ascending: false });

  const vistos = new Set<string>();
  const candidatos = (selos ?? [])
    .filter((s) => !vistos.has(s.profissional_id) && vistos.add(s.profissional_id))
    .map((s) => {
      const p = s.profissionais as unknown as {
        id: string; titulo: string; uf: string | null; aceita_remoto: boolean; vinculos_aceitos: Vinculo[]; status: string;
        perfis: { nome: string }; competencias_profissional: CompProf[];
      };
      const mapa = new Map(p.competencias_profissional.map((c) => [c.competencia_id, c]));
      const obrig = exigidas.filter((e) => e.obrigatoria);
      const atende = obrig.filter((e) => nivelAtende(mapa.get(e.competencia_id)?.nivel_validado, e.nivel_minimo)).length;
      const aderencia = obrig.length ? Math.round((atende / obrig.length) * 100) : 100;
      const vinculoOk = p.vinculos_aceitos.includes(d.vinculo as Vinculo);
      const localOk = d.modalidade === 'remoto' ? p.aceita_remoto : !d.uf || p.uf === d.uf;
      return { s, p, mapa, aderencia, vinculoOk, localOk, nivelOk: nivelAtende(s.nivel as Nivel, d.nivel_minimo as Nivel) };
    })
    .filter((c) => c.p.status === 'aprovado' && !jaIndicados.has(c.p.id))
    .sort((a, b) => Number(b.vinculoOk && b.nivelOk) - Number(a.vinculoOk && a.nivelOk) || b.aderencia - a.aderencia || Number(b.s.nota_final) - Number(a.s.nota_final));

  const empresa = d.empresas as unknown as { razao_social: string; nome_fantasia: string | null };
  const sugeridos = (indicacoes ?? []).filter((i) => i.status === 'sugerido').length;
  const fechada = ['cancelada', 'encerrada'].includes(d.status);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Titulo sub={`${empresa.nome_fantasia || empresa.razao_social} · ${ROTULO_VINCULO[d.vinculo as Vinculo]} · ${ROTULO_MODALIDADE[d.modalidade as Modalidade]} · mínimo ${ROTULO_NIVEL[d.nivel_minimo as Nivel]} · ${reais(d.valor_min_centavos)}–${reais(d.valor_max_centavos)}`}>
          {d.titulo}
        </Titulo>
        <Etiqueta cor="ambar">{ROTULO_STATUS_DEMANDA[d.status]}</Etiqueta>
      </div>
      <Aviso erro={erro} ok={ok} />

      <div className="mb-6 flex flex-wrap gap-2">
        {exigidas.map((e) => (
          <span key={e.competencia_id} className="rounded-md bg-black/5 px-2 py-1 text-xs">
            {e.competencias.nome} ≥ {ROTULO_NIVEL[e.nivel_minimo]}{e.obrigatoria ? '' : ' (desejável)'}
          </span>
        ))}
      </div>
      {d.descricao && <p className="mb-6 whitespace-pre-line text-sm text-tinta-2">{d.descricao}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-xl font-bold">Shortlist</h2>
          {!indicacoes?.length && <Vazio>Adicione candidatos da lista ao lado.</Vazio>}
          <div className="space-y-3">
            {(indicacoes ?? []).map((i) => {
              const p = i.profissionais as unknown as { titulo: string; perfis: { nome: string } };
              return (
                <Cartao key={i.id} className="p-4 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{p.perfis.nome}</p>
                      <p className="text-sm text-suave">{p.titulo}</p>
                      {i.observacao_curador && <p className="mt-1 text-xs italic">“{i.observacao_curador}”</p>}
                      {i.feedback_nota && <p className="mt-1 text-xs">Feedback da empresa: {'★'.repeat(i.feedback_nota)}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Etiqueta cor={i.status === 'contratado' ? 'verde' : 'neutra'}>{ROTULO_STATUS_INDICACAO[i.status]}</Etiqueta>
                      {i.status === 'sugerido' && (
                        <form action={removerCandidato}>
                          <input type="hidden" name="indicacao_id" value={i.id} />
                          <input type="hidden" name="demanda_id" value={id} />
                          <button className="text-xs text-vermelho underline">remover</button>
                        </form>
                      )}
                    </div>
                  </div>
                </Cartao>
              );
            })}
          </div>
          {!fechada && (
            <div className="mt-4 flex flex-wrap gap-2">
              <form action={enviarShortlist}>
                <input type="hidden" name="demanda_id" value={id} />
                <Botao disabled={!sugeridos}>Enviar {sugeridos || ''} para a empresa</Botao>
              </form>
              <form action={encerrarDemanda}>
                <input type="hidden" name="demanda_id" value={id} />
                <Botao variante="fantasma">Encerrar demanda</Botao>
              </form>
            </div>
          )}
          <p className="mt-2 text-xs text-suave">
            Cobrança: {{ creditos: 'consome créditos no primeiro envio', assinatura: 'exige assinatura ativa', success_fee: 'cobrado na contratação' }[d.modelo_cobranca as string]}.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl font-bold">Candidatos com selo ({candidatos.length})</h2>
          {!candidatos.length && <Vazio>Nenhum profissional com selo válido disponível.</Vazio>}
          <div className="space-y-3">
            {candidatos.map((c) => (
              <Cartao key={c.p.id} className="p-4 sm:p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{c.p.perfis.nome}</p>
                    <p className="text-sm text-suave">{c.p.titulo} · {c.p.uf ?? '—'}</p>
                  </div>
                  <SeloNivel nivel={c.s.nivel as Nivel} nota={c.s.nota_final} />
                </div>
                <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
                  <Etiqueta cor={c.aderencia === 100 ? 'verde' : c.aderencia >= 50 ? 'ambar' : 'vermelha'}>{c.aderencia}% das obrigatórias</Etiqueta>
                  {!c.vinculoOk && <Etiqueta cor="vermelha">não aceita {ROTULO_VINCULO[d.vinculo as Vinculo]}</Etiqueta>}
                  {!c.nivelOk && <Etiqueta cor="vermelha">abaixo do nível</Etiqueta>}
                  {!c.localOk && <Etiqueta cor="ambar">local/remoto</Etiqueta>}
                  {exigidas.map((e) => {
                    const m = c.mapa.get(e.competencia_id);
                    return m?.nivel_validado ? (
                      <span key={e.competencia_id} className="rounded bg-black/5 px-1.5 py-0.5">
                        {e.competencias.nome.split(' (')[0]}: {ROTULO_NIVEL[m.nivel_validado]}
                      </span>
                    ) : null;
                  })}
                </div>
                {!fechada && (
                  <form action={adicionarCandidato} className="flex gap-2">
                    <input type="hidden" name="demanda_id" value={id} />
                    <input type="hidden" name="profissional_id" value={c.p.id} />
                    <input name="observacao" placeholder="Nota para a empresa (opcional)" className="campo" />
                    <Botao variante="secundario">Adicionar</Botao>
                  </form>
                )}
              </Cartao>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
