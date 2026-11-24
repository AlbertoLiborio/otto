import { notFound, redirect } from 'next/navigation';
import { Botao, Cartao } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { finalizarProva } from '../../../acoes';
import { Cronometro } from './cronometro';

export const metadata = { title: 'Prova online' };

type Alternativa = { chave: string; texto: string };

export default async function Prova({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await exigirPapel('profissional');
  const admin = criarClienteAdmin();

  const { data: t } = await admin.from('tentativas_prova').select('id, profissional_id, status, expira_em').eq('id', id).maybeSingle();
  if (!t || t.profissional_id !== user.id) notFound();
  if (t.status !== 'em_andamento') redirect('/profissional/avaliacao');

  // Somente enunciado e alternativas: o gabarito nunca sai do servidor
  const { data: itens } = await admin
    .from('respostas_tentativa')
    .select('ordem, questao_id, questoes(enunciado, alternativas)')
    .eq('tentativa_id', t.id)
    .order('ordem');

  const formId = 'form-prova';
  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 mb-6 flex items-center justify-between border-b border-linha bg-papel/95 px-4 py-3 backdrop-blur">
        <h1 className="font-display text-xl font-bold">Prova técnica · TOTVS RM</h1>
        <Cronometro expiraEm={t.expira_em} formId={formId} />
      </div>

      <form id={formId} action={finalizarProva} className="space-y-4">
        <input type="hidden" name="tentativa_id" value={t.id} />
        {(itens ?? []).map((item) => {
          const q = item.questoes as unknown as { enunciado: string; alternativas: Alternativa[] };
          return (
            <Cartao key={item.questao_id}>
              <fieldset>
                <legend className="mb-3 whitespace-pre-line font-medium">
                  <span className="mr-2 text-suave">{item.ordem}.</span>
                  {q.enunciado}
                </legend>
                <div className="space-y-2">
                  {q.alternativas.map((a) => (
                    <label key={a.chave} className="flex cursor-pointer gap-3 rounded-lg border border-linha p-3 text-sm has-[:checked]:border-tinta has-[:checked]:bg-tinta/5">
                      <input type="radio" name={`q_${item.questao_id}`} value={a.chave} className="mt-0.5" />
                      <span>
                        <strong className="mr-1">{a.chave})</strong> {a.texto}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </Cartao>
          );
        })}
        <div className="flex justify-end">
          <Botao className="px-6 py-3">Finalizar e enviar prova</Botao>
        </div>
      </form>
    </>
  );
}
