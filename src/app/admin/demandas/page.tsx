import Link from 'next/link';
import { Cartao, Etiqueta, Titulo, Vazio } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { dataBR } from '@/lib/regras';
import { ROTULO_STATUS_DEMANDA, ROTULO_VINCULO, type Vinculo } from '@/lib/tipos';

export const metadata = { title: 'Curadoria' };

export default async function DemandasAdmin() {
  const { supabase } = await exigirPapel('admin');
  const { data: demandas } = await supabase
    .from('demandas')
    .select('id, titulo, vinculo, status, modelo_cobranca, created_at, empresas(razao_social, nome_fantasia), indicacoes(count)')
    .order('created_at', { ascending: false })
    .limit(200);

  const ordem = ['aberta', 'em_curadoria', 'shortlist_enviada', 'encerrada', 'cancelada'];
  const lista = [...(demandas ?? [])].sort((a, b) => ordem.indexOf(a.status) - ordem.indexOf(b.status));

  return (
    <>
      <Titulo sub="Demandas abertas primeiro.">Curadoria</Titulo>
      {!lista.length ? (
        <Vazio>Nenhuma demanda ainda.</Vazio>
      ) : (
        <Cartao className="divide-y divide-linha p-0 sm:p-0">
          {lista.map((d) => {
            const e = d.empresas as unknown as { razao_social: string; nome_fantasia: string | null };
            return (
              <Link key={d.id} href={`/admin/demandas/${d.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-black/[0.02]">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{d.titulo}</p>
                  <p className="text-sm text-suave">
                    {e.nome_fantasia || e.razao_social} · {ROTULO_VINCULO[d.vinculo as Vinculo]} · {dataBR(d.created_at)}
                  </p>
                </div>
                <span className="text-sm text-suave">{(d.indicacoes as unknown as { count: number }[])[0]?.count ?? 0} candidatos</span>
                <Etiqueta cor={['aberta', 'em_curadoria'].includes(d.status) ? 'ambar' : d.status === 'shortlist_enviada' ? 'verde' : 'neutra'}>
                  {ROTULO_STATUS_DEMANDA[d.status]}
                </Etiqueta>
              </Link>
            );
          })}
        </Cartao>
      )}
    </>
  );
}
