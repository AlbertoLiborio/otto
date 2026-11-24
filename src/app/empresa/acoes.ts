'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { exigirPapel, obterEmpresaDoUsuario, registrarAuditoria, voltarCom } from '@/lib/auth';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { paraCentavos, validarCnpj } from '@/lib/regras';
import { NIVEIS, UFS, type Nivel } from '@/lib/tipos';
import { emailDe, emailsDosAdmins, enviarEmail } from '@/lib/email';

const texto = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? '').trim().slice(0, max);

async function exigirEmpresa() {
  const sessao = await exigirPapel('empresa');
  const empresa = await obterEmpresaDoUsuario(sessao.user.id);
  if (!empresa) redirect('/empresa/cadastro');
  return { ...sessao, empresa };
}

export async function cadastrarEmpresa(form: FormData) {
  const { user } = await exigirPapel('empresa');
  const volta = '/empresa/cadastro';
  if (await obterEmpresaDoUsuario(user.id)) redirect('/empresa');

  const cnpj = validarCnpj(texto(form, 'cnpj', 20));
  const razao = texto(form, 'razao_social', 200);
  if (!cnpj) voltarCom(volta, 'erro', 'CNPJ inválido.');
  if (razao.length < 3) voltarCom(volta, 'erro', 'Informe a razão social.');

  const admin = criarClienteAdmin();
  const { data: existente } = await admin.from('empresas').select('id').eq('cnpj', cnpj).maybeSingle();
  if (existente) voltarCom(volta, 'erro', 'Esta empresa já está cadastrada. Peça ao responsável para incluir você como usuário.');

  const { data: empresa, error } = await admin
    .from('empresas')
    .insert({ cnpj, razao_social: razao, nome_fantasia: texto(form, 'nome_fantasia', 200) || null, segmento: texto(form, 'segmento', 100) || null })
    .select('id')
    .single();
  if (error || !empresa) voltarCom(volta, 'erro', 'Não foi possível cadastrar a empresa.');
  await admin.from('membros_empresa').insert({ empresa_id: empresa.id, user_id: user.id, papel: 'admin' });
  await registrarAuditoria(user.id, 'cadastrar_empresa', 'empresas', empresa.id);
  redirect('/empresa');
}

export async function criarDemanda(form: FormData) {
  const { supabase, user, empresa } = await exigirEmpresa();
  const volta = '/empresa/demandas/nova';

  const titulo = texto(form, 'titulo', 150);
  const vinculo = texto(form, 'vinculo', 20);
  const modalidade = texto(form, 'modalidade', 20);
  const modelo = texto(form, 'modelo_cobranca', 20);
  const nivelMin = texto(form, 'nivel_minimo', 20) as Nivel;
  const uf = texto(form, 'uf', 2).toUpperCase();
  const comps = form.getAll('competencia').map(Number).filter(Number.isInteger);

  if (titulo.length < 5) voltarCom(volta, 'erro', 'Dê um título para a demanda.');
  if (!['clt', 'pj', 'freelance'].includes(vinculo)) voltarCom(volta, 'erro', 'Escolha o tipo de vínculo.');
  if (!['remoto', 'presencial', 'hibrido'].includes(modalidade)) voltarCom(volta, 'erro', 'Escolha a modalidade.');
  if (!['assinatura', 'creditos', 'success_fee'].includes(modelo)) voltarCom(volta, 'erro', 'Escolha a forma de cobrança.');
  if (!NIVEIS.includes(nivelMin)) voltarCom(volta, 'erro', 'Nível inválido.');
  if (uf && !UFS.includes(uf)) voltarCom(volta, 'erro', 'UF inválida.');
  if (comps.length === 0) voltarCom(volta, 'erro', 'Selecione ao menos uma competência.');

  const { data: esp } = await supabase.from('especialidades').select('id').eq('slug', 'totvs-rm').single();
  const { data: demanda, error } = await supabase
    .from('demandas')
    .insert({
      empresa_id: empresa.id,
      criada_por: user.id,
      titulo,
      especialidade_id: esp!.id,
      vinculo,
      modalidade,
      nivel_minimo: nivelMin,
      cidade: texto(form, 'cidade', 80) || null,
      uf: uf || null,
      valor_min_centavos: paraCentavos(form.get('valor_min')),
      valor_max_centavos: paraCentavos(form.get('valor_max')),
      descricao: texto(form, 'descricao', 5000) || null,
      modelo_cobranca: modelo,
    })
    .select('id')
    .single();
  if (error || !demanda) voltarCom(volta, 'erro', 'Não foi possível criar a demanda.');

  await supabase.from('demanda_competencias').insert(
    comps.map((id) => ({
      demanda_id: demanda.id,
      competencia_id: id,
      nivel_minimo: nivelMin,
      obrigatoria: form.get(`obrig_${id}`) === 'on',
    })),
  );
  enviarEmail({
    para: await emailsDosAdmins(),
    assunto: `Nova demanda: ${titulo}`,
    titulo: 'Nova demanda para curadoria',
    paragrafos: [`${empresa.nome_fantasia || empresa.razao_social} abriu a demanda "${titulo}" (${vinculo.toUpperCase()}, cobrança: ${modelo}).`],
    botao: { texto: 'Fazer curadoria', caminho: `/admin/demandas/${demanda.id}` },
  });
  revalidatePath('/empresa');
  voltarCom(`/empresa/demandas/${demanda.id}`, 'ok', 'Demanda criada! Nossa curadoria já está buscando os melhores perfis.');
}

export async function cancelarDemanda(form: FormData) {
  const { supabase } = await exigirEmpresa();
  const id = texto(form, 'demanda_id', 40);
  await supabase.from('demandas').update({ status: 'cancelada' }).eq('id', id).eq('status', 'aberta');
  revalidatePath('/empresa');
  voltarCom(`/empresa/demandas/${id}`, 'ok', 'Demanda cancelada.');
}

// ----------------------------------------------------------------- Equipe
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export async function convidarMembro(form: FormData) {
  const { user, empresa } = await exigirEmpresa();
  const volta = '/empresa/equipe';
  if (empresa.papelMembro !== 'admin') voltarCom(volta, 'erro', 'Somente administradores da empresa podem convidar.');

  const email = texto(form, 'email', 200).toLowerCase();
  const nome = texto(form, 'nome', 120);
  const papel = texto(form, 'papel', 10) === 'admin' ? 'admin' : 'usuario';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) voltarCom(volta, 'erro', 'E-mail inválido.');
  if (nome.length < 3) voltarCom(volta, 'erro', 'Informe o nome da pessoa.');

  const admin = criarClienteAdmin();
  const { data: existente } = await admin.from('perfis').select('id, papel').eq('email', email).maybeSingle();
  let novoId: string;

  if (existente) {
    if (existente.papel !== 'empresa')
      voltarCom(volta, 'erro', 'Este e-mail já é usado por uma conta de profissional ou avaliador. Use outro e-mail corporativo.');
    const { data: jaMembro } = await admin.from('membros_empresa').select('empresa_id').eq('user_id', existente.id).limit(1);
    if (jaMembro?.length) voltarCom(volta, 'erro', 'Esta pessoa já faz parte de uma empresa no Otto.');
    novoId = existente.id;
    enviarEmail({
      para: [email],
      assunto: `Você foi adicionado à equipe ${empresa.nome_fantasia || empresa.razao_social}`,
      titulo: 'Novo acesso no Otto',
      paragrafos: [`Você agora faz parte da equipe ${empresa.nome_fantasia || empresa.razao_social} e pode acompanhar as demandas e shortlists.`],
      botao: { texto: 'Acessar', caminho: '/empresa' },
    });
  } else {
    // O Supabase envia o e-mail de convite; o link leva para "definir senha"
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome, papel: 'empresa' },
      redirectTo: `${SITE}/auth/callback?proximo=/seguranca/senha`,
    });
    if (error || !data.user) voltarCom(volta, 'erro', 'Não foi possível enviar o convite. Tente novamente.');
    novoId = data.user.id;
  }

  const { error } = await admin.from('membros_empresa').insert({ empresa_id: empresa.id, user_id: novoId, papel });
  if (error) voltarCom(volta, 'erro', 'Não foi possível adicionar a pessoa à equipe.');
  await registrarAuditoria(user.id, 'convidar_membro', 'empresas', empresa.id, { papel });
  revalidatePath(volta);
  voltarCom(volta, 'ok', existente ? `${email} foi adicionado à equipe.` : `Convite enviado para ${email}.`);
}

export async function removerMembro(form: FormData) {
  const { user, empresa } = await exigirEmpresa();
  const volta = '/empresa/equipe';
  const alvo = texto(form, 'user_id', 40);
  if (empresa.papelMembro !== 'admin') voltarCom(volta, 'erro', 'Somente administradores da empresa podem remover pessoas.');
  if (alvo === user.id) voltarCom(volta, 'erro', 'Você não pode remover a si mesmo.');
  await criarClienteAdmin().from('membros_empresa').delete().eq('empresa_id', empresa.id).eq('user_id', alvo);
  await registrarAuditoria(user.id, 'remover_membro', 'empresas', empresa.id, { removido: alvo });
  revalidatePath(volta);
  voltarCom(volta, 'ok', 'Pessoa removida da equipe.');
}

/** Lê a indicação pelo RLS (garante que pertence à empresa do usuário). */
async function indicacaoDaEmpresa(id: string) {
  const sessao = await exigirEmpresa();
  const { data: ind } = await sessao.supabase.from('indicacoes').select('id, status, demanda_id, profissional_id').eq('id', id).maybeSingle();
  return { ...sessao, ind };
}

export async function solicitarContato(form: FormData) {
  const { user, ind } = await indicacaoDaEmpresa(texto(form, 'indicacao_id', 40));
  if (!ind || ind.status !== 'enviado_empresa') voltarCom('/empresa', 'erro', 'Indicação não encontrada.');
  await criarClienteAdmin().from('indicacoes').update({ status: 'contato_solicitado' }).eq('id', ind.id);
  await registrarAuditoria(user.id, 'solicitar_contato', 'indicacoes', ind.id);
  enviarEmail({
    para: await emailDe(ind.profissional_id),
    assunto: 'Uma empresa quer falar com você',
    titulo: 'Você tem um convite no Otto',
    paragrafos: [
      'Uma empresa que recebeu seu perfil técnico quer conversar com você.',
      'Veja os detalhes da oportunidade e decida se quer liberar seu contato. Sem o seu aceite, seus dados continuam ocultos.',
    ],
    botao: { texto: 'Ver convite', caminho: '/profissional/convites' },
  });
  voltarCom(`/empresa/demandas/${ind.demanda_id}`, 'ok', 'Solicitação enviada. Avisaremos quando o profissional aceitar.');
}

export async function registrarResultado(form: FormData) {
  const { user, empresa, ind } = await indicacaoDaEmpresa(texto(form, 'indicacao_id', 40));
  if (!ind || ind.status !== 'aceito_profissional') voltarCom('/empresa', 'erro', 'Indicação não encontrada.');
  const volta = `/empresa/demandas/${ind.demanda_id}`;
  const contratado = texto(form, 'resultado', 20) === 'contratado';
  const valor = paraCentavos(form.get('valor'));
  const nota = Number(form.get('feedback_nota'));
  if (contratado && !valor) voltarCom(volta, 'erro', 'Informe o valor do salário ou do contrato para registrar a contratação.');

  const admin = criarClienteAdmin();
  const agora = new Date().toISOString();
  await admin
    .from('indicacoes')
    .update({
      status: contratado ? 'contratado' : 'nao_selecionado',
      contratado_em: contratado ? agora : null,
      valor_contratacao_centavos: contratado ? valor : null,
      feedback_nota: nota >= 1 && nota <= 5 ? nota : null,
      feedback_comentario: texto(form, 'feedback_comentario', 1000) || null,
    })
    .eq('id', ind.id);

  // RN08 — success fee
  if (contratado && valor) {
    const { data: dem } = await admin.from('demandas').select('modelo_cobranca').eq('id', ind.demanda_id).single();
    if (dem?.modelo_cobranca === 'success_fee') {
      const { data: plano } = await admin.from('planos').select('success_fee_percentual').eq('tipo', 'success_fee').eq('ativo', true).limit(1).maybeSingle();
      const pct = Number(plano?.success_fee_percentual ?? 0);
      if (pct > 0) {
        const venc = new Date();
        venc.setDate(venc.getDate() + 15);
        await admin.from('cobrancas').insert({
          empresa_id: empresa.id,
          tipo: 'success_fee',
          indicacao_id: ind.id,
          valor_centavos: Math.round((valor * pct) / 100),
          vencimento: venc.toISOString().slice(0, 10),
        });
      }
    }
  }
  await registrarAuditoria(user.id, contratado ? 'registrar_contratacao' : 'registrar_nao_selecionado', 'indicacoes', ind.id, { valor });
  if (contratado) {
    enviarEmail({
      para: await emailsDosAdmins(),
      assunto: `Contratação registrada: ${empresa.nome_fantasia || empresa.razao_social}`,
      titulo: 'Uma indicação virou contratação',
      paragrafos: [`${empresa.nome_fantasia || empresa.razao_social} registrou a contratação de um indicado.`],
      botao: { texto: 'Ver demanda', caminho: `/admin/demandas/${ind.demanda_id}` },
    });
  }
  voltarCom(volta, 'ok', contratado ? 'Contratação registrada. Parabéns!' : 'Resultado registrado. Obrigado pelo retorno!');
}
