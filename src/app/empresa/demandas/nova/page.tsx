import { redirect } from 'next/navigation';
import { Aviso, Botao, Campo, Cartao, Titulo, lerAviso } from '@/components/ui';
import { exigirPapel, obterEmpresaDoUsuario } from '@/lib/auth';
import { NIVEIS, ROTULO_MODALIDADE, ROTULO_NIVEL, ROTULO_VINCULO, UFS, type Modalidade, type Vinculo } from '@/lib/tipos';
import { criarDemanda } from '../../acoes';

export const metadata = { title: 'Nova demanda' };

const MODELOS = [
  ['creditos', 'Créditos', 'Consome créditos do seu pacote ao receber a shortlist.'],
  ['assinatura', 'Assinatura', 'Incluído na sua assinatura mensal.'],
  ['success_fee', 'Success fee', 'Você só paga um percentual se contratar.'],
] as const;

export default async function NovaDemanda({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro } = await lerAviso(searchParams);
  const { supabase, user } = await exigirPapel('empresa');
  if (!(await obterEmpresaDoUsuario(user.id))) redirect('/empresa/cadastro');
  const { data: competencias } = await supabase
    .from('competencias')
    .select('id, nome, especialidades!inner(slug)')
    .eq('especialidades.slug', 'totvs-rm')
    .order('id');

  return (
    <div className="mx-auto max-w-3xl">
      <Titulo sub="Quanto mais detalhes, mais precisa será a shortlist.">Nova demanda · TOTVS RM</Titulo>
      <Aviso erro={erro} />
      <form action={criarDemanda} className="space-y-6">
        <Cartao className="space-y-4">
          <Campo rotulo="Título" dica="Ex.: Consultor RM Labore para implantação de eSocial">
            <input name="titulo" required minLength={5} className="campo" />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo rotulo="Vínculo">
              <select name="vinculo" className="campo" defaultValue="pj">
                {(Object.keys(ROTULO_VINCULO) as Vinculo[]).map((v) => <option key={v} value={v}>{ROTULO_VINCULO[v]}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Modalidade">
              <select name="modalidade" className="campo" defaultValue="remoto">
                {(Object.keys(ROTULO_MODALIDADE) as Modalidade[]).map((m) => <option key={m} value={m}>{ROTULO_MODALIDADE[m]}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Nível mínimo">
              <select name="nivel_minimo" className="campo" defaultValue="pleno">
                {NIVEIS.map((n) => <option key={n} value={n}>{ROTULO_NIVEL[n]}</option>)}
              </select>
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Campo rotulo="Cidade">
                <input name="cidade" className="campo" />
              </Campo>
            </div>
            <Campo rotulo="UF">
              <select name="uf" className="campo" defaultValue="">
                <option value="">—</option>
                {UFS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Valor mínimo (R$)" dica="Salário mensal (CLT) ou valor/hora (PJ/freela)">
              <input name="valor_min" inputMode="decimal" className="campo" />
            </Campo>
            <Campo rotulo="Valor máximo (R$)">
              <input name="valor_max" inputMode="decimal" className="campo" />
            </Campo>
          </div>
          <Campo rotulo="Descrição da oportunidade">
            <textarea name="descricao" rows={5} className="campo" />
          </Campo>
        </Cartao>

        <Cartao>
          <h2 className="mb-3 font-semibold">Competências necessárias</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {(competencias ?? []).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-linha px-3 py-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="competencia" value={c.id} /> {c.nome}
                </label>
                <label className="flex items-center gap-1 text-xs text-suave">
                  <input type="checkbox" name={`obrig_${c.id}`} defaultChecked /> obrigatória
                </label>
              </div>
            ))}
          </div>
        </Cartao>

        <Cartao>
          <h2 className="mb-3 font-semibold">Forma de cobrança</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {MODELOS.map(([v, t, d], i) => (
              <label key={v} className="cursor-pointer rounded-xl border border-linha p-4 text-sm has-[:checked]:border-tinta has-[:checked]:bg-tinta/5">
                <input type="radio" name="modelo_cobranca" value={v} defaultChecked={i === 0} className="mr-2" />
                <strong>{t}</strong>
                <span className="mt-1 block text-suave">{d}</span>
              </label>
            ))}
          </div>
        </Cartao>

        <div className="flex justify-end">
          <Botao className="px-6 py-3">Criar demanda</Botao>
        </div>
      </form>
    </div>
  );
}
