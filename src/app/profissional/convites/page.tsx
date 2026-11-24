import { Aviso, Botao, Cartao, Etiqueta, Titulo, Vazio, lerAviso } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { dataBR, reais } from '@/lib/regras';
import { ROTULO_MODALIDADE, ROTULO_STATUS_INDICACAO, ROTULO_VINCULO, type Modalidade, type Vinculo } from '@/lib/tipos';
import { responderConvite } from '../acoes';

export const metadata = { title: 'Convites' };

export default async function Convites({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok } = await lerAviso(searchParams);
  const { supabase, user } = await exigirPapel('profissional');

  // RLS: só convites do próprio profissional e já enviados à empresa
  const { data: convites } = await supabase
    .from('indicacoes')
    .select('id, status, demanda_id, enviada_em')
    .eq('profissional_id', user.id)
    .order('created_at', { ascending: false });

  // Dados da vaga (o profissional não lê a tabela de demandas diretamente)
  const ids = (convites ?? []).map((c) => c.demanda_id);
  const { data: demandas } = ids.length
    ? await criarClienteAdmin()
        .from('demandas')
        .select('id, titulo, vinculo, modalidade, cidade, uf, valor_min_centavos, valor_max_centavos, descricao, empresas(nome_fantasia, razao_social)')
        .in('id', ids)
    : { data: [] };
  const porId = new Map((demandas ?? []).map((d) => [d.id, d]));

  return (
    <>
      <Titulo sub="Empresas que receberam seu perfil. Seu nome e contato só são enviados se você aceitar.">Convites</Titulo>
      <Aviso erro={erro} ok={ok} />
      {!convites?.length && <Vazio>Nenhum convite ainda. Com o selo Otto, você passa a ser indicado para as empresas.</Vazio>}
      <div className="space-y-4">
        {(convites ?? []).map((c) => {
          const d = porId.get(c.demanda_id);
          if (!d) return null;
          const empresa = d.empresas as unknown as { nome_fantasia: string | null; razao_social: string };
          const mostraEmpresa = c.status === 'aceito_profissional' || c.status === 'contratado';
          return (
            <Cartao key={c.id}>
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{d.titulo}</h2>
                  <p className="text-sm text-suave">
                    {mostraEmpresa ? empresa.nome_fantasia || empresa.razao_social : 'Empresa revelada após o aceite'} ·{' '}
                    {ROTULO_VINCULO[d.vinculo as Vinculo]} · {ROTULO_MODALIDADE[d.modalidade as Modalidade]}
                    {d.cidade ? ` · ${d.cidade}/${d.uf}` : ''}
                  </p>
                </div>
                <Etiqueta cor={c.status === 'contato_solicitado' ? 'ambar' : 'neutra'}>{ROTULO_STATUS_INDICACAO[c.status]}</Etiqueta>
              </div>
              {(d.valor_min_centavos || d.valor_max_centavos) && (
                <p className="mb-2 text-sm">Faixa: {reais(d.valor_min_centavos)} a {reais(d.valor_max_centavos)}</p>
              )}
              {d.descricao && <p className="mb-3 whitespace-pre-line text-sm text-tinta-2">{d.descricao}</p>}
              <p className="text-xs text-suave">Indicado em {dataBR(c.enviada_em)}</p>

              {c.status === 'contato_solicitado' && (
                <form action={responderConvite} className="mt-4 flex flex-wrap gap-2">
                  <input type="hidden" name="indicacao_id" value={c.id} />
                  <Botao name="decisao" value="aceitar">Aceitar e liberar meu contato</Botao>
                  <Botao name="decisao" value="recusar" variante="secundario">Não tenho interesse</Botao>
                </form>
              )}
            </Cartao>
          );
        })}
      </div>
    </>
  );
}
