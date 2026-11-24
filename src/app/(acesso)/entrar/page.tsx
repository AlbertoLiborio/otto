import Link from 'next/link';
import { Aviso, Botao, Campo, Cartao, lerAviso } from '@/components/ui';
import { entrar, entrarComLink, entrarComLinkedIn } from '../acoes';

export const metadata = { title: 'Entrar' };

export default async function Entrar({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok, sp } = await lerAviso(searchParams);
  const voltar = typeof sp.voltar === 'string' ? sp.voltar : '';

  return (
    <Cartao>
      <h1 className="mb-1 font-display text-2xl font-bold">Entrar</h1>
      <p className="mb-6 text-sm text-suave">
        Ainda não tem conta? <Link href="/cadastro" className="font-semibold text-tinta underline">Cadastre-se</Link>
      </p>
      <Aviso erro={erro} ok={ok} />

      <form action={entrar} className="space-y-4">
        <input type="hidden" name="voltar" value={voltar} />
        <Campo rotulo="E-mail">
          <input name="email" type="email" required autoComplete="email" className="campo" />
        </Campo>
        <Campo rotulo="Senha">
          <input name="senha" type="password" required autoComplete="current-password" className="campo" />
        </Campo>
        <p className="-mt-2 text-right text-xs">
          <Link href="/recuperar-senha" className="text-tinta-2 underline">Esqueci minha senha</Link>
        </p>
        <Botao className="w-full">Entrar</Botao>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-suave">
        <span className="h-px flex-1 bg-linha" /> ou <span className="h-px flex-1 bg-linha" />
      </div>

      <form action={entrarComLinkedIn}>
        <Botao variante="secundario" className="w-full">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#0a66c2]" aria-hidden="true">
            <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
          </svg>
          Entrar com LinkedIn
        </Botao>
      </form>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-tinta-2">Receber link de acesso por e-mail</summary>
        <form action={entrarComLink} className="mt-3 flex gap-2">
          <input name="email" type="email" required placeholder="seu@email.com" className="campo" />
          <Botao variante="secundario">Enviar</Botao>
        </form>
      </details>
    </Cartao>
  );
}
