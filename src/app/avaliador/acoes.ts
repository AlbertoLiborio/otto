'use server';

import { revalidatePath } from 'next/cache';
import { exigirPapel, registrarAuditoria, voltarCom } from '@/lib/auth';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { MESES_VALIDADE_SELO, nivelPorNota, notaFinal } from '@/lib/regras';
import { ROTULO_NIVEL } from '@/lib/tipos';
import { emailDe, enviarEmail } from '@/lib/email';

const texto = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? '').trim().slice(0, max);
const nota0a100 = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : null;
};

/** Carrega a avaliação garantindo que é do avaliador logado (ou admin). */
async function minhaAvaliacao(id: string) {
  const sessao = await exigirPapel('avaliador', 'admin');
  const admin = criarClienteAdmin();
  const { data: av } = await admin.from('avaliacoes').select('*').eq('id', id).maybeSingle();
  const permitido = av && (av.avaliador_id === sessao.user.id || sessao.perfil.papel === 'admin');
  if (!permitido) voltarCom('/avaliador', 'erro', 'Avaliação não encontrada.');
  return { ...sessao, admin, av };
}

export async function agendarEntrevista(form: FormData) {
  const { av, admin, user } = await minhaAvaliacao(texto(form, 'avaliacao_id', 40));
  const volta = `/avaliador/avaliacoes/${av.id}`;
  const quando = texto(form, 'agendada_para', 20); // datetime-local (horário de Brasília)
  const link = texto(form, 'link_reuniao', 500);
  if (!['aguardando_avaliador', 'agendada'].includes(av.status)) voltarCom(volta, 'erro', 'Esta avaliação não pode ser agendada.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(quando)) voltarCom(volta, 'erro', 'Informe data e hora.');
  if (link && !/^https:\/\//.test(link)) voltarCom(volta, 'erro', 'O link da reunião deve começar com https://');

  await admin
    .from('avaliacoes')
    .update({ status: 'agendada', agendada_para: new Date(`${quando}:00-03:00`).toISOString(), link_reuniao: link || null })
    .eq('id', av.id);
  await registrarAuditoria(user.id, 'agendar_entrevista', 'avaliacoes', av.id);
  const dataHora = new Date(`${quando}:00-03:00`).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
  enviarEmail({
    para: await emailDe(av.profissional_id),
    assunto: 'Sua entrevista técnica foi agendada',
    titulo: 'Entrevista técnica agendada',
    paragrafos: [
      `Data e hora (Brasília): ${dataHora}.`,
      link ? `Link da reunião: ${link}` : 'O avaliador enviará o link da reunião.',
      'Tenha em mãos exemplos de projetos em que você atuou. A conversa dura cerca de 45 minutos.',
    ],
    botao: { texto: 'Ver minha avaliação', caminho: '/profissional/avaliacao' },
  });
  revalidatePath('/avaliador');
  voltarCom(volta, 'ok', 'Entrevista agendada. O profissional verá data e link no painel dele.');
}

export async function concluirAvaliacao(form: FormData) {
  const { av, admin, user } = await minhaAvaliacao(texto(form, 'avaliacao_id', 40));
  const volta = `/avaliador/avaliacoes/${av.id}`;
  if (av.status !== 'agendada') voltarCom(volta, 'erro', 'Agende e realize a entrevista antes de concluir.');

  const notaCaso = nota0a100(form.get('nota_caso'));
  const notaEntrevista = nota0a100(form.get('nota_entrevista'));
  const parecer = texto(form, 'parecer', 3000);
  if (notaCaso == null || notaEntrevista == null) voltarCom(volta, 'erro', 'Notas devem estar entre 0 e 100.');
  if (parecer.length < 80) voltarCom(volta, 'erro', 'Escreva um parecer de pelo menos 80 caracteres. Ele é mostrado às empresas.');

  const { data: declaradas } = await admin.from('competencias_profissional').select('competencia_id').eq('profissional_id', av.profissional_id);
  const notasComp = (declaradas ?? []).map((d) => ({
    competencia_id: d.competencia_id,
    nota: nota0a100(form.get(`comp_${d.competencia_id}`)),
    comentario: texto(form, `coment_${d.competencia_id}`, 500) || null,
  }));
  if (notasComp.some((n) => n.nota == null)) voltarCom(volta, 'erro', 'Dê uma nota de 0 a 100 para cada competência.');

  const final = notaFinal(Number(av.nota_prova ?? 0), notaCaso, notaEntrevista);
  const nivel = nivelPorNota(final);
  const agora = new Date();
  const validade = new Date(agora);
  validade.setMonth(validade.getMonth() + MESES_VALIDADE_SELO);

  await admin
    .from('avaliacoes')
    .update({
      status: 'concluida',
      nota_caso: notaCaso,
      nota_entrevista: notaEntrevista,
      nota_final: final,
      nivel_atribuido: nivel,
      parecer,
      concluida_em: agora.toISOString(),
    })
    .eq('id', av.id);

  await admin.from('avaliacao_notas_competencia').upsert(
    notasComp.map((n) => ({ avaliacao_id: av.id, competencia_id: n.competencia_id, nota: n.nota!, nivel: nivelPorNota(n.nota!), comentario: n.comentario })),
  );
  for (const n of notasComp) {
    await admin
      .from('competencias_profissional')
      .update({ nivel_validado: nivelPorNota(n.nota!), nota_validada: n.nota, validado_em: agora.toISOString() })
      .eq('profissional_id', av.profissional_id)
      .eq('competencia_id', n.competencia_id);
  }
  await admin.from('selos').insert({
    profissional_id: av.profissional_id,
    especialidade_id: av.especialidade_id,
    avaliacao_id: av.id,
    nivel,
    nota_final: final,
    valido_ate: validade.toISOString(),
  });
  await admin.from('profissionais').update({ status: 'aprovado' }).eq('id', av.profissional_id);
  await registrarAuditoria(user.id, 'concluir_avaliacao', 'avaliacoes', av.id, { final, nivel });
  enviarEmail({
    para: await emailDe(av.profissional_id),
    assunto: 'Seu selo Otto foi emitido',
    titulo: 'Parabéns! Sua avaliação foi concluída',
    paragrafos: [
      `Nota final: ${final.toFixed(0)} · Nível: ${ROTULO_NIVEL[nivel]}.`,
      `Seu selo vale por ${MESES_VALIDADE_SELO} meses. A partir de agora, você pode ser indicado para as empresas clientes do Otto.`,
    ],
    botao: { texto: 'Ver notas e parecer', caminho: '/profissional/avaliacao' },
  });
  revalidatePath('/avaliador');
  voltarCom('/avaliador', 'ok', `Avaliação concluída: nota final ${final.toFixed(0)} (${nivel}). Selo emitido.`);
}
