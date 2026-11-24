import 'server-only';
import { redirect } from 'next/navigation';
import { criarClienteServidor, supabaseConfigurado } from './supabase/server';
import { criarClienteAdmin } from './supabase/admin';
import type { Papel, Perfil } from './tipos';

export function rotaInicial(papel: Papel) {
  return { profissional: '/profissional', empresa: '/empresa', avaliador: '/avaliador', admin: '/admin' }[papel];
}

export async function obterSessao() {
  if (!supabaseConfigurado()) return null;
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from('perfis').select('id, papel, nome, email, telefone').eq('id', user.id).single();
  if (!perfil) return null;
  return { supabase, user, perfil: perfil as Perfil };
}

/** Papéis que acessam dados de terceiros: login em duas etapas obrigatório. */
export const MFA_OBRIGATORIO: Papel[] = ['admin', 'empresa', 'avaliador'];
export const TODOS_PAPEIS: Papel[] = ['profissional', 'empresa', 'avaliador', 'admin'];

type Sessao = NonNullable<Awaited<ReturnType<typeof obterSessao>>>;

/** Situação do login em duas etapas da sessão atual. */
export async function situacaoMfa(sessao: Sessao) {
  const { data } = await sessao.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const temFator = data?.nextLevel === 'aal2';
  return {
    verificado: data?.currentLevel === 'aal2',
    temFator,
    obrigatorio: MFA_OBRIGATORIO.includes(sessao.perfil.papel),
  };
}

/** Garante usuário logado, com um dos papéis e com a 2ª etapa quando exigida. */
export async function exigirPapel(...papeis: Papel[]) {
  const sessao = await obterSessao();
  if (!sessao) redirect('/entrar');
  if (!papeis.includes(sessao.perfil.papel)) redirect(rotaInicial(sessao.perfil.papel));
  const mfa = await situacaoMfa(sessao);
  if ((mfa.obrigatorio || mfa.temFator) && !mfa.verificado) {
    redirect(mfa.temFator ? '/seguranca/verificar' : '/seguranca/mfa');
  }
  return sessao;
}

/** Empresa do usuário logado (primeira associação). */
export async function obterEmpresaDoUsuario(userId: string) {
  const admin = criarClienteAdmin();
  const { data } = await admin
    .from('membros_empresa')
    .select('papel, empresas(id, cnpj, razao_social, nome_fantasia)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (!data?.empresas) return null;
  const empresa = data.empresas as unknown as { id: string; cnpj: string; razao_social: string; nome_fantasia: string | null };
  return { ...empresa, papelMembro: data.papel as 'admin' | 'usuario' };
}

export async function registrarAuditoria(
  userId: string | null,
  acao: string,
  entidade: string,
  entidadeId?: string,
  detalhes?: Record<string, unknown>,
) {
  const admin = criarClienteAdmin();
  await admin.from('logs_auditoria').insert({ user_id: userId, acao, entidade, entidade_id: entidadeId, detalhes });
}

/** Redireciona com mensagem de erro/sucesso na URL (lida por <Aviso />). */
export function voltarCom(caminho: string, tipo: 'erro' | 'ok', mensagem: string): never {
  const sep = caminho.includes('?') ? '&' : '?';
  redirect(`${caminho}${sep}${tipo}=${encodeURIComponent(mensagem)}`);
}
