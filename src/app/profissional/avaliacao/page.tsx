import Link from 'next/link';
import { Aviso, Botao, Campo, Cartao, Etiqueta, SeloNivel, Titulo, lerAviso } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { dataBR, PESOS } from '@/lib/regras';
import { ROTULO_STATUS_AVALIACAO, type Nivel } from '@/lib/tipos';
import { enviarCaso, iniciarProva } from '../acoes';
import { resumoProfissional } from '../dados';

export const metadata = { title: 'Avaliação técnica' };

export default async function Avaliacao({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok } = await lerAviso(searchParams);
  const { supabase, user } = await exigirPapel('profissional');
  const r = await resumoProfissional(supabase, user.id);
  const av = r.avaliacao;
  const emAndamento = r.tentativas.find((t) => t.status === 'em_andamento' && new Date(t.expira_em) > new Date());
  const { data: prova } = await supabase.from('provas').select('num_questoes, tempo_limite_min, nota_minima').eq('ativa', true).limit(1).maybeSingle();
  const { data: notas } = av
    ? await supabase.from('avaliacao_notas_competencia').select('nota, nivel, comentario, competencias(nome)').eq('avaliacao_id', av.id)
    : { data: [] };

  return (
    <>
      <Titulo sub={`Nota final = prova ${PESOS.prova * 100}% + caso prático ${PESOS.caso * 100}% + entrevista ${PESOS.entrevista * 100}%.`}>
        Avaliação técnica
      </Titulo>
      <Aviso erro={erro} ok={ok} />

      <div className="space-y-6">
        {/* Etapa 1 */}
        <Cartao>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">1. Prova online</h2>
            {av ? <Etiqueta cor="verde">Aprovado · {Number(av.nota_prova).toFixed(0)}</Etiqueta> : null}
          </div>
          {av ? (
            <p className="text-sm text-suave">Etapa concluída.</p>
          ) : emAndamento ? (
            <Link href={`/profissional/avaliacao/prova/${emAndamento.id}`} className="font-semibold text-ambar underline">
              Você tem uma prova em andamento. Continuar →
            </Link>
          ) : (
            <>
              <p className="mb-4 text-sm text-tinta-2">
                {prova
                  ? `${prova.num_questoes} questões de múltipla escolha · ${prova.tempo_limite_min} minutos · nota mínima ${Number(prova.nota_minima).toFixed(0)}.`
                  : 'Prova indisponível no momento.'}{' '}
                O cronômetro começa ao clicar em iniciar e a prova é enviada automaticamente ao fim do tempo.
              </p>
              {r.tentativas[0] && (
                <p className="mb-4 text-sm text-suave">
                  Última tentativa: nota {Number(r.tentativas[0].nota ?? 0).toFixed(0)} em {dataBR(r.tentativas[0].finalizada_em)}.
                </p>
              )}
              <form action={iniciarProva}>
                <Botao>Iniciar prova</Botao>
              </form>
            </>
          )}
        </Cartao>

        {/* Etapa 2 */}
        <Cartao className={!av ? 'opacity-50' : ''}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">2. Caso prático</h2>
            {av?.caso_enviado_em && <Etiqueta cor="verde">Enviado em {dataBR(av.caso_enviado_em)}</Etiqueta>}
          </div>
          {av?.status === 'aguardando_caso' ? (
            <form action={enviarCaso} className="space-y-4">
              <input type="hidden" name="avaliacao_id" value={av.id} />
              <div className="whitespace-pre-line rounded-lg bg-papel p-4 text-sm">{av.caso_pratico_enunciado}</div>
              <Campo rotulo="Sua solução">
                <textarea name="resposta" rows={12} required minLength={200} className="campo font-mono text-xs" />
              </Campo>
              <Campo rotulo="Anexo (opcional)" dica="PDF, SQL, TXT, ZIP, DOCX ou XLSX até 5 MB.">
                <input name="arquivo" type="file" className="block text-sm" />
              </Campo>
              <Botao>Enviar caso prático</Botao>
            </form>
          ) : (
            <p className="text-sm text-suave">{av ? 'Etapa concluída.' : 'Liberado após aprovação na prova.'}</p>
          )}
        </Cartao>

        {/* Etapa 3 */}
        <Cartao className={!av?.caso_enviado_em ? 'opacity-50' : ''}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">3. Entrevista técnica</h2>
            {av && <Etiqueta cor={av.status === 'concluida' ? 'verde' : 'ambar'}>{ROTULO_STATUS_AVALIACAO[av.status]}</Etiqueta>}
          </div>
          {av?.status === 'agendada' && (
            <p className="text-sm">
              Agendada para <strong>{dataBR(av.agendada_para, true)}</strong>.{' '}
              {av.link_reuniao && (
                <a href={av.link_reuniao} target="_blank" rel="noopener noreferrer" className="font-semibold text-ambar underline">
                  Link da reunião
                </a>
              )}
            </p>
          )}
          {av?.status === 'aguardando_avaliador' && <p className="text-sm text-suave">Um avaliador especialista entrará em contato para agendar.</p>}
          {av?.status === 'concluida' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <SeloNivel nivel={av.nivel_atribuido as Nivel} nota={av.nota_final} />
                <span className="text-sm text-suave">
                  Prova {Number(av.nota_prova).toFixed(0)} · Caso {Number(av.nota_caso).toFixed(0)} · Entrevista {Number(av.nota_entrevista).toFixed(0)}
                </span>
              </div>
              {av.parecer && <p className="rounded-lg bg-papel p-4 text-sm italic">“{av.parecer}”</p>}
              {notas && notas.length > 0 && (
                <ul className="divide-y divide-linha text-sm">
                  {notas.map((n, i) => (
                    <li key={i} className="flex items-center justify-between py-2">
                      <span>{(n.competencias as unknown as { nome: string }).nome}</span>
                      <SeloNivel nivel={n.nivel} nota={n.nota} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {!av?.caso_enviado_em && <p className="text-sm text-suave">Liberada após o envio do caso prático.</p>}
        </Cartao>
      </div>
    </>
  );
}
