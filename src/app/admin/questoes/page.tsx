import { Aviso, Botao, Campo, Cartao, Titulo, lerAviso } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { NIVEIS, ROTULO_NIVEL, type Nivel } from '@/lib/tipos';
import { alternarQuestao, importarQuestoes, salvarQuestao } from '../acoes';

export const metadata = { title: 'Banco de questões' };

export default async function Questoes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok, sp } = await lerAviso(searchParams);
  const filtroComp = typeof sp.comp === 'string' ? Number(sp.comp) : null;
  const { supabase } = await exigirPapel('admin');

  const { data: comps } = await supabase.from('competencias').select('id, slug, nome').order('id');
  const { data: todas } = await supabase.from('questoes').select('competencia_id, ativa');
  let q = supabase.from('questoes').select('id, competencia_id, nivel, enunciado, alternativas, resposta_correta, ativa').order('created_at', { ascending: false }).limit(50);
  if (filtroComp) q = q.eq('competencia_id', filtroComp);
  const { data: questoes } = await q;

  const contagem = new Map<number, number>();
  for (const x of todas ?? []) if (x.ativa) contagem.set(x.competencia_id, (contagem.get(x.competencia_id) ?? 0) + 1);
  const nomeComp = new Map((comps ?? []).map((c) => [c.id, c.nome]));

  return (
    <>
      <Titulo sub="A prova sorteia questões ativas, priorizando as competências que o profissional declarou.">Banco de questões</Titulo>
      <Aviso erro={erro} ok={ok} />

      <div className="mb-6 flex flex-wrap gap-2">
        <a href="/admin/questoes" className={`rounded-full px-3 py-1 text-xs ${!filtroComp ? 'bg-tinta text-white' : 'bg-black/5'}`}>
          Todas ({todas?.filter((t) => t.ativa).length ?? 0})
        </a>
        {(comps ?? []).map((c) => (
          <a key={c.id} href={`/admin/questoes?comp=${c.id}`} className={`rounded-full px-3 py-1 text-xs ${filtroComp === c.id ? 'bg-tinta text-white' : 'bg-black/5'}`}>
            {c.nome.split(' (')[0]} ({contagem.get(c.id) ?? 0})
          </a>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao>
          <h2 className="mb-4 font-semibold">Nova questão</h2>
          <form action={salvarQuestao} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Competência">
                <select name="competencia_id" required className="campo" defaultValue={filtroComp ?? ''}>
                  <option value="" disabled>Escolha</option>
                  {(comps ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Nível">
                <select name="nivel" className="campo" defaultValue="pleno">
                  {NIVEIS.map((n) => <option key={n} value={n}>{ROTULO_NIVEL[n]}</option>)}
                </select>
              </Campo>
            </div>
            <Campo rotulo="Enunciado">
              <textarea name="enunciado" rows={3} required className="campo" />
            </Campo>
            {['A', 'B', 'C', 'D', 'E'].map((k) => (
              <div key={k} className="flex items-center gap-2">
                <input type="radio" name="correta" value={k} required aria-label={`Alternativa ${k} é a correta`} />
                <span className="w-4 text-sm font-bold">{k}</span>
                <input name={`alt_${k}`} placeholder={k === 'E' ? 'Opcional' : ''} required={k < 'C'} className="campo" />
              </div>
            ))}
            <p className="text-xs text-suave">Marque a bolinha da alternativa correta.</p>
            <Campo rotulo="Explicação (opcional)" dica="Usada no futuro para feedback e cursos.">
              <input name="explicacao" className="campo" />
            </Campo>
            <Botao>Adicionar questão</Botao>
          </form>
        </Cartao>

        <Cartao>
          <h2 className="mb-2 font-semibold">Importar planilha (CSV)</h2>
          <p className="mb-3 text-sm text-tinta-2">
            No Excel, salve como <strong>CSV (separado por ponto e vírgula)</strong> com as colunas:
          </p>
          <code className="mb-3 block overflow-x-auto rounded-lg bg-papel p-3 text-xs">
            competencia;nivel;enunciado;A;B;C;D;E;correta;explicacao
          </code>
          <p className="mb-4 text-xs text-suave">
            competencia = código ({(comps ?? []).slice(0, 4).map((c) => c.slug).join(', ')}…) ou nome · nivel = junior, pleno, senior ou especialista · correta = A a E.
            Se alguma linha tiver erro, nada é importado e você vê quais linhas corrigir.
          </p>
          <form action={importarQuestoes} className="flex flex-wrap items-center gap-3">
            <input type="file" name="arquivo" accept=".csv,text/csv" required className="text-sm" />
            <Botao variante="secundario">Importar</Botao>
          </form>
        </Cartao>
      </div>

      <h2 className="mb-3 mt-8 font-display text-xl font-bold">Últimas questões</h2>
      <div className="space-y-3">
        {(questoes ?? []).map((x) => (
          <Cartao key={x.id} className={`p-4 sm:p-4 ${x.ativa ? '' : 'opacity-50'}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-suave">
              <span>{nomeComp.get(x.competencia_id)} · {ROTULO_NIVEL[x.nivel as Nivel]}</span>
              <form action={alternarQuestao}>
                <input type="hidden" name="questao_id" value={x.id} />
                <input type="hidden" name="ativa" value={String(!x.ativa)} />
                <button className="underline">{x.ativa ? 'desativar' : 'reativar'}</button>
              </form>
            </div>
            <p className="mb-2 whitespace-pre-line text-sm font-medium">{x.enunciado}</p>
            <ul className="space-y-1 text-sm">
              {(x.alternativas as { chave: string; texto: string }[]).map((a) => (
                <li key={a.chave} className={a.chave === x.resposta_correta ? 'font-semibold text-verde' : 'text-tinta-2'}>
                  {a.chave}) {a.texto}
                </li>
              ))}
            </ul>
          </Cartao>
        ))}
      </div>
    </>
  );
}
