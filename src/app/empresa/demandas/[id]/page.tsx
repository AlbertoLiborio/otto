import { notFound } from 'next/navigation';
import { Aviso, Botao, Campo, Cartao, Etiqueta, SeloNivel, Titulo, Vazio, lerAviso } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { reais } from '@/lib/regras';
import {
  ROTULO_MODALIDADE, ROTULO_NIVEL, ROTULO_STATUS_DEMANDA, ROTULO_STATUS_INDICACAO, ROTULO_VINCULO,
  type Modalidade, type Nivel, type Vinculo,
} from '@/lib/tipos';
import { cancelarDemanda, registrarResultado, solicitarContato } from '../../acoes';

export const metadata = { title: 'Demanda' };

type ItemShortlist = {
  indicacao_id: string; status: string; titulo: string | null; resumo: string | null; uf: string | null;
  aceita_remoto: boolean; vinculos_aceitos: Vinculo[]; nivel: Nivel | null; nota_final: number | null;
  parecer: string | null; observacao_curador: string | null;
  competencias: { competencia: string; nivel: Nivel; nota: number }[];
  nome: string | null; email: string | null; telefone: string | null; linkedin_url: string | null;
};

export default async function Demanda({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { erro, ok } = await lerAviso(searchParams);
  const { supabase } = await exigirPapel('empresa');

  // RLS: só retorna se a demanda for da empresa do usuário
  const { data: d } = await supabase.from('demandas').select('*, demanda_competencias(obrigatoria, competencias(nome))').eq('id', id).maybeSingle();
  if (!d) notFound();
  const { data: shortlist } = await supabase.rpc('shortlist_anonima', { p_demanda: id });
  const itens = (shortlist ?? []) as ItemShortlist[];
  const comps = d.demanda_competencias as unknown as { obrigatoria: boolean; competencias: { nome: string } }[];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Titulo
          sub={`${ROTULO_VINCULO[d.vinculo as Vinculo]} · ${ROTULO_MODALIDADE[d.modalidade as Modalidade]} · nível mínimo ${ROTULO_NIVEL[d.nivel_minimo as Nivel]}`}
        >
          {d.titulo}
        </Titulo>
        <Etiqueta cor={d.status === 'shortlist_enviada' ? 'verde' : 'ambar'}>{ROTULO_STATUS_DEMANDA[d.status]}</Etiqueta>
      </div>
      <Aviso erro={erro} ok={ok} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold">Shortlist</h2>
          {itens.length === 0 && (
            <Vazio>
              {d.status === 'cancelada'
                ? 'Demanda cancelada.'
                : 'Nossa curadoria está selecionando profissionais avaliados. Você será avisado quando a shortlist estiver pronta.'}
            </Vazio>
          )}
          {itens.map((p, i) => (
            <Cartao key={p.indicacao_id}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-suave">{p.nome ?? `Candidato ${i + 1}`}</p>
                  <h3 className="text-lg font-semibold">{p.titulo}</h3>
                  <p className="text-sm text-suave">
                    {p.uf ?? '—'} · {p.aceita_remoto ? 'aceita remoto' : 'presencial'} · {p.vinculos_aceitos.map((v) => ROTULO_VINCULO[v]).join(', ')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {p.nivel && <SeloNivel nivel={p.nivel} nota={p.nota_final} />}
                  <Etiqueta>{ROTULO_STATUS_INDICACAO[p.status]}</Etiqueta>
                </div>
              </div>

              {p.competencias.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {p.competencias.map((c) => (
                    <span key={c.competencia} className="rounded-md bg-black/5 px-2 py-1 text-xs">
                      {c.competencia} · <strong>{ROTULO_NIVEL[c.nivel]}</strong> {Number(c.nota).toFixed(0)}
                    </span>
                  ))}
                </div>
              )}
              {p.parecer && <p className="mb-2 text-sm"><strong>Parecer do avaliador:</strong> {p.parecer}</p>}
              {p.observacao_curador && <p className="mb-2 text-sm"><strong>Nota da curadoria:</strong> {p.observacao_curador}</p>}
              {p.resumo && <p className="text-sm text-tinta-2">{p.resumo}</p>}

              {p.nome && (
                <div className="mt-4 rounded-lg bg-verde-claro p-4 text-sm">
                  <p className="font-semibold text-verde">Contato liberado</p>
                  <p>{p.nome} · {p.email} {p.telefone && `· ${p.telefone}`}</p>
                  {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" className="underline">LinkedIn</a>}
                </div>
              )}

              {p.status === 'enviado_empresa' && (
                <form action={solicitarContato} className="mt-4">
                  <input type="hidden" name="indicacao_id" value={p.indicacao_id} />
                  <Botao>Tenho interesse: solicitar contato</Botao>
                </form>
              )}

              {p.status === 'aceito_profissional' && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-tinta-2">Registrar resultado do processo</summary>
                  <form action={registrarResultado} className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="indicacao_id" value={p.indicacao_id} />
                    <Campo rotulo="Resultado">
                      <select name="resultado" className="campo">
                        <option value="contratado">Contratado</option>
                        <option value="nao_selecionado">Não selecionado</option>
                      </select>
                    </Campo>
                    <Campo rotulo="Salário / valor do contrato (R$)" dica="Obrigatório se contratado">
                      <input name="valor" inputMode="decimal" className="campo" />
                    </Campo>
                    <Campo rotulo="Avalie a indicação (1 a 5)">
                      <select name="feedback_nota" className="campo" defaultValue="5">
                        {[5, 4, 3, 2, 1].map((n) => <option key={n}>{n}</option>)}
                      </select>
                    </Campo>
                    <Campo rotulo="Comentário">
                      <input name="feedback_comentario" className="campo" />
                    </Campo>
                    <div className="sm:col-span-2"><Botao>Salvar resultado</Botao></div>
                  </form>
                </details>
              )}
            </Cartao>
          ))}
        </div>

        <aside className="space-y-4">
          <Cartao>
            <h2 className="mb-3 font-semibold">Detalhes</h2>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-suave">Local</dt><dd>{d.cidade ? `${d.cidade}/${d.uf}` : d.uf ?? '—'}</dd></div>
              <div><dt className="text-suave">Faixa</dt><dd>{reais(d.valor_min_centavos)} a {reais(d.valor_max_centavos)}</dd></div>
              <div><dt className="text-suave">Cobrança</dt><dd>{{ creditos: 'Créditos', assinatura: 'Assinatura', success_fee: 'Success fee' }[d.modelo_cobranca as string]}</dd></div>
              <div>
                <dt className="text-suave">Competências</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {comps.map((c) => (
                    <span key={c.competencias.nome} className="rounded bg-black/5 px-2 py-0.5 text-xs">
                      {c.competencias.nome}{c.obrigatoria ? '' : ' (desejável)'}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
            {d.descricao && <p className="mt-3 whitespace-pre-line border-t border-linha pt-3 text-sm text-tinta-2">{d.descricao}</p>}
          </Cartao>
          {d.status === 'aberta' && (
            <form action={cancelarDemanda}>
              <input type="hidden" name="demanda_id" value={d.id} />
              <Botao variante="fantasma" className="w-full text-vermelho">Cancelar demanda</Botao>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
