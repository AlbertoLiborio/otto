import { redirect } from 'next/navigation';
import { Aviso, Botao, Campo, Cartao, Etiqueta, Titulo, lerAviso } from '@/components/ui';
import { exigirPapel, obterEmpresaDoUsuario } from '@/lib/auth';
import { convidarMembro, removerMembro } from '../acoes';

export const metadata = { title: 'Equipe' };

export default async function Equipe({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok } = await lerAviso(searchParams);
  const { supabase, user } = await exigirPapel('empresa');
  const empresa = await obterEmpresaDoUsuario(user.id);
  if (!empresa) redirect('/empresa/cadastro');
  const ehAdmin = empresa.papelMembro === 'admin';

  // RLS: membros só enxergam a própria empresa
  const { data: membros } = await supabase
    .from('membros_empresa')
    .select('user_id, papel, perfis(nome, email)')
    .eq('empresa_id', empresa.id);

  return (
    <div className="mx-auto max-w-3xl">
      <Titulo sub={empresa.nome_fantasia || empresa.razao_social}>Equipe</Titulo>
      <Aviso erro={erro} ok={ok} />

      <Cartao className="mb-6 divide-y divide-linha p-0 sm:p-0">
        {(membros ?? []).map((m) => {
          const p = m.perfis as unknown as { nome: string; email: string };
          return (
            <div key={m.user_id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{p.nome}{m.user_id === user.id && ' (você)'}</p>
                <p className="text-sm text-suave">{p.email}</p>
              </div>
              <Etiqueta cor={m.papel === 'admin' ? 'ambar' : 'neutra'}>{m.papel === 'admin' ? 'Administrador' : 'Usuário'}</Etiqueta>
              {ehAdmin && m.user_id !== user.id && (
                <form action={removerMembro}>
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <button className="text-xs text-vermelho underline">remover</button>
                </form>
              )}
            </div>
          );
        })}
      </Cartao>

      {ehAdmin ? (
        <Cartao>
          <h2 className="mb-1 font-semibold">Convidar pessoa</h2>
          <p className="mb-4 text-sm text-suave">
            Ela recebe um e-mail para criar a senha e, no primeiro acesso, configura o login em duas etapas.
          </p>
          <form action={convidarMembro} className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome">
              <input name="nome" required minLength={3} className="campo" />
            </Campo>
            <Campo rotulo="E-mail corporativo">
              <input name="email" type="email" required className="campo" />
            </Campo>
            <Campo rotulo="Permissão" dica="Administradores também convidam e removem pessoas.">
              <select name="papel" className="campo" defaultValue="usuario">
                <option value="usuario">Usuário</option>
                <option value="admin">Administrador</option>
              </select>
            </Campo>
            <div className="flex items-end">
              <Botao className="w-full">Enviar convite</Botao>
            </div>
          </form>
        </Cartao>
      ) : (
        <p className="text-sm text-suave">Peça a um administrador da empresa para convidar novas pessoas.</p>
      )}
    </div>
  );
}
