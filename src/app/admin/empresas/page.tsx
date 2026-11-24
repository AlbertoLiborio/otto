import { Aviso, Botao, Cartao, Etiqueta, Titulo, Vazio, lerAviso } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { dataBR, formatarCnpj, reais } from '@/lib/regras';
import { adicionarCreditos, definirAssinatura } from '../acoes';

export const metadata = { title: 'Empresas' };

export default async function Empresas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok } = await lerAviso(searchParams);
  const { supabase } = await exigirPapel('admin');
  const [{ data: empresas }, { data: planos }, { data: cobrancas }] = await Promise.all([
    supabase
      .from('empresas')
      .select('id, cnpj, razao_social, nome_fantasia, created_at, movimentos_credito(quantidade), assinaturas(status, plano_id, planos(nome)), demandas(count)')
      .order('created_at', { ascending: false }),
    supabase.from('planos').select('id, nome, tipo').eq('tipo', 'assinatura').eq('ativo', true),
    supabase.from('cobrancas').select('id, empresa_id, tipo, valor_centavos, status, vencimento').eq('status', 'pendente').order('vencimento'),
  ]);

  return (
    <>
      <Titulo sub="Créditos e assinaturas são ajustados manualmente até a integração com o meio de pagamento (Fase 2).">Empresas</Titulo>
      <Aviso erro={erro} ok={ok} />

      {!!cobrancas?.length && (
        <Cartao className="mb-6">
          <h2 className="mb-3 font-semibold">Cobranças pendentes</h2>
          <ul className="space-y-1 text-sm">
            {cobrancas.map((c) => {
              const e = empresas?.find((x) => x.id === c.empresa_id);
              return (
                <li key={c.id} className="flex justify-between gap-3">
                  <span>{e?.nome_fantasia || e?.razao_social} · {c.tipo === 'success_fee' ? 'Success fee' : c.tipo}</span>
                  <span className="font-semibold">{reais(c.valor_centavos)} · vence {dataBR(c.vencimento)}</span>
                </li>
              );
            })}
          </ul>
        </Cartao>
      )}

      {!empresas?.length ? (
        <Vazio>Nenhuma empresa cadastrada.</Vazio>
      ) : (
        <div className="space-y-3">
          {empresas.map((e) => {
            const saldo = (e.movimentos_credito as { quantidade: number }[]).reduce((s, m) => s + m.quantidade, 0);
            const ass = (e.assinaturas as unknown as { status: string; plano_id: number; planos: { nome: string } }[]).find((a) => a.status === 'ativa');
            return (
              <Cartao key={e.id} className="p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{e.nome_fantasia || e.razao_social}</p>
                    <p className="text-sm text-suave">
                      {formatarCnpj(e.cnpj)} · desde {dataBR(e.created_at)} · {(e.demandas as unknown as { count: number }[])[0]?.count ?? 0} demandas
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Etiqueta cor="ambar">{saldo} créditos</Etiqueta>
                    <Etiqueta cor={ass ? 'verde' : 'neutra'}>{ass ? ass.planos.nome : 'Sem assinatura'}</Etiqueta>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <form action={adicionarCreditos} className="flex items-center gap-2">
                    <input type="hidden" name="empresa_id" value={e.id} />
                    <input name="quantidade" type="number" required placeholder="+5 ou -1" aria-label="Quantidade de créditos" className="campo w-28" />
                    <input name="motivo" placeholder="Motivo (ex.: PIX recebido)" aria-label="Motivo" className="campo w-56" />
                    <Botao variante="secundario">Ajustar créditos</Botao>
                  </form>
                  <form action={definirAssinatura} className="flex items-center gap-2">
                    <input type="hidden" name="empresa_id" value={e.id} />
                    <select name="plano_id" defaultValue={ass?.plano_id ?? 0} aria-label="Plano" className="campo w-48">
                      <option value={0}>Sem assinatura</option>
                      {(planos ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                    <Botao variante="secundario">Salvar plano</Botao>
                  </form>
                </div>
              </Cartao>
            );
          })}
        </div>
      )}
    </>
  );
}
