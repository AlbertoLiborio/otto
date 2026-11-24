import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Aviso, Botao, Campo, Cartao, lerAviso } from '@/components/ui';
import { obterSessao, situacaoMfa } from '@/lib/auth';
import { definirSenha } from '../acoes';

export const metadata = { title: 'Definir senha' };

export default async function DefinirSenha({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro } = await lerAviso(searchParams);
  const sessao = await obterSessao();
  if (!sessao) redirect('/entrar');
  // Quem tem 2ª etapa ativa precisa confirmá-la antes de trocar a senha
  const mfa = await situacaoMfa(sessao);
  if (mfa.temFator && !mfa.verificado) redirect('/seguranca/verificar?proximo=senha');
  const { data: termos } = await sessao.supabase
    .from('vw_consentimentos_atuais')
    .select('aceito')
    .eq('user_id', sessao.user.id)
    .eq('tipo', 'termos_uso')
    .maybeSingle();

  return (
    <Cartao>
      <h1 className="mb-1 font-display text-2xl font-bold">Definir senha</h1>
      <p className="mb-5 text-sm text-suave">{sessao.perfil.email}</p>
      <Aviso erro={erro} />
      <form action={definirSenha} className="space-y-4">
        <Campo rotulo="Nova senha" dica="Mínimo de 10 caracteres.">
          <input name="senha" type="password" required minLength={10} autoComplete="new-password" className="campo" />
        </Campo>
        <Campo rotulo="Repita a nova senha">
          <input name="confirmacao" type="password" required minLength={10} autoComplete="new-password" className="campo" />
        </Campo>
        {!termos?.aceito && (
          <label className="flex gap-2 text-sm">
            <input type="checkbox" name="termos" required className="mt-1" />
            <span>
              Li e aceito os <Link href="/termos" target="_blank" className="underline">Termos de Uso</Link> e a{' '}
              <Link href="/privacidade" target="_blank" className="underline">Política de Privacidade</Link>.
            </span>
          </label>
        )}
        <Botao className="w-full">Salvar senha</Botao>
      </form>
    </Cartao>
  );
}
