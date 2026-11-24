import Link from 'next/link';
import { Aviso, Cartao, Etiqueta, Titulo, Vazio, lerAviso } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { dataBR, reais } from '@/lib/regras';
import { ROTULO_STATUS_AVALIACAO } from '@/lib/tipos';

export const metadata = { title: 'Minhas avaliações' };

export default async function PainelAvaliador({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok } = await lerAviso(searchParams);
  const { user } = await exigirPapel('avaliador', 'admin');
  const admin = criarClienteAdmin();
  const [{ data: lista }, { data: eu }] = await Promise.all([
    admin
      .from('avaliacoes')
      .select('id, status, agendada_para, concluida_em, nota_final, avaliador_pago_em, profissionais(titulo, perfis(nome))')
      .eq('avaliador_id', user.id)
      .order('created_at', { ascending: false }),
    admin.from('avaliadores').select('valor_avaliacao_centavos').eq('id', user.id).maybeSingle(),
  ]);
  const concluidas = (lista ?? []).filter((a) => a.status === 'concluida');
  const aReceber = concluidas.filter((a) => !a.avaliador_pago_em).length * Number(eu?.valor_avaliacao_centavos ?? 0);

  return (
    <>
      <Titulo sub="Profissionais atribuídos a você pela curadoria Otto.">Minhas avaliações</Titulo>
      <Aviso erro={erro} ok={ok} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Cartao><p className="text-sm text-suave">Pendentes</p><p className="font-display text-3xl font-bold">{(lista ?? []).length - concluidas.length}</p></Cartao>
        <Cartao><p className="text-sm text-suave">Concluídas</p><p className="font-display text-3xl font-bold">{concluidas.length}</p></Cartao>
        <Cartao><p className="text-sm text-suave">A receber</p><p className="font-display text-3xl font-bold">{reais(aReceber)}</p></Cartao>
      </div>
      {!lista?.length ? (
        <Vazio>Nenhuma avaliação atribuída ainda.</Vazio>
      ) : (
        <Cartao className="divide-y divide-linha p-0 sm:p-0">
          {lista.map((a) => {
            const p = a.profissionais as unknown as { titulo: string; perfis: { nome: string } };
            return (
              <Link key={a.id} href={`/avaliador/avaliacoes/${a.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-black/[0.02]">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p?.perfis?.nome}</p>
                  <p className="text-sm text-suave">{p?.titulo}</p>
                </div>
                {a.agendada_para && a.status === 'agendada' && <span className="text-sm">{dataBR(a.agendada_para, true)}</span>}
                <Etiqueta cor={a.status === 'concluida' ? 'verde' : 'ambar'}>{ROTULO_STATUS_AVALIACAO[a.status]}</Etiqueta>
              </Link>
            );
          })}
        </Cartao>
      )}
    </>
  );
}
