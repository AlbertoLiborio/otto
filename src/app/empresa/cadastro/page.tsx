import { redirect } from 'next/navigation';
import { Aviso, Botao, Campo, Cartao, Titulo, lerAviso } from '@/components/ui';
import { exigirPapel, obterEmpresaDoUsuario } from '@/lib/auth';
import { cadastrarEmpresa } from '../acoes';

export const metadata = { title: 'Cadastro da empresa' };

export default async function CadastroEmpresa({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro } = await lerAviso(searchParams);
  const { user } = await exigirPapel('empresa');
  if (await obterEmpresaDoUsuario(user.id)) redirect('/empresa');

  return (
    <div className="mx-auto max-w-xl">
      <Titulo sub="Precisamos dos dados da empresa para emitir notas fiscais e liberar suas demandas.">Cadastre sua empresa</Titulo>
      <Aviso erro={erro} />
      <form action={cadastrarEmpresa}>
        <Cartao className="space-y-4">
          <Campo rotulo="CNPJ">
            <input name="cnpj" required inputMode="numeric" placeholder="00.000.000/0000-00" className="campo" />
          </Campo>
          <Campo rotulo="Razão social">
            <input name="razao_social" required className="campo" />
          </Campo>
          <Campo rotulo="Nome fantasia">
            <input name="nome_fantasia" className="campo" />
          </Campo>
          <Campo rotulo="Segmento" dica="Ex.: Consultoria TOTVS, Indústria, Varejo, Saúde">
            <input name="segmento" className="campo" />
          </Campo>
          <Botao className="w-full">Cadastrar empresa</Botao>
        </Cartao>
      </form>
    </div>
  );
}
