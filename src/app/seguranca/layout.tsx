import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Marca } from '@/components/ui';
import { obterSessao } from '@/lib/auth';

/** Telas de segurança: exigem login, mas não a 2ª etapa (são elas que a configuram). */
export default async function LayoutSeguranca({ children }: { children: React.ReactNode }) {
  const sessao = await obterSessao();
  if (!sessao) redirect('/entrar');
  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10">
      <div className="mb-8 flex w-full max-w-md items-center justify-between">
        <Link href="/"><Marca className="text-3xl" /></Link>
        <form action="/auth/sair" method="post">
          <button className="text-sm text-tinta-2 underline">Sair</button>
        </form>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
