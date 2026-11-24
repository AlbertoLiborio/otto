import Link from 'next/link';
import { Aviso, Botao, Campo, Cartao, lerAviso } from '@/components/ui';
import { recuperarSenha } from '../acoes';

export const metadata = { title: 'Recuperar senha' };

export default async function RecuperarSenha({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok } = await lerAviso(searchParams);
  return (
    <Cartao>
      <h1 className="mb-1 font-display text-2xl font-bold">Esqueci minha senha</h1>
      <p className="mb-5 text-sm text-suave">Enviaremos um link para você criar uma nova senha.</p>
      <Aviso erro={erro} ok={ok} />
      <form action={recuperarSenha} className="space-y-4">
        <Campo rotulo="E-mail da conta">
          <input name="email" type="email" required autoComplete="email" className="campo" />
        </Campo>
        <Botao className="w-full">Enviar link</Botao>
      </form>
      <p className="mt-5 text-center text-sm">
        <Link href="/entrar" className="text-tinta-2 underline">Voltar para o login</Link>
      </p>
    </Cartao>
  );
}
