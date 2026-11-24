'use server';

import { revalidatePath } from 'next/cache';
import { exigirPapel, registrarAuditoria, voltarCom } from '@/lib/auth';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { lerCsv } from '@/lib/csv';
import { NIVEIS, type Nivel } from '@/lib/tipos';
import { emailDe, emailsDaEmpresa, enviarEmail } from '@/lib/email';

const texto = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? '').trim().slice(0, max);

async function exigirAdmin() {
  const sessao = await exigirPapel('admin');
  return { ...sessao, admin: criarClienteAdmin() };
}

// ------------------------------------------------------------ Avaliações
export async function atribuirAvaliador(form: FormData) {
  const { admin, user } = await exigirAdmin();
  const avId = texto(form, 'avaliacao_id', 40);
  const avaliadorId = texto(form, 'avaliador_id', 40);
  const volta = '/admin/avaliacoes';

  const { data: av } = await admin.from('avaliacoes').select('id, profissional_id, status, profissionais(empresa_atual_cnpj)').eq('id', avId).single();
  const { data: avaliador } = await admin.from('avaliadores').select('id, aprovado, empresa_atual_cnpj').eq('id', avaliadorId).single();
  if (!av || !avaliador?.aprovado) voltarCom(volta, 'erro', 'Avaliação ou avaliador inválido.');
  if (av.profissional_id === avaliador.id) voltarCom(volta, 'erro', 'O avaliador não pode avaliar a si mesmo.');

  // RN09 — conflito de interesse
  const cnpjProf = (av.profissionais as unknown as { empresa_atual_cnpj: string | null })?.empresa_atual_cnpj;
  if (cnpjProf && cnpjProf === avaliador.empresa_atual_cnpj)
    voltarCom(volta, 'erro', 'Conflito de interesse: avaliador e profissional trabalham na mesma empresa.');

  await admin.from('avaliacoes').update({ avaliador_id: avaliador.id }).eq('id', av.id);
  await registrarAuditoria(user.id, 'atribuir_avaliador', 'avaliacoes', av.id, { avaliador: avaliador.id });
  enviarEmail({
    para: await emailDe(avaliador.id),
    assunto: 'Nova avaliação atribuída a você',
    titulo: 'Você tem uma nova avaliação',
    paragrafos: ['Um profissional aguarda o agendamento da entrevista técnica. O caso prático já está disponível para leitura.'],
    botao: { texto: 'Abrir avaliação', caminho: `/avaliador/avaliacoes/${av.id}` },
  });
  enviarEmail({
    para: await emailDe(av.profissional_id),
    assunto: 'Um avaliador foi designado para você',
    titulo: 'Próxima etapa: entrevista técnica',
    paragrafos: ['Um avaliador especialista foi designado e vai agendar sua entrevista em breve. Você receberá data e link por e-mail.'],
    botao: { texto: 'Acompanhar avaliação', caminho: '/profissional/avaliacao' },
  });
  revalidatePath(volta);
  voltarCom(volta, 'ok', 'Avaliador atribuído.');
}

export async function marcarAvaliadorPago(form: FormData) {
  const { admin, user } = await exigirAdmin();
  const id = texto(form, 'avaliacao_id', 40);
  await admin.from('avaliacoes').update({ avaliador_pago_em: new Date().toISOString() }).eq('id', id).eq('status', 'concluida');
  await registrarAuditoria(user.id, 'pagar_avaliador', 'avaliacoes', id);
  voltarCom('/admin/avaliacoes?filtro=concluida', 'ok', 'Pagamento registrado.');
}

// ------------------------------------------------------------ Avaliadores
export async function promoverAvaliador(form: FormData) {
  const { admin, user } = await exigirAdmin();
  const volta = '/admin/pessoas';
  const email = texto(form, 'email', 200).toLowerCase();
  const valor = Math.round(Number(texto(form, 'valor', 20).replace(/\./g, '').replace(',', '.')) * 100) || 0;

  const { data: alvo } = await admin.from('perfis').select('id, papel').eq('email', email).maybeSingle();
  if (!alvo) voltarCom(volta, 'erro', 'Nenhuma conta com esse e-mail. Peça para a pessoa se cadastrar primeiro.');
  if (alvo.papel === 'admin') voltarCom(volta, 'erro', 'Esta conta é de administrador.');
  if (alvo.papel === 'empresa') voltarCom(volta, 'erro', 'Esta conta é de empresa. Use uma conta pessoal.');

  await admin.from('perfis').update({ papel: 'avaliador' }).eq('id', alvo.id);
  await admin.from('avaliadores').upsert({ id: alvo.id, aprovado: true, valor_avaliacao_centavos: valor });
  const { data: esp } = await admin.from('especialidades').select('id').eq('slug', 'totvs-rm').single();
  await admin.from('avaliador_especialidades').upsert({ avaliador_id: alvo.id, especialidade_id: esp!.id });
  await registrarAuditoria(user.id, 'promover_avaliador', 'perfis', alvo.id);
  enviarEmail({
    para: [email],
    assunto: 'Você agora é avaliador parceiro do Otto',
    titulo: 'Bem-vindo à equipe de avaliadores',
    paragrafos: [
      'Sua conta foi habilitada como avaliador parceiro. No próximo acesso, você vai configurar o login em duas etapas (obrigatório para avaliadores).',
      'As avaliações atribuídas a você aparecerão no seu painel.',
    ],
    botao: { texto: 'Acessar o painel', caminho: '/avaliador' },
  });
  revalidatePath(volta);
  voltarCom(volta, 'ok', `${email} agora é avaliador.`);
}

export async function alternarAvaliador(form: FormData) {
  const { admin, user } = await exigirAdmin();
  const id = texto(form, 'avaliador_id', 40);
  const aprovado = texto(form, 'aprovado', 5) === 'true';
  await admin.from('avaliadores').update({ aprovado }).eq('id', id);
  await registrarAuditoria(user.id, aprovado ? 'ativar_avaliador' : 'desativar_avaliador', 'avaliadores', id);
  voltarCom('/admin/pessoas', 'ok', aprovado ? 'Avaliador ativado.' : 'Avaliador desativado.');
}

// --------------------------------------------------------------- Questões
type QuestaoNova = {
  competencia_id: number; nivel: Nivel; enunciado: string;
  alternativas: { chave: string; texto: string }[]; resposta_correta: string; explicacao: string | null;
};

function montarQuestao(compId: number, nivel: string, enunciado: string, alts: string[], correta: string, explicacao: string): QuestaoNova | string {
  const chaves = ['A', 'B', 'C', 'D', 'E'];
  const alternativas = alts.map((t, i) => ({ chave: chaves[i], texto: t.trim() })).filter((a) => a.texto);
  const c = correta.trim().toUpperCase();
  if (!NIVEIS.includes(nivel as Nivel)) return `nível "${nivel}" inválido (use junior, pleno, senior ou especialista)`;
  if (enunciado.trim().length < 10) return 'enunciado muito curto';
  if (alternativas.length < 2) return 'mínimo de 2 alternativas';
  if (!alternativas.some((a) => a.chave === c)) return `resposta correta "${correta}" não corresponde a uma alternativa`;
  return { competencia_id: compId, nivel: nivel as Nivel, enunciado: enunciado.trim(), alternativas, resposta_correta: c, explicacao: explicacao.trim() || null };
}

export async function salvarQuestao(form: FormData) {
  const { admin, user } = await exigirAdmin();
  const volta = '/admin/questoes';
  const q = montarQuestao(
    Number(form.get('competencia_id')),
    texto(form, 'nivel', 20),
    texto(form, 'enunciado', 4000),
    ['A', 'B', 'C', 'D', 'E'].map((k) => texto(form, `alt_${k}`, 1000)),
    texto(form, 'correta', 1),
    texto(form, 'explicacao', 2000),
  );
  if (typeof q === 'string') voltarCom(volta, 'erro', `Questão inválida: ${q}.`);
  const { error } = await admin.from('questoes').insert({ ...q, criada_por: user.id });
  if (error) voltarCom(volta, 'erro', 'Não foi possível salvar a questão.');
  revalidatePath(volta);
  voltarCom(volta, 'ok', 'Questão adicionada ao banco.');
}

/** CSV: competencia;nivel;enunciado;A;B;C;D;E;correta;explicacao */
export async function importarQuestoes(form: FormData) {
  const { admin, user } = await exigirAdmin();
  const volta = '/admin/questoes';
  const arquivo = form.get('arquivo');
  if (!(arquivo instanceof File) || arquivo.size === 0) voltarCom(volta, 'erro', 'Escolha um arquivo CSV.');
  if (arquivo.size > 2 * 1024 * 1024) voltarCom(volta, 'erro', 'Arquivo muito grande (máximo 2 MB).');

  const linhas = lerCsv(await arquivo.text());
  if (linhas.length && /compet/i.test(linhas[0][0] ?? '')) linhas.shift(); // cabeçalho

  const { data: comps } = await admin.from('competencias').select('id, slug, nome');
  const porChave = new Map<string, number>();
  for (const c of comps ?? []) {
    porChave.set(c.slug.toLowerCase(), c.id);
    porChave.set(c.nome.toLowerCase(), c.id);
  }

  const validas: QuestaoNova[] = [];
  const erros: string[] = [];
  linhas.forEach((l, i) => {
    const [comp = '', nivel = '', enunciado = '', a = '', b = '', c = '', d = '', e = '', correta = '', explicacao = ''] = l;
    const compId = porChave.get(comp.toLowerCase());
    if (!compId) return erros.push(`linha ${i + 2}: competência "${comp}" não encontrada`);
    const q = montarQuestao(compId, nivel.toLowerCase(), enunciado, [a, b, c, d, e], correta, explicacao);
    if (typeof q === 'string') erros.push(`linha ${i + 2}: ${q}`);
    else validas.push(q);
  });

  if (erros.length) voltarCom(volta, 'erro', `Nada foi importado. Corrija: ${erros.slice(0, 5).join(' · ')}${erros.length > 5 ? ` (+${erros.length - 5})` : ''}`);
  if (!validas.length) voltarCom(volta, 'erro', 'Nenhuma questão encontrada no arquivo.');
  const { error } = await admin.from('questoes').insert(validas.map((q) => ({ ...q, criada_por: user.id })));
  if (error) voltarCom(volta, 'erro', 'Falha ao importar as questões.');
  await registrarAuditoria(user.id, 'importar_questoes', 'questoes', undefined, { quantidade: validas.length });
  revalidatePath(volta);
  voltarCom(volta, 'ok', `${validas.length} questões importadas.`);
}

export async function alternarQuestao(form: FormData) {
  const { admin } = await exigirAdmin();
  await admin.from('questoes').update({ ativa: texto(form, 'ativa', 5) === 'true' }).eq('id', texto(form, 'questao_id', 40));
  revalidatePath('/admin/questoes');
}

// -------------------------------------------------------------- Curadoria
export async function adicionarCandidato(form: FormData) {
  const { admin, user } = await exigirAdmin();
  const demandaId = texto(form, 'demanda_id', 40);
  const volta = `/admin/demandas/${demandaId}`;
  const { error } = await admin.from('indicacoes').insert({
    demanda_id: demandaId,
    profissional_id: texto(form, 'profissional_id', 40),
    observacao_curador: texto(form, 'observacao', 1000) || null,
  });
  if (error) voltarCom(volta, 'erro', 'Profissional já está nesta demanda.');
  await admin.from('demandas').update({ status: 'em_curadoria' }).eq('id', demandaId).eq('status', 'aberta');
  await registrarAuditoria(user.id, 'sugerir_candidato', 'demandas', demandaId);
  revalidatePath(volta);
  voltarCom(volta, 'ok', 'Candidato adicionado à shortlist (ainda não enviada).');
}

export async function removerCandidato(form: FormData) {
  const { admin } = await exigirAdmin();
  const demandaId = texto(form, 'demanda_id', 40);
  await admin.from('indicacoes').delete().eq('id', texto(form, 'indicacao_id', 40)).eq('status', 'sugerido');
  revalidatePath(`/admin/demandas/${demandaId}`);
  voltarCom(`/admin/demandas/${demandaId}`, 'ok', 'Candidato removido.');
}

export async function enviarShortlist(form: FormData) {
  const { admin, user } = await exigirAdmin();
  const demandaId = texto(form, 'demanda_id', 40);
  const volta = `/admin/demandas/${demandaId}`;

  const { data: dem } = await admin.from('demandas').select('id, empresa_id, modelo_cobranca, status').eq('id', demandaId).single();
  if (!dem || ['cancelada', 'encerrada'].includes(dem.status)) voltarCom(volta, 'erro', 'Demanda indisponível.');
  const { data: sugeridos } = await admin.from('indicacoes').select('id').eq('demanda_id', demandaId).eq('status', 'sugerido');
  if (!sugeridos?.length) voltarCom(volta, 'erro', 'Adicione candidatos antes de enviar.');

  // Cobrança (RN07): créditos são consumidos na PRIMEIRA shortlist da demanda
  const primeiraVez = dem.status !== 'shortlist_enviada';
  if (primeiraVez && dem.modelo_cobranca === 'creditos') {
    const { data: plano } = await admin.from('planos').select('creditos_por_shortlist').eq('tipo', 'creditos').eq('ativo', true).limit(1).maybeSingle();
    const custo = Number(plano?.creditos_por_shortlist ?? 1);
    const { data: movs } = await admin.from('movimentos_credito').select('quantidade').eq('empresa_id', dem.empresa_id);
    const saldo = (movs ?? []).reduce((s, m) => s + m.quantidade, 0);
    if (saldo < custo) voltarCom(volta, 'erro', `A empresa tem ${saldo} crédito(s); são necessários ${custo}. Adicione créditos em Empresas.`);
    await admin.from('movimentos_credito').insert({ empresa_id: dem.empresa_id, quantidade: -custo, motivo: 'Shortlist enviada', demanda_id: dem.id });
  }
  if (primeiraVez && dem.modelo_cobranca === 'assinatura') {
    const { data: ass } = await admin.from('assinaturas').select('id').eq('empresa_id', dem.empresa_id).eq('status', 'ativa').limit(1);
    if (!ass?.length) voltarCom(volta, 'erro', 'A empresa não tem assinatura ativa.');
  }

  await admin
    .from('indicacoes')
    .update({ status: 'enviado_empresa', enviada_em: new Date().toISOString() })
    .eq('demanda_id', demandaId)
    .eq('status', 'sugerido');
  await admin.from('demandas').update({ status: 'shortlist_enviada' }).eq('id', demandaId);
  await registrarAuditoria(user.id, 'enviar_shortlist', 'demandas', demandaId, { candidatos: sugeridos.length });
  enviarEmail({
    para: await emailsDaEmpresa(dem.empresa_id),
    assunto: 'Sua shortlist está pronta',
    titulo: 'Profissionais avaliados para a sua demanda',
    paragrafos: [
      `Selecionamos ${sugeridos.length} profissional(is) com selo Otto para a sua demanda.`,
      'Veja as notas por competência e o parecer técnico de cada um e solicite o contato de quem tiver interesse.',
    ],
    botao: { texto: 'Ver shortlist', caminho: `/empresa/demandas/${demandaId}` },
  });
  revalidatePath(volta);
  voltarCom(volta, 'ok', `Shortlist enviada com ${sugeridos.length} candidato(s).`);
}

export async function encerrarDemanda(form: FormData) {
  const { admin, user } = await exigirAdmin();
  const id = texto(form, 'demanda_id', 40);
  await admin.from('demandas').update({ status: 'encerrada' }).eq('id', id);
  await registrarAuditoria(user.id, 'encerrar_demanda', 'demandas', id);
  voltarCom(`/admin/demandas/${id}`, 'ok', 'Demanda encerrada.');
}

// --------------------------------------------------------------- Catálogo
const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export async function alternarAtivo(form: FormData) {
  const { admin, user } = await exigirAdmin();
  const tabela = texto(form, 'tabela', 30);
  if (!['areas', 'especialidades', 'competencias'].includes(tabela)) voltarCom('/admin/catalogo', 'erro', 'Tabela inválida.');
  const id = Number(form.get('id'));
  const ativa = texto(form, 'ativa', 5) === 'true';
  await admin.from(tabela).update({ ativa }).eq('id', id);
  await registrarAuditoria(user.id, ativa ? 'ativar' : 'desativar', tabela, String(id));
  revalidatePath('/admin/catalogo');
  voltarCom(`/admin/catalogo?${texto(form, 'volta_qs', 50)}`, 'ok', ativa ? 'Ativado.' : 'Desativado.');
}

export async function salvarEspecialidade(form: FormData) {
  const { admin, user } = await exigirAdmin();
  const id = Number(form.get('id')) || null;
  const nome = texto(form, 'nome', 100);
  const caso = texto(form, 'caso_pratico_padrao', 5000) || null;
  const volta = `/admin/catalogo${id ? `?esp=${id}` : ''}`;
  if (nome.length < 2) voltarCom(volta, 'erro', 'Informe o nome da especialidade.');

  if (id) {
    await admin.from('especialidades').update({ nome, caso_pratico_padrao: caso }).eq('id', id);
  } else {
    const areaId = Number(form.get('area_id'));
    const { data, error } = await admin
      .from('especialidades')
      .insert({ area_id: areaId, nome, slug: slugify(nome), caso_pratico_padrao: caso })
      .select('id')
      .single();
    if (error || !data) voltarCom(volta, 'erro', 'Já existe uma especialidade com esse nome.');
    // Toda especialidade nova ganha uma prova padrão (ajustável em Preços e provas)
    await admin.from('provas').insert({ especialidade_id: data.id, nome: `Prova técnica ${nome}` });
    await registrarAuditoria(user.id, 'criar_especialidade', 'especialidades', String(data.id));
    voltarCom(`/admin/catalogo?esp=${data.id}`, 'ok', 'Especialidade criada.');
  }
  await registrarAuditoria(user.id, 'editar_especialidade', 'especialidades', String(id));
  revalidatePath('/admin/catalogo');
  voltarCom(volta, 'ok', 'Especialidade salva.');
}

export async function salvarCompetencia(form: FormData) {
  const { admin, user } = await exigirAdmin();
  const id = Number(form.get('id')) || null;
  const espId = Number(form.get('especialidade_id'));
  const nome = texto(form, 'nome', 120);
  const descricao = texto(form, 'descricao', 500) || null;
  const volta = `/admin/catalogo?esp=${espId}`;
  if (nome.length < 2) voltarCom(volta, 'erro', 'Informe o nome da competência.');

  const { error } = id
    ? await admin.from('competencias').update({ nome, descricao }).eq('id', id)
    : await admin.from('competencias').insert({ especialidade_id: espId, nome, descricao, slug: slugify(texto(form, 'slug', 60) || nome) });
  if (error) voltarCom(volta, 'erro', 'Não foi possível salvar (o código já existe nesta especialidade?).');
  await registrarAuditoria(user.id, id ? 'editar_competencia' : 'criar_competencia', 'competencias', id ? String(id) : nome);
  revalidatePath('/admin/catalogo');
  voltarCom(volta, 'ok', 'Competência salva.');
}

// --------------------------------------------------------- Provas e preços
export async function salvarProva(form: FormData) {
  const { admin, user } = await exigirAdmin();
  const volta = '/admin/configuracoes';
  const n = (k: string, min: number, max: number) => {
    const v = Number(String(form.get(k) ?? '').replace(',', '.'));
    return Number.isFinite(v) && v >= min && v <= max ? v : null;
  };
  const dados = {
    num_questoes: n('num_questoes', 1, 200),
    tempo_limite_min: n('tempo_limite_min', 5, 480),
    nota_minima: n('nota_minima', 0, 100),
    dias_para_refazer: n('dias_para_refazer', 0, 365),
    ativa: form.get('ativa') === 'on',
  };
  if (Object.values(dados).some((v) => v === null)) voltarCom(volta, 'erro', 'Valores fora do intervalo permitido.');
  const id = Number(form.get('id'));
  await admin.from('provas').update(dados).eq('id', id);
  await registrarAuditoria(user.id, 'editar_prova', 'provas', String(id), dados);
  revalidatePath(volta);
  voltarCom(volta, 'ok', 'Configuração da prova salva.');
}

export async function salvarPlano(form: FormData) {
  const { admin, user } = await exigirAdmin();
  const volta = '/admin/configuracoes';
  const num = (k: string) => Number(String(form.get(k) ?? '0').replace(/\./g, '').replace(',', '.'));
  const preco = Math.round(num('preco') * 100);
  const pct = num('success_fee_percentual');
  const inclusos = Math.trunc(num('creditos_inclusos'));
  const porShortlist = Math.trunc(num('creditos_por_shortlist'));
  if (![preco, pct, inclusos, porShortlist].every((v) => Number.isFinite(v) && v >= 0) || pct > 100)
    voltarCom(volta, 'erro', 'Valores inválidos no plano.');
  const dados = {
    nome: texto(form, 'nome', 80),
    preco_centavos: preco,
    creditos_inclusos: inclusos,
    creditos_por_shortlist: porShortlist,
    success_fee_percentual: pct,
    ativo: form.get('ativo') === 'on',
  };
  const id = Number(form.get('id')) || null;
  if (id) await admin.from('planos').update(dados).eq('id', id);
  else {
    const tipo = texto(form, 'tipo', 20);
    if (!['assinatura', 'creditos', 'success_fee'].includes(tipo)) voltarCom(volta, 'erro', 'Tipo de plano inválido.');
    if (dados.nome.length < 2) voltarCom(volta, 'erro', 'Dê um nome ao plano.');
    await admin.from('planos').insert({ ...dados, tipo });
  }
  await registrarAuditoria(user.id, id ? 'editar_plano' : 'criar_plano', 'planos', id ? String(id) : dados.nome, dados);
  revalidatePath(volta);
  voltarCom(volta, 'ok', 'Plano salvo.');
}

// -------------------------------------------------------------- Empresas
export async function adicionarCreditos(form: FormData) {
  const { admin, user } = await exigirAdmin();
  const empresaId = texto(form, 'empresa_id', 40);
  const qtd = Math.trunc(Number(form.get('quantidade')));
  if (!qtd || Math.abs(qtd) > 1000) voltarCom('/admin/empresas', 'erro', 'Quantidade inválida.');
  await admin.from('movimentos_credito').insert({ empresa_id: empresaId, quantidade: qtd, motivo: texto(form, 'motivo', 200) || 'Ajuste manual' });
  await registrarAuditoria(user.id, 'ajustar_creditos', 'empresas', empresaId, { qtd });
  voltarCom('/admin/empresas', 'ok', 'Créditos atualizados.');
}

export async function definirAssinatura(form: FormData) {
  const { admin, user } = await exigirAdmin();
  const empresaId = texto(form, 'empresa_id', 40);
  const planoId = Number(form.get('plano_id'));
  await admin.from('assinaturas').update({ status: 'cancelada', fim: new Date().toISOString().slice(0, 10) }).eq('empresa_id', empresaId).eq('status', 'ativa');
  if (planoId) await admin.from('assinaturas').insert({ empresa_id: empresaId, plano_id: planoId });
  await registrarAuditoria(user.id, 'definir_assinatura', 'empresas', empresaId, { planoId });
  voltarCom('/admin/empresas', 'ok', planoId ? 'Assinatura ativada.' : 'Assinatura cancelada.');
}
