import Link from 'next/link';
import { Aviso, Botao, Campo, Cartao, Etiqueta, Titulo, lerAviso } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { alternarAtivo, salvarCompetencia, salvarEspecialidade } from '../acoes';

export const metadata = { title: 'Catálogo' };

function BotaoAtivo({ tabela, id, ativa, voltaQs }: { tabela: string; id: number; ativa: boolean; voltaQs: string }) {
  return (
    <form action={alternarAtivo}>
      <input type="hidden" name="tabela" value={tabela} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ativa" value={String(!ativa)} />
      <input type="hidden" name="volta_qs" value={voltaQs} />
      <button className="text-xs underline">{ativa ? 'desativar' : 'ativar'}</button>
    </form>
  );
}

export default async function Catalogo({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok, sp } = await lerAviso(searchParams);
  const { supabase } = await exigirPapel('admin');

  const [{ data: areas }, { data: especialidades }] = await Promise.all([
    supabase.from('areas').select('*').order('id'),
    supabase.from('especialidades').select('*').order('id'),
  ]);
  const espId = typeof sp.esp === 'string' ? Number(sp.esp) : especialidades?.[0]?.id;
  const esp = especialidades?.find((e) => e.id === espId);
  const { data: competencias } = esp
    ? await supabase.from('competencias').select('*').eq('especialidade_id', esp.id).order('id')
    : { data: [] };
  const voltaQs = esp ? `esp=${esp.id}` : '';

  return (
    <>
      <Titulo sub="Áreas, especialidades e competências avaliadas. Desativar esconde do cadastro sem apagar o histórico.">Catálogo</Titulo>
      <Aviso erro={erro} ok={ok} />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          {(areas ?? []).map((a) => (
            <Cartao key={a.id} className="p-4 sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-semibold">{a.nome}</p>
                <div className="flex items-center gap-2">
                  <Etiqueta cor={a.ativa ? 'verde' : 'neutra'}>{a.ativa ? 'ativa' : 'inativa'}</Etiqueta>
                  <BotaoAtivo tabela="areas" id={a.id} ativa={a.ativa} voltaQs={voltaQs} />
                </div>
              </div>
              {a.conselhos_aceitos?.length > 0 && <p className="mb-2 text-xs text-suave">Registro: {a.conselhos_aceitos.join(', ')}</p>}
              <ul className="space-y-1 text-sm">
                {(especialidades ?? []).filter((e) => e.area_id === a.id).map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/admin/catalogo?esp=${e.id}`}
                      className={`block rounded-md px-2 py-1 ${e.id === esp?.id ? 'bg-tinta text-white' : 'hover:bg-black/5'} ${e.ativa ? '' : 'opacity-50'}`}
                    >
                      {e.nome}
                    </Link>
                  </li>
                ))}
              </ul>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-xs text-tinta-2">+ especialidade</summary>
                <form action={salvarEspecialidade} className="mt-2 flex gap-2">
                  <input type="hidden" name="area_id" value={a.id} />
                  <input name="nome" required placeholder="Ex.: TOTVS Protheus" aria-label="Nome da especialidade" className="campo" />
                  <Botao variante="secundario">Criar</Botao>
                </form>
              </details>
            </Cartao>
          ))}
        </aside>

        {esp && (
          <div className="space-y-6">
            <Cartao>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-display text-xl font-bold">{esp.nome}</h2>
                <div className="flex items-center gap-2">
                  <Etiqueta cor={esp.ativa ? 'verde' : 'neutra'}>{esp.ativa ? 'ativa' : 'inativa'}</Etiqueta>
                  <BotaoAtivo tabela="especialidades" id={esp.id} ativa={esp.ativa} voltaQs={voltaQs} />
                </div>
              </div>
              <form action={salvarEspecialidade} className="space-y-3">
                <input type="hidden" name="id" value={esp.id} />
                <Campo rotulo="Nome">
                  <input name="nome" defaultValue={esp.nome} required className="campo" />
                </Campo>
                <Campo rotulo="Caso prático padrão" dica="Enviado ao profissional aprovado na prova desta especialidade.">
                  <textarea name="caso_pratico_padrao" rows={7} defaultValue={esp.caso_pratico_padrao ?? ''} className="campo" />
                </Campo>
                <Botao variante="secundario">Salvar especialidade</Botao>
              </form>
            </Cartao>

            <Cartao className="p-0 sm:p-0">
              <h2 className="px-5 pt-5 font-semibold">Competências ({competencias?.length ?? 0})</h2>
              <div className="divide-y divide-linha">
                {(competencias ?? []).map((c) => (
                  <div key={c.id} className={`px-5 py-3 ${c.ativa ? '' : 'opacity-50'}`}>
                    <form action={salvarCompetencia} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto] sm:items-center">
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="especialidade_id" value={esp.id} />
                      <input name="nome" defaultValue={c.nome} required aria-label="Nome" className="campo" />
                      <input name="descricao" defaultValue={c.descricao ?? ''} aria-label="Descrição" className="campo" />
                      <Botao variante="secundario">Salvar</Botao>
                    </form>
                    <div className="mt-1 flex items-center gap-3 text-xs text-suave">
                      <span>código: {c.slug}</span>
                      <BotaoAtivo tabela="competencias" id={c.id} ativa={c.ativa} voltaQs={voltaQs} />
                    </div>
                  </div>
                ))}
              </div>
              <form action={salvarCompetencia} className="grid gap-2 border-t border-linha bg-papel/60 px-5 py-4 sm:grid-cols-[1fr_1.4fr_auto]">
                <input type="hidden" name="especialidade_id" value={esp.id} />
                <input name="nome" required placeholder="Nova competência" aria-label="Nova competência" className="campo" />
                <input name="descricao" placeholder="Descrição (o que é avaliado)" aria-label="Descrição" className="campo" />
                <Botao>Adicionar</Botao>
              </form>
            </Cartao>
            <p className="text-xs text-suave">
              O código (slug) é usado na importação de questões por planilha e não muda depois de criado.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
