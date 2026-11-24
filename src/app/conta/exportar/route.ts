import { NextResponse } from 'next/server';
import { exigirPapel, registrarAuditoria, TODOS_PAPEIS } from '@/lib/auth';
import { criarClienteAdmin } from '@/lib/supabase/admin';

/** LGPD art. 18 — portabilidade: todos os dados do titular em JSON. */
export async function GET() {
  const { user } = await exigirPapel(...TODOS_PAPEIS);
  const admin = criarClienteAdmin();
  const id = user.id;
  const sel = (tabela: string, coluna: string, campos = '*') => admin.from(tabela).select(campos).eq(coluna, id).then((r) => r.data ?? []);

  const tentativas = await sel('tentativas_prova', 'profissional_id');
  const finalizadas = tentativas.filter((t: any) => t.status !== 'em_andamento').map((t: any) => t.id);
  const respostas = finalizadas.length
    ? (await admin.from('respostas_tentativa').select('tentativa_id, ordem, resposta, correta, respondida_em, questoes(enunciado)').in('tentativa_id', finalizadas)).data
    : [];
  const avaliacoes = await sel('avaliacoes', 'profissional_id');
  const idsAv = avaliacoes.map((a: any) => a.id);
  const notas = idsAv.length ? (await admin.from('avaliacao_notas_competencia').select('*').in('avaliacao_id', idsAv)).data : [];

  const dados = {
    gerado_em: new Date().toISOString(),
    conta: { id, email: user.email, criada_em: user.created_at, ultimo_acesso: user.last_sign_in_at },
    perfil: (await sel('perfis', 'id'))[0] ?? null,
    profissional: (await sel('profissionais', 'id'))[0] ?? null,
    registros_profissionais: await sel('registros_profissionais', 'profissional_id'),
    competencias: await sel('competencias_profissional', 'profissional_id'),
    provas: tentativas,
    respostas_das_provas: respostas,
    avaliacoes,
    notas_por_competencia: notas,
    selos: await sel('selos', 'profissional_id'),
    indicacoes_recebidas: await sel('indicacoes', 'profissional_id', 'id, status, enviada_em, contato_liberado_em, contratado_em, created_at'),
    empresas_vinculadas: await sel('membros_empresa', 'user_id'),
    avaliador: (await sel('avaliadores', 'id', 'id, bio, valor_avaliacao_centavos, aprovado, created_at'))[0] ?? null,
    consentimentos: await sel('consentimentos', 'user_id'),
    registro_de_atividades: await sel('logs_auditoria', 'user_id', 'acao, entidade, created_at'),
  };

  await registrarAuditoria(id, 'exportar_dados', 'perfis', id);
  return new NextResponse(JSON.stringify(dados, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="otto-meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
