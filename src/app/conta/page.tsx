import Link from 'next/link';
import { Aviso, Botao, BotaoLink, Cartao, Etiqueta, Titulo, lerAviso } from '@/components/ui';
import { exigirPapel, situacaoMfa, TODOS_PAPEIS } from '@/lib/auth';
import { dataBR } from '@/lib/regras';
import { alterarOfertas, desativarMfa, excluirConta } from './acoes';

export const metadata = { title: 'Minha conta' };

const ROTULO_PAPEL = { profissional: 'Profissional', empresa: 'Empresa', avaliador: 'Avaliador parceiro', admin: 'Administrador' };

export default async function MinhaConta({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok } = await lerAviso(searchParams);
  const sessao = await exigirPapel(...TODOS_PAPEIS);
  const { supabase, user, perfil } = sessao;
  const mfa = await situacaoMfa(sessao);
  const { data: consentimentos } = await supabase.from('vw_consentimentos_atuais').select('tipo, aceito, versao, created_at').eq('user_id', user.id);
  const ofertas = consentimentos?.find((c) => c.tipo === 'ofertas_treinamento');
  const termos = consentimentos?.find((c) => c.tipo === 'termos_uso');

  return (
    <div className="mx-auto max-w-2xl">
      <Titulo sub={`${perfil.email} · ${ROTULO_PAPEL[perfil.papel]}`}>Minha conta</Titulo>
      <Aviso erro={erro} ok={ok} />

      <div className="space-y-6">
        <Cartao>
          <h2 className="mb-4 font-semibold">Segurança</h2>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha pb-4">
            <div>
              <p className="font-medium">Login em duas etapas</p>
              <p className="text-sm text-suave">Código do app autenticador além da senha.</p>
            </div>
            {mfa.temFator ? (
              <div className="flex items-center gap-3">
                <Etiqueta cor="verde">Ativado</Etiqueta>
                {!mfa.obrigatorio && (
                  <form action={desativarMfa}>
                    <button className="text-sm text-vermelho underline">Desativar</button>
                  </form>
                )}
              </div>
            ) : (
              <BotaoLink href="/seguranca/mfa" variante="secundario">Ativar</BotaoLink>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div>
              <p className="font-medium">Senha</p>
              <p className="text-sm text-suave">Último acesso em {dataBR(user.last_sign_in_at, true)}.</p>
            </div>
            <BotaoLink href="/seguranca/senha" variante="secundario">Trocar senha</BotaoLink>
          </div>
        </Cartao>

        <Cartao>
          <h2 className="mb-4 font-semibold">Privacidade e consentimentos</h2>
          <p className="mb-4 text-sm text-tinta-2">
            Termos de Uso e Política de Privacidade aceitos{termos ? ` em ${dataBR(termos.created_at)} (versão ${termos.versao})` : ''}.{' '}
            <Link href="/privacidade" className="underline">Ler política</Link>
          </p>
          {perfil.papel === 'profissional' && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-papel p-4">
              <div>
                <p className="font-medium">Ofertas de treinamentos e cursos</p>
                <p className="text-sm text-suave">{ofertas?.aceito ? 'Você recebe ofertas.' : 'Você não recebe ofertas.'}</p>
              </div>
              <form action={alterarOfertas}>
                <input type="hidden" name="aceito" value={String(!ofertas?.aceito)} />
                <Botao variante="secundario">{ofertas?.aceito ? 'Parar de receber' : 'Voltar a receber'}</Botao>
              </form>
            </div>
          )}
        </Cartao>

        <Cartao>
          <h2 className="mb-1 font-semibold">Meus dados</h2>
          <p className="mb-4 text-sm text-suave">Baixe uma cópia de tudo o que o Otto guarda sobre você (LGPD, art. 18).</p>
          <a href="/conta/exportar" className="inline-flex items-center rounded-lg border border-linha bg-white px-4 py-2 text-sm font-semibold hover:border-tinta-2">
            Baixar meus dados (JSON)
          </a>
        </Cartao>

        {perfil.papel !== 'admin' && (
          <Cartao className="border-vermelho/30">
            <h2 className="mb-1 font-semibold text-vermelho">Excluir conta</h2>
            <p className="mb-4 text-sm text-tinta-2">
              Apaga definitivamente seu perfil, currículo, avaliações, selos e indicações. Não é possível desfazer.
              {perfil.papel === 'empresa' && ' As demandas e cobranças da empresa são mantidas.'}
            </p>
            <form action={excluirConta} className="flex flex-wrap gap-2">
              <input name="confirmacao" required placeholder="Digite EXCLUIR" aria-label="Digite EXCLUIR para confirmar" className="campo w-48" />
              <Botao variante="perigo">Excluir minha conta</Botao>
            </form>
          </Cartao>
        )}
      </div>
    </div>
  );
}
