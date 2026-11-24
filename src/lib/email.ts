import 'server-only';
import { after } from 'next/server';
import { criarClienteAdmin } from './supabase/admin';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Layout único dos e-mails do Otto. Todo texto é escapado (sem HTML vindo de usuários). */
function modelo(titulo: string, paragrafos: string[], botao?: { texto: string; caminho: string }) {
  const corpo = paragrafos.map((p) => `<p style="margin:0 0 14px;line-height:1.55;white-space:pre-line">${esc(p)}</p>`).join('');
  const cta = botao
    ? `<p style="margin:24px 0"><a href="${esc(SITE + botao.caminho)}" style="background:#13223a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${esc(botao.texto)}</a></p>`
    : '';
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f6f4ef;font-family:Arial,Helvetica,sans-serif;color:#13223a">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="font-size:26px;font-weight:700;margin:0 0 24px;font-family:Georgia,serif">otto<span style="color:#d9892b">.</span></p>
<div style="background:#fff;border:1px solid #e3dfd5;border-radius:14px;padding:28px">
<h1 style="font-size:20px;margin:0 0 16px">${esc(titulo)}</h1>${corpo}${cta}</div>
<p style="font-size:12px;color:#6b7280;margin-top:20px">Você recebeu este e-mail porque tem uma conta no Otto. Gerencie suas preferências em ${esc(SITE)}/conta.</p>
</div></body></html>`;
}

export type Mensagem = {
  para: string[];
  assunto: string;
  titulo: string;
  paragrafos: string[];
  botao?: { texto: string; caminho: string };
};

async function enviarAgora(m: Mensagem) {
  const chave = process.env.RESEND_API_KEY;
  const para = [...new Set(m.para.filter(Boolean))];
  if (!para.length) return;
  if (!chave) {
    console.info(`[email desativado] "${m.assunto}" para ${para.length} destinatário(s)`);
    return;
  }
  const html = modelo(m.titulo, m.paragrafos, m.botao);
  // Um envio por pessoa: ninguém vê o endereço de outro destinatário
  for (const destinatario of para) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.EMAIL_REMETENTE ?? 'Otto <onboarding@resend.dev>',
          to: [destinatario],
          subject: m.assunto,
          html,
        }),
      });
      if (!r.ok) console.error(`[email] falha ${r.status} ao enviar "${m.assunto}"`);
    } catch (e) {
      console.error('[email] erro de rede', e);
    }
  }
}

/** Envia depois da resposta: não atrasa a tela e uma falha de e-mail não desfaz a ação. */
export function enviarEmail(m: Mensagem) {
  after(() => enviarAgora(m));
}

// ------------------------------------------------------- Destinatários
export async function emailDe(userId: string | null | undefined) {
  if (!userId) return [];
  const { data } = await criarClienteAdmin().from('perfis').select('email').eq('id', userId).maybeSingle();
  return data?.email ? [data.email as string] : [];
}

export async function emailsDosAdmins() {
  const { data } = await criarClienteAdmin().from('perfis').select('email').eq('papel', 'admin');
  return (data ?? []).map((p) => p.email as string);
}

export async function emailsDaEmpresa(empresaId: string) {
  const { data } = await criarClienteAdmin().from('membros_empresa').select('perfis(email)').eq('empresa_id', empresaId);
  return (data ?? []).map((m) => (m.perfis as unknown as { email: string }).email);
}
