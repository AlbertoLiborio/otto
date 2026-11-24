'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { obterSessao, registrarAuditoria, rotaInicial, voltarCom } from '@/lib/auth';
import { VERSAO_TERMOS } from '@/lib/tipos';

async function sessaoOuLogin() {
  const sessao = await obterSessao();
  if (!sessao) redirect('/entrar');
  return sessao;
}

// ------------------------------------------------------------- Senha
export async function definirSenha(form: FormData) {
  const { supabase, user, perfil } = await sessaoOuLogin();
  const volta = '/seguranca/senha';
  const senha = String(form.get('senha') ?? '');
  if (senha.length < 10) voltarCom(volta, 'erro', 'A senha precisa ter pelo menos 10 caracteres.');
  if (senha !== String(form.get('confirmacao') ?? '')) voltarCom(volta, 'erro', 'As senhas não conferem.');

  // Usuários convidados ainda não aceitaram os termos
  const { data: termos } = await supabase
    .from('vw_consentimentos_atuais')
    .select('aceito')
    .eq('user_id', user.id)
    .eq('tipo', 'termos_uso')
    .maybeSingle();
  if (!termos?.aceito) {
    if (form.get('termos') !== 'on') voltarCom(volta, 'erro', 'É preciso aceitar os Termos de Uso e a Política de Privacidade.');
    const h = await headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    await supabase.from('consentimentos').insert([
      { user_id: user.id, tipo: 'termos_uso', versao: VERSAO_TERMOS, aceito: true, ip },
      { user_id: user.id, tipo: 'privacidade', versao: VERSAO_TERMOS, aceito: true, ip },
    ]);
  }

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    voltarCom(volta, 'erro', /reauth|recent/i.test(error.message)
      ? 'Por segurança, saia e entre de novo antes de trocar a senha.'
      : 'Não foi possível salvar a senha. Use letras, números e símbolos.');
  }
  await registrarAuditoria(user.id, 'definir_senha', 'perfis', user.id);
  redirect(`${rotaInicial(perfil.papel)}?ok=${encodeURIComponent('Senha salva.')}`);
}

// ------------------------------------------------- MFA: cadastro do app
export type EstadoCadastroMfa = { fatorId?: string; qr?: string; segredo?: string; erro?: string };

export async function iniciarCadastroMfa(_: EstadoCadastroMfa): Promise<EstadoCadastroMfa> {
  const { supabase } = await sessaoOuLogin();
  const { data: fatores } = await supabase.auth.mfa.listFactors();
  // Remove tentativas anteriores não concluídas
  for (const f of fatores?.all ?? []) {
    if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'Otto',
    friendlyName: `Autenticador ${new Date().toISOString().slice(0, 16)}`,
  });
  if (error || !data) return { erro: 'Não foi possível gerar o QR Code. Tente novamente.' };
  return { fatorId: data.id, qr: data.totp.qr_code, segredo: data.totp.secret };
}

export async function confirmarCadastroMfa(form: FormData) {
  const { supabase, user, perfil } = await sessaoOuLogin();
  const fatorId = String(form.get('fator_id') ?? '');
  const codigo = String(form.get('codigo') ?? '').replace(/\D/g, '');
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fatorId, code: codigo });
  if (error) voltarCom('/seguranca/mfa', 'erro', 'Código incorreto ou expirado. Gere um novo QR Code e tente de novo.');
  await registrarAuditoria(user.id, 'ativar_mfa', 'perfis', user.id);
  redirect(`${rotaInicial(perfil.papel)}?ok=${encodeURIComponent('Login em duas etapas ativado.')}`);
}

// ------------------------------------------ MFA: verificação no login
export async function verificarMfa(form: FormData) {
  const { supabase, user, perfil } = await sessaoOuLogin();
  const codigo = String(form.get('codigo') ?? '').replace(/\D/g, '');
  const { data: fatores } = await supabase.auth.mfa.listFactors();
  const fator = fatores?.totp?.[0];
  if (!fator) redirect('/seguranca/mfa');
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo });
  if (error) {
    await registrarAuditoria(user.id, 'mfa_falhou', 'perfis', user.id);
    voltarCom('/seguranca/verificar', 'erro', 'Código incorreto. Confira o horário do celular e tente de novo.');
  }
  redirect(form.get('proximo') === 'senha' ? '/seguranca/senha' : rotaInicial(perfil.papel));
}
