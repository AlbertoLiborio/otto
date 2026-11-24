import Link from 'next/link';
import { Aviso, Botao, Campo, Cartao, lerAviso } from '@/components/ui';
import { cadastrar } from '../acoes';

export const metadata = { title: 'Criar conta' };

export default async function Cadastro({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, sp } = await lerAviso(searchParams);
  const tipo = sp.tipo === 'empresa' ? 'empresa' : 'profissional';

  return (
    <Cartao>
      <h1 className="mb-1 font-display text-2xl font-bold">Criar conta</h1>
      <p className="mb-5 text-sm text-suave">
        Já tem conta? <Link href="/entrar" className="font-semibold text-tinta underline">Entrar</Link>
      </p>

      <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-black/5 p-1 text-sm font-semibold">
        {(['profissional', 'empresa'] as const).map((t) => (
          <Link
            key={t}
            href={`/cadastro?tipo=${t}`}
            className={`rounded-md py-2 text-center ${tipo === t ? 'bg-white shadow-sm' : 'text-suave'}`}
          >
            {t === 'profissional' ? 'Sou profissional' : 'Sou empresa'}
          </Link>
        ))}
      </div>

      <Aviso erro={erro} />

      <form action={cadastrar} className="space-y-4">
        <input type="hidden" name="papel" value={tipo} />
        <Campo rotulo={tipo === 'empresa' ? 'Seu nome (responsável)' : 'Nome completo'}>
          <input name="nome" required minLength={3} autoComplete="name" className="campo" />
        </Campo>
        <Campo rotulo={tipo === 'empresa' ? 'E-mail corporativo' : 'E-mail'}>
          <input name="email" type="email" required autoComplete="email" className="campo" />
        </Campo>
        <Campo rotulo="Senha" dica="Mínimo de 10 caracteres.">
          <input name="senha" type="password" required minLength={10} autoComplete="new-password" className="campo" />
        </Campo>

        <label className="flex gap-2 text-sm">
          <input type="checkbox" name="termos" required className="mt-1" />
          <span>
            Li e aceito os <Link href="/termos" target="_blank" className="underline">Termos de Uso</Link> e a{' '}
            <Link href="/privacidade" target="_blank" className="underline">Política de Privacidade</Link>.
          </span>
        </label>

        {tipo === 'profissional' && (
          <label className="flex gap-2 rounded-lg bg-ambar-claro p-3 text-sm">
            <input type="checkbox" name="ofertas" required className="mt-1" />
            <span>
              Aceito receber do Otto ofertas de <strong>treinamentos e cursos</strong> relacionados às minhas competências. O
              cadastro e a avaliação são gratuitos em troca desse aceite. Posso cancelar o recebimento quando quiser.
            </span>
          </label>
        )}

        <Botao className="w-full">Criar conta</Botao>
      </form>
    </Cartao>
  );
}
