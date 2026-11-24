import Link from 'next/link';
import { Marca } from '@/components/ui';
import { supabaseConfigurado } from '@/lib/supabase/server';

export default function LayoutAcesso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10">
      <Link href="/" className="mb-8">
        <Marca className="text-4xl" />
      </Link>
      {!supabaseConfigurado() && (
        <p className="mb-4 w-full max-w-md rounded-lg bg-ambar-claro px-4 py-3 text-sm text-ambar">
          Ambiente de demonstração: o banco de dados ainda não foi conectado, então login e cadastro não funcionam.
        </p>
      )}
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
