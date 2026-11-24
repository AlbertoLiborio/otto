import { Aviso, Botao, Campo, Cartao, Etiqueta, Titulo, Vazio, lerAviso } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { reais } from '@/lib/regras';
import { alternarAvaliador, promoverAvaliador } from '../acoes';

export const metadata = { title: 'Avaliadores' };

export default async function Pessoas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok } = await lerAviso(searchParams);
  const { supabase } = await exigirPapel('admin');
  const { data: avaliadores } = await supabase
    .from('avaliadores')
    .select('id, aprovado, valor_avaliacao_centavos, perfis(nome, email), avaliacoes(status)')
    .order('created_at');

  return (
    <>
      <Titulo sub="Parceiros remunerados por avaliação concluída.">Avaliadores</Titulo>
      <Aviso erro={erro} ok={ok} />

      <Cartao className="mb-6">
        <h2 className="mb-1 font-semibold">Adicionar avaliador</h2>
        <p className="mb-4 text-sm text-suave">A pessoa precisa criar uma conta no Otto antes. Depois, informe o e-mail dela aqui.</p>
        <form action={promoverAvaliador} className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
          <Campo rotulo="E-mail da conta">
            <input name="email" type="email" required className="campo" />
          </Campo>
          <Campo rotulo="Valor por avaliação (R$)">
            <input name="valor" inputMode="decimal" placeholder="150,00" className="campo" />
          </Campo>
          <Botao>Tornar avaliador</Botao>
        </form>
      </Cartao>

      {!avaliadores?.length ? (
        <Vazio>Nenhum avaliador cadastrado.</Vazio>
      ) : (
        <Cartao className="divide-y divide-linha p-0 sm:p-0">
          {avaliadores.map((a) => {
            const p = a.perfis as unknown as { nome: string; email: string };
            const avs = a.avaliacoes as unknown as { status: string }[];
            const concl = avs.filter((x) => x.status === 'concluida').length;
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.nome}</p>
                  <p className="text-sm text-suave">{p.email} · {reais(a.valor_avaliacao_centavos)} por avaliação</p>
                </div>
                <span className="text-sm text-suave">{concl} concluídas · {avs.length - concl} em aberto</span>
                <Etiqueta cor={a.aprovado ? 'verde' : 'neutra'}>{a.aprovado ? 'Ativo' : 'Inativo'}</Etiqueta>
                <form action={alternarAvaliador}>
                  <input type="hidden" name="avaliador_id" value={a.id} />
                  <input type="hidden" name="aprovado" value={String(!a.aprovado)} />
                  <button className="text-xs underline">{a.aprovado ? 'desativar' : 'ativar'}</button>
                </form>
              </div>
            );
          })}
        </Cartao>
      )}
    </>
  );
}
