'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { exigirPapel, registrarAuditoria, TODOS_PAPEIS, voltarCom } from '@/lib/auth';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { VERSAO_TERMOS } from '@/lib/tipos';

export async function alterarOfertas(form: FormData) {
  const { supabase, user } = await exigirPapel(...TODOS_PAPEIS);
  const aceito = form.get('aceito') === 'true';
  const h = await headers();
  await supabase.from('consentimentos').insert({
    user_id: user.id,
    tipo: 'ofertas_treinamento',
    versao: VERSAO_TERMOS,
    aceito,
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  });
  voltarCom('/conta', 'ok', aceito ? 'Você voltará a receber ofertas de treinamento.' : 'Você não receberá mais ofertas de treinamento.');
}

export async function desativarMfa() {
  const { supabase, user, perfil } = await exigirPapel(...TODOS_PAPEIS); // exige 2ª etapa verificada
  if (perfil.papel !== 'profissional') voltarCom('/conta', 'erro', 'Para o seu perfil o login em duas etapas é obrigatório.');
  const { data } = await supabase.auth.mfa.listFactors();
  for (const f of data?.all ?? []) await supabase.auth.mfa.unenroll({ factorId: f.id });
  await supabase.auth.refreshSession();
  await registrarAuditoria(user.id, 'desativar_mfa', 'perfis', user.id);
  voltarCom('/conta', 'ok', 'Login em duas etapas desativado.');
}

export async function excluirConta(form: FormData) {
  const { supabase, user, perfil } = await exigirPapel(...TODOS_PAPEIS);
  if (String(form.get('confirmacao') ?? '').trim().toUpperCase() !== 'EXCLUIR')
    voltarCom('/conta', 'erro', 'Digite EXCLUIR para confirmar.');
  if (perfil.papel === 'admin') voltarCom('/conta', 'erro', 'Contas de administrador não podem ser excluídas por aqui.');

  const admin = criarClienteAdmin();

  // Arquivos pessoais (currículo e casos práticos)
  const arquivos = [`curriculos/${user.id}.pdf`];
  const { data: avs } = await admin.from('avaliacoes').select('id, caso_pratico_path').eq('profissional_id', user.id);
  for (const a of avs ?? []) if (a.caso_pratico_path) arquivos.push(a.caso_pratico_path);
  await admin.storage.from('documentos').remove(arquivos);

  // Registro mínimo para prestação de contas (sem dados pessoais)
  await registrarAuditoria(null, 'excluir_conta', 'perfis', user.id, { papel: perfil.papel });

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) voltarCom('/conta', 'erro', 'Não foi possível excluir a conta. Fale com o suporte.');
  await supabase.auth.signOut();
  redirect(`/entrar?ok=${encodeURIComponent('Sua conta e seus dados pessoais foram excluídos.')}`);
}
