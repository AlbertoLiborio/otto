'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { criarClienteServidor } from '@/lib/supabase/server';
import { rotaInicial, voltarCom } from '@/lib/auth';
import { VERSAO_TERMOS, type Papel } from '@/lib/tipos';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const texto = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

function destinoSeguro(v: string) {
  return v.startsWith('/') && !v.startsWith('//') ? v : null;
}

export async function entrar(form: FormData) {
  const email = texto(form, 'email').toLowerCase();
  const senha = String(form.get('senha') ?? '');
  const voltar = destinoSeguro(texto(form, 'voltar'));
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error || !data.user) voltarCom('/entrar', 'erro', 'E-mail ou senha incorretos, ou e-mail ainda não confirmado.');
  const { data: perfil } = await supabase.from('perfis').select('papel').eq('id', data.user.id).single();
  redirect(voltar ?? rotaInicial((perfil?.papel ?? 'profissional') as Papel));
}

export async function entrarComLink(form: FormData) {
  const email = texto(form, 'email').toLowerCase();
  const supabase = await criarClienteServidor();
  await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${SITE}/auth/callback` },
  });
  // Mesma resposta exista ou não a conta (não revela quem é cadastrado)
  voltarCom('/entrar', 'ok', 'Se o e-mail estiver cadastrado, você receberá um link de acesso em instantes.');
}

export async function recuperarSenha(form: FormData) {
  const email = texto(form, 'email').toLowerCase();
  const supabase = await criarClienteServidor();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${SITE}/auth/callback?proximo=/seguranca/senha` });
  // Mesma resposta exista ou não a conta
  voltarCom('/recuperar-senha', 'ok', 'Se o e-mail estiver cadastrado, você receberá o link em instantes. Confira também o spam.');
}

export async function entrarComLinkedIn() {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'linkedin_oidc',
    options: { redirectTo: `${SITE}/auth/callback` },
  });
  if (error || !data.url) voltarCom('/entrar', 'erro', 'Login com LinkedIn indisponível no momento.');
  redirect(data.url);
}

export async function cadastrar(form: FormData) {
  const nome = texto(form, 'nome');
  const email = texto(form, 'email').toLowerCase();
  const senha = String(form.get('senha') ?? '');
  const papel = texto(form, 'papel') === 'empresa' ? 'empresa' : 'profissional';
  const termos = form.get('termos') === 'on';
  const ofertas = form.get('ofertas') === 'on';
  const volta = `/cadastro?tipo=${papel}`;

  if (nome.length < 3) voltarCom(volta, 'erro', 'Informe seu nome completo.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) voltarCom(volta, 'erro', 'E-mail inválido.');
  if (senha.length < 10) voltarCom(volta, 'erro', 'A senha precisa ter pelo menos 10 caracteres.');
  if (!termos) voltarCom(volta, 'erro', 'É preciso aceitar os Termos de Uso e a Política de Privacidade.');
  if (papel === 'profissional' && !ofertas)
    voltarCom(volta, 'erro', 'O cadastro gratuito de profissionais inclui o recebimento de ofertas de treinamento.');

  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      emailRedirectTo: `${SITE}/auth/callback`,
      data: {
        nome,
        papel,
        ip,
        consentimentos: { versao: VERSAO_TERMOS, termos_uso: true, ofertas_treinamento: papel === 'profissional' ? ofertas : null },
      },
    },
  });
  if (error) {
    const msg = /password/i.test(error.message)
      ? 'Senha fraca: use letras, números e símbolos.'
      : 'Não foi possível criar a conta. Tente novamente.';
    voltarCom(volta, 'erro', msg);
  }
  voltarCom('/entrar', 'ok', 'Conta criada! Enviamos um e-mail de confirmação. Clique no link para ativar seu acesso.');
}
