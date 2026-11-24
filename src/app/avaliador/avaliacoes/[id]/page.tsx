import { notFound } from 'next/navigation';
import { Aviso, Botao, Campo, Cartao, Etiqueta, SeloNivel, Titulo, lerAviso } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { PESOS, reais } from '@/lib/regras';
import { ROTULO_NIVEL, ROTULO_STATUS_AVALIACAO, ROTULO_VINCULO, type Nivel, type Vinculo } from '@/lib/tipos';
import { agendarEntrevista, concluirAvaliacao } from '../../acoes';

export const metadata = { title: 'Avaliação' };

function paraDatetimeLocal(iso: string | null) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000); // Brasília
  return d.toISOString().slice(0, 16);
}

export default async function DetalheAvaliacao({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { erro, ok } = await lerAviso(searchParams);
  const { user, perfil } = await exigirPapel('avaliador', 'admin');
  const admin = criarClienteAdmin();

  const { data: av } = await admin.from('avaliacoes').select('*').eq('id', id).maybeSingle();
  if (!av || (av.avaliador_id !== user.id && perfil.papel !== 'admin')) notFound();

  const [{ data: prof }, { data: comps }] = await Promise.all([
    admin.from('profissionais').select('*, perfis(nome, email, telefone)').eq('id', av.profissional_id).single(),
    admin.from('competencias_profissional').select('*, competencias(nome)').eq('profissional_id', av.profissional_id).order('competencia_id'),
  ]);
  const pessoa = prof?.perfis as unknown as { nome: string; email: string; telefone: string | null };
  const docs = admin.storage.from('documentos');
  const curriculo = prof?.curriculo_path ? (await docs.createSignedUrl(`curriculos/${av.profissional_id}.pdf`, 600)).data?.signedUrl : null;
  const anexo = av.caso_pratico_path ? (await docs.createSignedUrl(av.caso_pratico_path, 600)).data?.signedUrl : null;
  const editavel = ['aguardando_avaliador', 'agendada'].includes(av.status);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Titulo sub={prof?.titulo}>{pessoa?.nome}</Titulo>
        <Etiqueta cor={av.status === 'concluida' ? 'verde' : 'ambar'}>{ROTULO_STATUS_AVALIACAO[av.status]}</Etiqueta>
      </div>
      <Aviso erro={erro} ok={ok} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Cartao>
            <h2 className="mb-3 font-semibold">Caso prático</h2>
            <details className="mb-3 text-sm">
              <summary className="cursor-pointer text-suave">Ver enunciado</summary>
              <p className="mt-2 whitespace-pre-line rounded-lg bg-papel p-3">{av.caso_pratico_enunciado}</p>
            </details>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-tinta p-4 text-xs text-white">{av.caso_pratico_resposta ?? 'Ainda não enviado.'}</pre>
            {anexo && <a href={anexo} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold underline">Baixar anexo</a>}
          </Cartao>

          {editavel && (
            <Cartao>
              <h2 className="mb-3 font-semibold">Agendar entrevista</h2>
              <form action={agendarEntrevista} className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
                <input type="hidden" name="avaliacao_id" value={av.id} />
                <Campo rotulo="Data e hora (Brasília)">
                  <input type="datetime-local" name="agendada_para" required defaultValue={paraDatetimeLocal(av.agendada_para)} className="campo" />
                </Campo>
                <Campo rotulo="Link da reunião (Meet, Teams, Zoom)">
                  <input name="link_reuniao" type="url" defaultValue={av.link_reuniao ?? ''} className="campo" />
                </Campo>
                <Botao variante="secundario">Salvar</Botao>
              </form>
            </Cartao>
          )}

          {av.status === 'agendada' && (
            <Cartao>
              <h2 className="mb-1 font-semibold">Concluir avaliação</h2>
              <p className="mb-4 text-sm text-suave">
                Nota final = prova ({Number(av.nota_prova).toFixed(0)}) × {PESOS.prova} + caso × {PESOS.caso} + entrevista × {PESOS.entrevista}.
              </p>
              <form action={concluirAvaliacao} className="space-y-4">
                <input type="hidden" name="avaliacao_id" value={av.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo rotulo="Nota do caso prático (0–100)">
                    <input name="nota_caso" type="number" min={0} max={100} step="0.5" required className="campo" />
                  </Campo>
                  <Campo rotulo="Nota da entrevista (0–100)">
                    <input name="nota_entrevista" type="number" min={0} max={100} step="0.5" required className="campo" />
                  </Campo>
                </div>
                <fieldset className="space-y-2">
                  <legend className="rotulo">Nota por competência declarada</legend>
                  {(comps ?? []).map((c) => (
                    <div key={c.competencia_id} className="grid items-center gap-2 rounded-lg border border-linha p-3 text-sm sm:grid-cols-[1fr_90px_1fr]">
                      <span>
                        {(c.competencias as { nome: string }).nome}
                        <span className="block text-xs text-suave">Declarou {ROTULO_NIVEL[c.nivel_declarado as Nivel]} · {c.anos_experiencia} anos</span>
                      </span>
                      <input name={`comp_${c.competencia_id}`} type="number" min={0} max={100} step="0.5" required aria-label="Nota" className="campo" />
                      <input name={`coment_${c.competencia_id}`} placeholder="Comentário (opcional)" className="campo" />
                    </div>
                  ))}
                </fieldset>
                <Campo rotulo="Parecer técnico" dica="Mostrado às empresas na shortlist. Seja objetivo: pontos fortes, pontos de atenção, perfil de projeto indicado.">
                  <textarea name="parecer" rows={5} required minLength={80} className="campo" />
                </Campo>
                <Botao>Concluir e emitir selo</Botao>
              </form>
            </Cartao>
          )}

          {av.status === 'concluida' && (
            <Cartao>
              <div className="mb-2"><SeloNivel nivel={av.nivel_atribuido} nota={av.nota_final} /></div>
              <p className="text-sm italic">“{av.parecer}”</p>
            </Cartao>
          )}
        </div>

        <aside className="space-y-4">
          <Cartao>
            <h2 className="mb-3 font-semibold">Profissional</h2>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-suave">Contato</dt><dd>{pessoa?.email}{pessoa?.telefone ? ` · ${pessoa.telefone}` : ''}</dd></div>
              <div><dt className="text-suave">Local</dt><dd>{prof?.cidade ?? '—'}{prof?.uf ? `/${prof.uf}` : ''}</dd></div>
              <div><dt className="text-suave">Vínculos</dt><dd>{(prof?.vinculos_aceitos as Vinculo[] | undefined)?.map((v) => ROTULO_VINCULO[v]).join(', ')}</dd></div>
              <div><dt className="text-suave">Pretensão CLT / hora PJ</dt><dd>{reais(prof?.pretensao_clt_centavos)} / {reais(prof?.valor_hora_pj_centavos)}</dd></div>
              <div><dt className="text-suave">Nota da prova</dt><dd>{Number(av.nota_prova).toFixed(0)}</dd></div>
            </dl>
            {prof?.resumo && <p className="mt-3 border-t border-linha pt-3 text-sm">{prof.resumo}</p>}
            <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
              {curriculo && <a href={curriculo} target="_blank" rel="noopener noreferrer" className="underline">Currículo</a>}
              {prof?.linkedin_url && <a href={prof.linkedin_url} target="_blank" rel="noopener noreferrer" className="underline">LinkedIn</a>}
            </div>
          </Cartao>
        </aside>
      </div>
    </>
  );
}
