import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BotaoLink, Cartao, Etiqueta, Titulo, Vazio } from '@/components/ui';
import { exigirPapel, obterEmpresaDoUsuario } from '@/lib/auth';
import { dataBR, formatarCnpj } from '@/lib/regras';
import { ROTULO_STATUS_DEMANDA, ROTULO_VINCULO, type Vinculo } from '@/lib/tipos';

export const metadata = { title: 'Demandas' };

export default async function PainelEmpresa() {
  const { supabase, user } = await exigirPapel('empresa');
  const empresa = await obterEmpresaDoUsuario(user.id);
  if (!empresa) redirect('/empresa/cadastro');

  const [{ data: demandas }, { data: saldo }, { data: assinatura }] = await Promise.all([
    supabase.from('demandas').select('id, titulo, vinculo, status, created_at, indicacoes(count)').eq('empresa_id', empresa.id).order('created_at', { ascending: false }),
    supabase.rpc('saldo_creditos', { p_empresa: empresa.id }),
    supabase.from('assinaturas').select('status, planos(nome)').eq('empresa_id', empresa.id).eq('status', 'ativa').maybeSingle(),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Titulo sub={`${empresa.nome_fantasia || empresa.razao_social} · CNPJ ${formatarCnpj(empresa.cnpj)}`}>Demandas</Titulo>
        <BotaoLink href="/empresa/demandas/nova">+ Nova demanda</BotaoLink>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Cartao>
          <p className="text-sm text-suave">Créditos disponíveis</p>
          <p className="font-display text-3xl font-bold">{saldo ?? 0}</p>
        </Cartao>
        <Cartao>
          <p className="text-sm text-suave">Plano</p>
          <p className="font-semibold">{(assinatura?.planos as unknown as { nome: string } | null)?.nome ?? 'Sem assinatura ativa'}</p>
        </Cartao>
        <Cartao>
          <p className="text-sm text-suave">Demandas abertas</p>
          <p className="font-display text-3xl font-bold">
            {(demandas ?? []).filter((d) => !['encerrada', 'cancelada'].includes(d.status)).length}
          </p>
        </Cartao>
      </div>

      {!demandas?.length ? (
        <Vazio>Nenhuma demanda ainda. Crie a primeira e receba uma shortlist de profissionais avaliados.</Vazio>
      ) : (
        <Cartao className="divide-y divide-linha p-0 sm:p-0">
          {demandas.map((d) => (
            <Link key={d.id} href={`/empresa/demandas/${d.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-black/[0.02]">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{d.titulo}</p>
                <p className="text-sm text-suave">
                  {ROTULO_VINCULO[d.vinculo as Vinculo]} · criada em {dataBR(d.created_at)}
                </p>
              </div>
              <span className="text-sm text-suave">{(d.indicacoes as unknown as { count: number }[])[0]?.count ?? 0} indicados</span>
              <Etiqueta cor={d.status === 'shortlist_enviada' ? 'verde' : d.status === 'cancelada' ? 'vermelha' : 'ambar'}>
                {ROTULO_STATUS_DEMANDA[d.status]}
              </Etiqueta>
            </Link>
          ))}
        </Cartao>
      )}
    </>
  );
}
