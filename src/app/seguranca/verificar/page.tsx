import { redirect } from 'next/navigation';
import { Aviso, Botao, Cartao, lerAviso } from '@/components/ui';
import { obterSessao, rotaInicial, situacaoMfa } from '@/lib/auth';
import { verificarMfa } from '../acoes';

export const metadata = { title: 'Verificação' };

export default async function VerificarMfa({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, sp } = await lerAviso(searchParams);
  const proximo = sp.proximo === 'senha' ? 'senha' : '';
  const sessao = await obterSessao();
  if (!sessao) redirect('/entrar');
  const mfa = await situacaoMfa(sessao);
  if (!mfa.temFator) redirect('/seguranca/mfa');
  if (mfa.verificado) redirect(proximo ? '/seguranca/senha' : rotaInicial(sessao.perfil.papel));

  return (
    <Cartao>
      <h1 className="mb-1 font-display text-2xl font-bold">Confirme que é você</h1>
      <p className="mb-5 text-sm text-tinta-2">Digite o código de 6 dígitos do seu app autenticador.</p>
      <Aviso erro={erro} />
      <form action={verificarMfa} className="space-y-4">
        <input type="hidden" name="proximo" value={proximo} />
        <input
          name="codigo"
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          aria-label="Código de 6 dígitos"
          className="campo text-center font-mono text-2xl tracking-[0.4em]"
        />
        <Botao className="w-full">Entrar</Botao>
      </form>
      <p className="mt-5 text-xs text-suave">
        Perdeu o celular? Fale com o suporte do Otto para redefinir o acesso após confirmação de identidade.
      </p>
    </Cartao>
  );
}
