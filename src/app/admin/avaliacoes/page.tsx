import Link from 'next/link';
import { Aviso, Botao, Cartao, Etiqueta, Titulo, Vazio, lerAviso } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { dataBR } from '@/lib/regras';
import { ROTULO_STATUS_AVALIACAO } from '@/lib/tipos';
import { atribuirAvaliador, marcarAvaliadorPago } from '../acoes';

export const metadata = { title: 'Avaliações' };

const FILTROS = [
  ['pendentes', 'Em andamento'],
  ['concluida', 'Concluídas'],
  ['todas', 'Todas'],
] as const;

export default async function AvaliacoesAdmin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok, sp } = await lerAviso(searchParams);
  const filtro = typeof sp.filtro === 'string' ? sp.filtro : 'pendentes';
  const { supabase } = await exigirPapel('admin');

  let q = supabase
    .from('avaliacoes')
    .select('id, status, nota_prova, nota_final, caso_enviado_em, agendada_para, concluida_em, avaliador_id, avaliador_pago_em, profissionais(titulo, perfis(nome)), avaliadores(perfis(nome))')
    .order('created_at', { ascending: false })
    .limit(200);
  if (filtro === 'pendentes') q = q.neq('status', 'concluida').neq('status', 'cancelada');
  if (filtro === 'concluida') q = q.eq('status', 'concluida');
  const [{ data: lista }, { data: avaliadores }] = await Promise.all([
    q,
    supabase.from('avaliadores').select('id, perfis(nome)').eq('aprovado', true),
  ]);

  return (
    <>
      <Titulo sub="Atribua avaliadores e acompanhe as entrevistas.">Avaliações</Titulo>
      <Aviso erro={erro} ok={ok} />
      <nav className="mb-4 flex gap-1 text-sm">
        {FILTROS.map(([v, r]) => (
          <Link key={v} href={`/admin/avaliacoes?filtro=${v}`} className={`rounded-md px-3 py-1.5 ${filtro === v ? 'bg-tinta text-white' : 'hover:bg-black/5'}`}>
            {r}
          </Link>
        ))}
      </nav>
      {!avaliadores?.length && (
        <p className="mb-4 rounded-lg bg-ambar-claro px-4 py-3 text-sm text-ambar">
          Nenhum avaliador ativo. Cadastre avaliadores em <Link href="/admin/pessoas" className="underline">Avaliadores</Link>.
        </p>
      )}
      {!lista?.length ? (
        <Vazio>Nada por aqui.</Vazio>
      ) : (
        <Cartao className="divide-y divide-linha p-0 sm:p-0">
          {lista.map((a) => {
            const p = a.profissionais as unknown as { titulo: string; perfis: { nome: string } };
            const av = a.avaliadores as unknown as { perfis: { nome: string } } | null;
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/avaliador/avaliacoes/${a.id}`} className="font-semibold hover:underline">{p.perfis.nome}</Link>
                  <p className="text-sm text-suave">
                    {p.titulo} · prova {Number(a.nota_prova ?? 0).toFixed(0)}
                    {a.nota_final != null && ` · final ${Number(a.nota_final).toFixed(0)}`}
                    {a.agendada_para && a.status === 'agendada' && ` · entrevista ${dataBR(a.agendada_para, true)}`}
                  </p>
                </div>
                <Etiqueta cor={a.status === 'concluida' ? 'verde' : 'ambar'}>{ROTULO_STATUS_AVALIACAO[a.status]}</Etiqueta>
                {a.status !== 'concluida' && a.status !== 'cancelada' ? (
                  <form action={atribuirAvaliador} className="flex gap-2">
                    <input type="hidden" name="avaliacao_id" value={a.id} />
                    <select name="avaliador_id" defaultValue={a.avaliador_id ?? ''} required className="campo w-44" aria-label="Avaliador">
                      <option value="" disabled>Escolher avaliador</option>
                      {(avaliadores ?? []).map((x) => (
                        <option key={x.id} value={x.id}>{(x.perfis as unknown as { nome: string }).nome}</option>
                      ))}
                    </select>
                    <Botao variante="secundario">{a.avaliador_id ? 'Trocar' : 'Atribuir'}</Botao>
                  </form>
                ) : (
                  <span className="flex items-center gap-2 text-sm text-suave">
                    {av?.perfis.nome}
                    {a.status === 'concluida' &&
                      (a.avaliador_pago_em ? (
                        <Etiqueta cor="verde">pago</Etiqueta>
                      ) : (
                        <form action={marcarAvaliadorPago}>
                          <input type="hidden" name="avaliacao_id" value={a.id} />
                          <button className="text-xs font-semibold text-tinta underline">marcar pago</button>
                        </form>
                      ))}
                  </span>
                )}
              </div>
            );
          })}
        </Cartao>
      )}
    </>
  );
}
