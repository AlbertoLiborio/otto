import { redirect } from 'next/navigation';
import { Aviso, Cartao, lerAviso } from '@/components/ui';
import { obterSessao, rotaInicial, situacaoMfa } from '@/lib/auth';
import { CadastroMfa } from './cadastro-mfa';

export const metadata = { title: 'Login em duas etapas' };

export default async function AtivarMfa({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro } = await lerAviso(searchParams);
  const sessao = await obterSessao();
  if (!sessao) redirect('/entrar');
  const mfa = await situacaoMfa(sessao);
  if (mfa.temFator) redirect(mfa.verificado ? rotaInicial(sessao.perfil.papel) : '/seguranca/verificar');

  return (
    <Cartao>
      <h1 className="mb-1 font-display text-2xl font-bold">Login em duas etapas</h1>
      <p className="mb-5 text-sm text-tinta-2">
        {mfa.obrigatorio
          ? 'Seu perfil tem acesso a dados de outras pessoas. Por segurança, o login em duas etapas é obrigatório.'
          : 'Proteja sua conta: além da senha, será pedido um código do seu celular.'}
      </p>
      <Aviso erro={erro} />
      <CadastroMfa />
    </Cartao>
  );
}
