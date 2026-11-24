'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { exigirPapel, registrarAuditoria, voltarCom } from '@/lib/auth';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { embaralhar, paraCentavos, validarCnpj } from '@/lib/regras';
import { NIVEIS, UFS, type Nivel, type Vinculo } from '@/lib/tipos';
import { especialidadePadrao } from './dados';
import { emailsDaEmpresa, emailsDosAdmins, enviarEmail } from '@/lib/email';

const texto = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? '').trim().slice(0, max);
const MB = 1024 * 1024;

// ---------------------------------------------------------------- Perfil
export async function salvarPerfil(form: FormData) {
  const { supabase, user } = await exigirPapel('profissional');
  const volta = '/profissional/perfil';

  const titulo = texto(form, 'titulo', 120);
  const uf = texto(form, 'uf', 2).toUpperCase();
  const linkedin = texto(form, 'linkedin_url', 300);
  const vinculos = form.getAll('vinculos').map(String).filter((v): v is Vinculo => ['clt', 'pj', 'freelance'].includes(v));
  const cnpjAtual = texto(form, 'empresa_atual_cnpj', 20);

  if (titulo.length < 5) voltarCom(volta, 'erro', 'Informe um título profissional (ex.: Consultor RM Labore).');
  if (uf && !UFS.includes(uf)) voltarCom(volta, 'erro', 'UF inválida.');
  if (linkedin && !/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(linkedin))
    voltarCom(volta, 'erro', 'Informe o endereço completo do seu LinkedIn (https://www.linkedin.com/in/...).');
  if (vinculos.length === 0) voltarCom(volta, 'erro', 'Escolha pelo menos um tipo de vínculo.');
  if (cnpjAtual && !validarCnpj(cnpjAtual)) voltarCom(volta, 'erro', 'CNPJ da empresa atual inválido.');

  const dados = {
    titulo,
    resumo: texto(form, 'resumo', 2000) || null,
    cidade: texto(form, 'cidade', 80) || null,
    uf: uf || null,
    aceita_remoto: form.get('aceita_remoto') === 'on',
    vinculos_aceitos: vinculos,
    pretensao_clt_centavos: paraCentavos(form.get('pretensao_clt')),
    valor_hora_pj_centavos: paraCentavos(form.get('valor_hora_pj')),
    linkedin_url: linkedin || null,
    empresa_atual_cnpj: cnpjAtual ? validarCnpj(cnpjAtual) : null,
  };

  const { data: existe } = await supabase.from('profissionais').select('id').eq('id', user.id).maybeSingle();
  const { error } = existe
    ? await supabase.from('profissionais').update(dados).eq('id', user.id)
    : await supabase.from('profissionais').insert({ id: user.id, status: 'rascunho', ...dados });
  if (error) voltarCom(volta, 'erro', 'Não foi possível salvar o perfil.');

  await supabase
    .from('perfis')
    .update({ nome: texto(form, 'nome', 120) || undefined, telefone: texto(form, 'telefone', 20) || null })
    .eq('id', user.id);

  // Currículo (PDF até 5 MB) — sempre no caminho fixo do próprio usuário
  const arquivo = form.get('curriculo');
  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.type !== 'application/pdf') voltarCom(volta, 'erro', 'O currículo deve ser um arquivo PDF.');
    if (arquivo.size > 5 * MB) voltarCom(volta, 'erro', 'O currículo deve ter no máximo 5 MB.');
    const caminho = `curriculos/${user.id}.pdf`;
    const admin = criarClienteAdmin();
    const { error: eUp } = await admin.storage.from('documentos').upload(caminho, arquivo, { upsert: true, contentType: 'application/pdf' });
    if (eUp) voltarCom(volta, 'erro', 'Falha ao enviar o currículo.');
    await admin.from('profissionais').update({ curriculo_path: caminho }).eq('id', user.id);
  }

  revalidatePath('/profissional');
  voltarCom(volta, 'ok', 'Perfil salvo.');
}

// ---------------------------------------------------------- Competências
export async function salvarCompetencias(form: FormData) {
  const { supabase, user } = await exigirPapel('profissional');
  const volta = '/profissional/competencias';

  const { data: prof } = await supabase.from('profissionais').select('id').eq('id', user.id).maybeSingle();
  if (!prof) voltarCom('/profissional/perfil', 'erro', 'Preencha seu perfil antes das competências.');

  const ids = form.getAll('competencia').map(Number).filter(Number.isInteger);
  const linhas = ids.map((id) => {
    const nivel = String(form.get(`nivel_${id}`));
    const anos = Math.max(0, Math.min(60, Number(form.get(`anos_${id}`)) || 0));
    return { profissional_id: user.id, competencia_id: id, nivel_declarado: (NIVEIS.includes(nivel as Nivel) ? nivel : 'pleno') as Nivel, anos_experiencia: anos };
  });
  if (linhas.length === 0) voltarCom(volta, 'erro', 'Selecione ao menos uma competência.');

  // Competências já validadas ficam travadas; o RLS só permite mexer nas não validadas.
  const { data: validadas } = await supabase
    .from('competencias_profissional')
    .select('competencia_id')
    .eq('profissional_id', user.id)
    .not('nivel_validado', 'is', null);
  const travadas = new Set((validadas ?? []).map((v) => v.competencia_id));

  await supabase.from('competencias_profissional').delete().eq('profissional_id', user.id).is('nivel_validado', null);
  const novas = linhas.filter((l) => !travadas.has(l.competencia_id));
  if (novas.length) {
    const { error } = await supabase.from('competencias_profissional').insert(novas);
    if (error) voltarCom(volta, 'erro', 'Não foi possível salvar as competências.');
  }
  revalidatePath('/profissional');
  voltarCom(volta, 'ok', 'Competências salvas.');
}

// ------------------------------------------------------------------ Prova
export async function iniciarProva() {
  const { supabase, user } = await exigirPapel('profissional');
  const volta = '/profissional/avaliacao';
  const admin = criarClienteAdmin();
  const esp = await especialidadePadrao(supabase);

  const { data: prof } = await supabase.from('profissionais').select('id, titulo, status').eq('id', user.id).maybeSingle();
  if (!prof?.titulo) voltarCom('/profissional/perfil', 'erro', 'Complete seu perfil antes de iniciar a prova.');

  const { data: declaradas } = await supabase.from('competencias_profissional').select('competencia_id').eq('profissional_id', user.id);
  if (!declaradas?.length) voltarCom('/profissional/competencias', 'erro', 'Declare suas competências antes de iniciar a prova.');

  const { data: prova } = await supabase.from('provas').select('*').eq('especialidade_id', esp.id).eq('ativa', true).limit(1).single();
  if (!prova) voltarCom(volta, 'erro', 'Nenhuma prova ativa no momento.');

  // Já existe prova em andamento? Continua nela.
  const { data: tentativas } = await admin
    .from('tentativas_prova')
    .select('id, status, nota, expira_em, finalizada_em')
    .eq('profissional_id', user.id)
    .eq('prova_id', prova.id)
    .order('iniciada_em', { ascending: false });
  const andamento = tentativas?.find((t) => t.status === 'em_andamento' && new Date(t.expira_em) > new Date());
  if (andamento) redirect(`/profissional/avaliacao/prova/${andamento.id}`);

  // Aprovado antes, com avaliação ativa? Não refaz.
  const { data: avAtiva } = await admin
    .from('avaliacoes')
    .select('id')
    .eq('profissional_id', user.id)
    .eq('especialidade_id', esp.id)
    .neq('status', 'cancelada')
    .limit(1);
  if (avAtiva?.length) voltarCom(volta, 'erro', 'Você já foi aprovado na prova. Siga para as próximas etapas.');

  // RN04 — intervalo para nova tentativa
  const ultima = tentativas?.find((t) => t.status !== 'em_andamento');
  if (ultima?.finalizada_em) {
    const libera = new Date(ultima.finalizada_em);
    libera.setDate(libera.getDate() + prova.dias_para_refazer);
    if (libera > new Date())
      voltarCom(volta, 'erro', `Nova tentativa liberada a partir de ${libera.toLocaleDateString('pt-BR')}.`);
  }

  // Sorteio: prioriza competências declaradas, completa com as demais da especialidade
  const { data: questoes } = await admin
    .from('questoes')
    .select('id, competencia_id, competencias!inner(especialidade_id)')
    .eq('ativa', true)
    .eq('competencias.especialidade_id', esp.id);
  if (!questoes?.length) voltarCom(volta, 'erro', 'O banco de questões ainda está sendo preparado. Volte em breve.');

  const minhas = new Set(declaradas.map((d) => d.competencia_id));
  const preferidas = embaralhar(questoes.filter((q) => minhas.has(q.competencia_id)));
  const outras = embaralhar(questoes.filter((q) => !minhas.has(q.competencia_id)));
  const sorteadas = embaralhar([...preferidas, ...outras].slice(0, prova.num_questoes));

  const expira = new Date(Date.now() + prova.tempo_limite_min * 60_000).toISOString();
  const { data: tentativa, error } = await admin
    .from('tentativas_prova')
    .insert({ prova_id: prova.id, profissional_id: user.id, expira_em: expira })
    .select('id')
    .single();
  if (error || !tentativa) voltarCom(volta, 'erro', 'Não foi possível iniciar a prova.');

  await admin.from('respostas_tentativa').insert(sorteadas.map((q, i) => ({ tentativa_id: tentativa.id, questao_id: q.id, ordem: i + 1 })));
  await admin.from('profissionais').update({ status: 'em_avaliacao' }).eq('id', user.id);
  await registrarAuditoria(user.id, 'iniciar_prova', 'tentativas_prova', tentativa.id, { questoes: sorteadas.length });
  redirect(`/profissional/avaliacao/prova/${tentativa.id}`);
}

export async function finalizarProva(form: FormData) {
  const { supabase, user } = await exigirPapel('profissional');
  const admin = criarClienteAdmin();
  const tentativaId = texto(form, 'tentativa_id', 40);

  const { data: t } = await admin
    .from('tentativas_prova')
    .select('id, profissional_id, status, expira_em, prova_id, provas(nota_minima, especialidade_id)')
    .eq('id', tentativaId)
    .single();
  if (!t || t.profissional_id !== user.id) voltarCom('/profissional/avaliacao', 'erro', 'Prova não encontrada.');
  if (t.status !== 'em_andamento') redirect('/profissional/avaliacao');

  const atrasada = Date.now() > new Date(t.expira_em).getTime() + 2 * 60_000; // tolerância de 2 min
  const { data: itens } = await admin
    .from('respostas_tentativa')
    .select('questao_id, ordem, questoes(resposta_correta)')
    .eq('tentativa_id', t.id);

  const agora = new Date().toISOString();
  const corrigidas = (itens ?? []).map((i) => {
    const resposta = atrasada ? null : (form.get(`q_${i.questao_id}`)?.toString().slice(0, 5) ?? null);
    const gabarito = (i.questoes as unknown as { resposta_correta: string }).resposta_correta;
    return { tentativa_id: t.id, questao_id: i.questao_id, ordem: i.ordem, resposta, correta: resposta === gabarito, respondida_em: resposta ? agora : null };
  });
  await admin.from('respostas_tentativa').upsert(corrigidas);

  const acertos = corrigidas.filter((c) => c.correta).length;
  const nota = corrigidas.length ? Math.round((acertos / corrigidas.length) * 10000) / 100 : 0;
  await admin
    .from('tentativas_prova')
    .update({ status: atrasada ? 'expirada' : 'finalizada', finalizada_em: agora, nota })
    .eq('id', t.id);

  const prova = t.provas as unknown as { nota_minima: number; especialidade_id: number };
  if (!atrasada && nota >= Number(prova.nota_minima)) {
    const esp = await especialidadePadrao(supabase);
    await admin.from('avaliacoes').insert({
      profissional_id: user.id,
      especialidade_id: prova.especialidade_id,
      tentativa_prova_id: t.id,
      nota_prova: nota,
      status: 'aguardando_caso',
      caso_pratico_enunciado: esp.caso_pratico_padrao,
    });
  } else {
    await admin.from('profissionais').update({ status: 'reprovado' }).eq('id', user.id);
  }
  await registrarAuditoria(user.id, 'finalizar_prova', 'tentativas_prova', t.id, { nota, atrasada });
  revalidatePath('/profissional');
  redirect('/profissional/avaliacao');
}

// ---------------------------------------------------------- Caso prático
export async function enviarCaso(form: FormData) {
  const { user } = await exigirPapel('profissional');
  const volta = '/profissional/avaliacao';
  const admin = criarClienteAdmin();
  const avaliacaoId = texto(form, 'avaliacao_id', 40);
  const resposta = texto(form, 'resposta', 20000);

  const { data: av } = await admin.from('avaliacoes').select('id, profissional_id, status').eq('id', avaliacaoId).single();
  if (!av || av.profissional_id !== user.id || av.status !== 'aguardando_caso') voltarCom(volta, 'erro', 'Avaliação não encontrada.');
  if (resposta.length < 200) voltarCom(volta, 'erro', 'Detalhe melhor sua solução (mínimo de 200 caracteres).');

  let caminho: string | null = null;
  const arquivo = form.get('arquivo');
  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.size > 5 * MB) voltarCom(volta, 'erro', 'O anexo deve ter no máximo 5 MB.');
    const ext = (arquivo.name.split('.').pop() ?? '').toLowerCase();
    if (!['pdf', 'sql', 'txt', 'zip', 'docx', 'xlsx'].includes(ext))
      voltarCom(volta, 'erro', 'Anexo permitido: PDF, SQL, TXT, ZIP, DOCX ou XLSX.');
    caminho = `casos/${av.id}/solucao.${ext}`;
    const { error } = await admin.storage.from('documentos').upload(caminho, arquivo, { upsert: true });
    if (error) voltarCom(volta, 'erro', 'Falha ao enviar o anexo.');
  }

  await admin
    .from('avaliacoes')
    .update({ caso_pratico_resposta: resposta, caso_pratico_path: caminho, caso_enviado_em: new Date().toISOString(), status: 'aguardando_avaliador' })
    .eq('id', av.id);
  enviarEmail({
    para: await emailsDosAdmins(),
    assunto: 'Caso prático recebido: atribua um avaliador',
    titulo: 'Novo caso prático para avaliação',
    paragrafos: ['Um profissional aprovado na prova enviou o caso prático e aguarda a atribuição de um avaliador.'],
    botao: { texto: 'Atribuir avaliador', caminho: '/admin/avaliacoes' },
  });
  revalidatePath('/profissional');
  voltarCom(volta, 'ok', 'Caso prático enviado! Em breve um avaliador vai agendar sua entrevista.');
}

// --------------------------------------------------------------- Convites
export async function responderConvite(form: FormData) {
  const { supabase, user } = await exigirPapel('profissional');
  const volta = '/profissional/convites';
  const id = texto(form, 'indicacao_id', 40);
  const aceitar = texto(form, 'decisao', 10) === 'aceitar';

  // RLS garante que só enxergamos convites do próprio profissional
  const { data: ind } = await supabase.from('indicacoes').select('id, status, profissional_id, demanda_id').eq('id', id).maybeSingle();
  if (!ind || ind.profissional_id !== user.id || ind.status !== 'contato_solicitado') voltarCom(volta, 'erro', 'Convite não encontrado.');

  const admin = criarClienteAdmin();
  await admin
    .from('indicacoes')
    .update(aceitar ? { status: 'aceito_profissional', contato_liberado_em: new Date().toISOString() } : { status: 'recusado_profissional' })
    .eq('id', ind.id);
  await registrarAuditoria(user.id, aceitar ? 'liberar_contato' : 'recusar_contato', 'indicacoes', ind.id);

  const { data: dem } = await admin.from('demandas').select('empresa_id, titulo').eq('id', ind.demanda_id).single();
  if (dem) {
    enviarEmail({
      para: await emailsDaEmpresa(dem.empresa_id),
      assunto: aceitar ? `Contato liberado: ${dem.titulo}` : `Candidato indisponível: ${dem.titulo}`,
      titulo: aceitar ? 'O profissional liberou o contato' : 'O profissional não tem interesse no momento',
      paragrafos: aceitar
        ? [`Um candidato da demanda "${dem.titulo}" aceitou conversar com sua empresa. Nome, e-mail e telefone já estão disponíveis.`]
        : [`Um candidato da demanda "${dem.titulo}" recusou o convite. Os demais candidatos da shortlist continuam disponíveis.`],
      botao: { texto: 'Ver shortlist', caminho: `/empresa/demandas/${ind.demanda_id}` },
    });
  }
  voltarCom(volta, 'ok', aceitar ? 'Contato liberado para a empresa. Boa sorte!' : 'Convite recusado.');
}
