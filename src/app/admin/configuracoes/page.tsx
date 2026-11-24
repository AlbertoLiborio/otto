import { Aviso, Botao, Campo, Cartao, Titulo, lerAviso } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { PESOS } from '@/lib/regras';
import { salvarPlano, salvarProva } from '../acoes';

export const metadata = { title: 'Preços e provas' };

const ROTULO_TIPO: Record<string, string> = { assinatura: 'Assinatura mensal', creditos: 'Pacote de créditos', success_fee: 'Success fee' };
const reaisCampo = (c: number) => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export default async function Configuracoes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok } = await lerAviso(searchParams);
  const { supabase } = await exigirPapel('admin');
  const [{ data: planos }, { data: provas }] = await Promise.all([
    supabase.from('planos').select('*').order('id'),
    supabase.from('provas').select('*, especialidades(nome)').order('id'),
  ]);

  return (
    <>
      <Titulo sub="Valores cobrados das empresas e regras das provas online.">Preços e provas</Titulo>
      <Aviso erro={erro} ok={ok} />

      <h2 className="mb-3 font-display text-xl font-bold">Planos</h2>
      <div className="mb-3 grid gap-4 lg:grid-cols-3">
        {(planos ?? []).map((p) => (
          <Cartao key={p.id}>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ambar">{ROTULO_TIPO[p.tipo]}</p>
            <form action={salvarPlano} className="space-y-3">
              <input type="hidden" name="id" value={p.id} />
              <Campo rotulo="Nome"><input name="nome" defaultValue={p.nome} required className="campo" /></Campo>
              {p.tipo !== 'success_fee' && (
                <Campo rotulo={p.tipo === 'assinatura' ? 'Preço mensal (R$)' : 'Preço do pacote (R$)'}>
                  <input name="preco" inputMode="decimal" defaultValue={reaisCampo(p.preco_centavos)} className="campo" />
                </Campo>
              )}
              {p.tipo !== 'success_fee' && (
                <div className="grid grid-cols-2 gap-2">
                  <Campo rotulo="Créditos incluídos"><input name="creditos_inclusos" type="number" min={0} defaultValue={p.creditos_inclusos} className="campo" /></Campo>
                  <Campo rotulo="Créditos por shortlist"><input name="creditos_por_shortlist" type="number" min={0} defaultValue={p.creditos_por_shortlist} className="campo" /></Campo>
                </div>
              )}
              {p.tipo === 'success_fee' && (
                <Campo rotulo="% sobre salário ou contrato" dica="Cobrança gerada quando a empresa registra a contratação.">
                  <input name="success_fee_percentual" inputMode="decimal" defaultValue={String(p.success_fee_percentual).replace('.', ',')} className="campo" />
                </Campo>
              )}
              {p.tipo !== 'success_fee' && <input type="hidden" name="success_fee_percentual" value="0" />}
              {p.tipo === 'success_fee' && (
                <>
                  <input type="hidden" name="preco" value="0" />
                  <input type="hidden" name="creditos_inclusos" value="0" />
                  <input type="hidden" name="creditos_por_shortlist" value="0" />
                </>
              )}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={p.ativo} /> Ativo</label>
              <Botao variante="secundario" className="w-full">Salvar</Botao>
            </form>
          </Cartao>
        ))}
      </div>
      <p className="mb-10 text-xs text-suave">
        No pacote de créditos, o primeiro envio de shortlist de cada demanda consome os “créditos por shortlist”. A cobrança em si é
        manual até a integração com o meio de pagamento (Fase 2).
      </p>

      <h2 className="mb-3 font-display text-xl font-bold">Provas online</h2>
      <p className="mb-4 text-sm text-suave">
        Nota final da avaliação = prova × {PESOS.prova} + caso prático × {PESOS.caso} + entrevista × {PESOS.entrevista}.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {(provas ?? []).map((p) => (
          <Cartao key={p.id}>
            <p className="mb-3 font-semibold">{(p.especialidades as { nome: string }).nome}</p>
            <form action={salvarProva} className="grid grid-cols-2 gap-3">
              <input type="hidden" name="id" value={p.id} />
              <Campo rotulo="Nº de questões"><input name="num_questoes" type="number" min={1} max={200} defaultValue={p.num_questoes} className="campo" /></Campo>
              <Campo rotulo="Tempo (minutos)"><input name="tempo_limite_min" type="number" min={5} max={480} defaultValue={p.tempo_limite_min} className="campo" /></Campo>
              <Campo rotulo="Nota mínima (0–100)"><input name="nota_minima" type="number" min={0} max={100} step="0.5" defaultValue={p.nota_minima} className="campo" /></Campo>
              <Campo rotulo="Dias para refazer"><input name="dias_para_refazer" type="number" min={0} max={365} defaultValue={p.dias_para_refazer} className="campo" /></Campo>
              <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="ativa" defaultChecked={p.ativa} /> Prova ativa</label>
              <div className="col-span-2"><Botao variante="secundario">Salvar prova</Botao></div>
            </form>
          </Cartao>
        ))}
      </div>
    </>
  );
}
