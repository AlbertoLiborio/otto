import { Aviso, Botao, Campo, Cartao, Titulo, lerAviso } from '@/components/ui';
import { exigirPapel } from '@/lib/auth';
import { ROTULO_VINCULO, UFS, type Vinculo } from '@/lib/tipos';
import { salvarPerfil } from '../acoes';

export const metadata = { title: 'Meu perfil' };

const centavosParaCampo = (c: number | null) => (c == null ? '' : (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));

export default async function Perfil({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { erro, ok } = await lerAviso(searchParams);
  const { supabase, user, perfil } = await exigirPapel('profissional');
  const { data: p } = await supabase.from('profissionais').select('*').eq('id', user.id).maybeSingle();
  const vinculos: Vinculo[] = p?.vinculos_aceitos ?? [];

  return (
    <>
      <Titulo sub="As empresas veem seu perfil técnico sem nome e contato. Esses dados só são liberados se você aceitar.">
        Meu perfil
      </Titulo>
      <Aviso erro={erro} ok={ok} />
      <form action={salvarPerfil}>
        <Cartao className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome completo">
              <input name="nome" defaultValue={perfil.nome} required className="campo" />
            </Campo>
            <Campo rotulo="Telefone / WhatsApp">
              <input name="telefone" defaultValue={perfil.telefone ?? ''} placeholder="(11) 99999-9999" className="campo" />
            </Campo>
          </div>
          <Campo rotulo="Título profissional" dica="Ex.: Consultor TOTVS RM Labore e eSocial">
            <input name="titulo" defaultValue={p?.titulo ?? ''} required minLength={5} maxLength={120} className="campo" />
          </Campo>
          <Campo rotulo="Resumo da experiência" dica="Projetos, clientes, módulos que domina. Não inclua dados de contato.">
            <textarea name="resumo" defaultValue={p?.resumo ?? ''} rows={5} maxLength={2000} className="campo" />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo rotulo="Cidade">
              <input name="cidade" defaultValue={p?.cidade ?? ''} className="campo" />
            </Campo>
            <Campo rotulo="UF">
              <select name="uf" defaultValue={p?.uf ?? ''} className="campo">
                <option value="">—</option>
                {UFS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </Campo>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" name="aceita_remoto" defaultChecked={p?.aceita_remoto ?? true} /> Aceito trabalho remoto
            </label>
          </div>

          <fieldset>
            <legend className="rotulo">Tipos de vínculo que aceito</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {(Object.keys(ROTULO_VINCULO) as Vinculo[]).map((v) => (
                <label key={v} className="flex items-center gap-2">
                  <input type="checkbox" name="vinculos" value={v} defaultChecked={vinculos.includes(v)} /> {ROTULO_VINCULO[v]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Pretensão salarial CLT (R$/mês)">
              <input name="pretensao_clt" inputMode="decimal" defaultValue={centavosParaCampo(p?.pretensao_clt_centavos ?? null)} className="campo" />
            </Campo>
            <Campo rotulo="Valor hora PJ / freelance (R$)">
              <input name="valor_hora_pj" inputMode="decimal" defaultValue={centavosParaCampo(p?.valor_hora_pj_centavos ?? null)} className="campo" />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="LinkedIn">
              <input name="linkedin_url" type="url" defaultValue={p?.linkedin_url ?? ''} placeholder="https://www.linkedin.com/in/..." className="campo" />
            </Campo>
            <Campo rotulo="CNPJ da empresa onde trabalha hoje" dica="Opcional. Evita que um avaliador da mesma empresa avalie você.">
              <input name="empresa_atual_cnpj" defaultValue={p?.empresa_atual_cnpj ?? ''} className="campo" />
            </Campo>
          </div>

          <Campo rotulo="Currículo (PDF, até 5 MB)" dica={p?.curriculo_path ? 'Já enviado. Envie outro para substituir.' : undefined}>
            <input name="curriculo" type="file" accept="application/pdf" className="block text-sm" />
          </Campo>

          <div className="flex justify-end">
            <Botao>Salvar perfil</Botao>
          </div>
        </Cartao>
      </form>
    </>
  );
}
