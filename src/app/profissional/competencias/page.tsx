import { Aviso, Botao, Cartao, SeloNivel, Titulo, lerAviso } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { NIVEIS, ROTULO_NIVEL } from '@/lib/tipos';
import { salvarCompetencias } from '../acoes';
import { especialidadePadrao } from '../dados';

export const metadata = { title: 'Competências' };

export default async function Competencias({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok } = await lerAviso(searchParams);
  const { supabase, user } = await exigirPapel('profissional');
  const esp = await especialidadePadrao(supabase);
  const [{ data: lista }, { data: minhas }] = await Promise.all([
    supabase.from('competencias').select('id, nome, descricao').eq('especialidade_id', esp.id).order('id'),
    supabase.from('competencias_profissional').select('*').eq('profissional_id', user.id),
  ]);
  const mapa = new Map((minhas ?? []).map((m) => [m.competencia_id, m]));

  return (
    <>
      <Titulo sub="Marque o que você domina. A prova prioriza questões dessas competências.">Competências · {esp.nome}</Titulo>
      <Aviso erro={erro} ok={ok} />
      <form action={salvarCompetencias}>
        <Cartao className="divide-y divide-linha p-0 sm:p-0">
          {(lista ?? []).map((c) => {
            const m = mapa.get(c.id);
            const travada = Boolean(m?.nivel_validado);
            return (
              <div key={c.id} className="grid items-center gap-3 px-5 py-4 sm:grid-cols-[1fr_auto_auto]">
                <label className="flex gap-3">
                  <input type="checkbox" name="competencia" value={c.id} defaultChecked={Boolean(m)} disabled={travada} className="mt-1" />
                  {travada && <input type="hidden" name="competencia" value={c.id} />}
                  <span>
                    <span className="font-medium">{c.nome}</span>
                    <span className="block text-xs text-suave">{c.descricao}</span>
                  </span>
                </label>
                {travada ? (
                  <span className="sm:col-span-2 sm:justify-self-end">
                    <SeloNivel nivel={m.nivel_validado} nota={m.nota_validada} />
                  </span>
                ) : (
                  <>
                    <select name={`nivel_${c.id}`} defaultValue={m?.nivel_declarado ?? 'pleno'} className="campo w-auto" aria-label={`Nível em ${c.nome}`}>
                      {NIVEIS.map((n) => (
                        <option key={n} value={n}>{ROTULO_NIVEL[n]}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-sm text-suave">
                      <input name={`anos_${c.id}`} type="number" min={0} max={60} defaultValue={m?.anos_experiencia ?? 0} className="campo w-20" />
                      anos
                    </label>
                  </>
                )}
              </div>
            );
          })}
        </Cartao>
        <div className="mt-4 flex justify-end">
          <Botao>Salvar competências</Botao>
        </div>
      </form>
    </>
  );
}
