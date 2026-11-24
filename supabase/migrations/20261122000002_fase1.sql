-- =====================================================================
-- Otto — Fase 1: caso prático em texto, arquivos privados e
-- registro automático de consentimentos no cadastro.
-- =====================================================================

-- Resposta do caso prático (texto ou link), além do arquivo opcional
alter table public.avaliacoes add column caso_pratico_resposta text;

-- Enunciado padrão do caso prático por especialidade (editável pelo admin)
alter table public.especialidades add column caso_pratico_padrao text;

update public.especialidades set caso_pratico_padrao =
'Um cliente com 1.200 funcionários em 3 coligadas usa o RM Labore e precisa:
1) Criar um evento de adicional de 10% sobre o salário para funcionários de uma seção específica, com incidência em INSS, FGTS e IRRF.
2) Garantir que o evento seja enviado corretamente ao eSocial (S-1010 e S-1200).
3) Gerar uma consulta SQL que liste, por coligada e seção, o total pago desse evento no mês.

Descreva passo a passo como você faria cada item (parametrizações, fórmulas, cuidados) e inclua a consulta SQL.'
where slug = 'totvs-rm';

-- Bucket privado para currículos, casos práticos e documentos de registro.
-- Acesso somente pelo servidor (links temporários gerados sob demanda).
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- Novo usuário: cria perfil e registra consentimentos enviados no cadastro
create or replace function public.tg_novo_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_versao text  := coalesce(v_meta #>> '{consentimentos,versao}', 'sem-versao');
  v_ip     inet;
begin
  begin
    v_ip := (v_meta ->> 'ip')::inet;
  exception when others then
    v_ip := null;
  end;

  insert into public.perfis (id, nome, email, papel)
  values (new.id,
          coalesce(nullif(v_meta ->> 'nome', ''), split_part(new.email, '@', 1)),
          new.email,
          case when v_meta ->> 'papel' = 'empresa' then 'empresa'::public.papel_usuario
               else 'profissional'::public.papel_usuario end);   -- nunca aceita 'admin'/'avaliador' do cliente

  if (v_meta #>> '{consentimentos,termos_uso}')::boolean is true then
    insert into public.consentimentos (user_id, tipo, versao, aceito, ip)
    values (new.id, 'termos_uso', v_versao, true, v_ip),
           (new.id, 'privacidade', v_versao, true, v_ip);
  end if;

  if v_meta #> '{consentimentos,ofertas_treinamento}' is not null then
    insert into public.consentimentos (user_id, tipo, versao, aceito, ip)
    values (new.id, 'ofertas_treinamento', v_versao,
            coalesce((v_meta #>> '{consentimentos,ofertas_treinamento}')::boolean, false), v_ip);
  end if;

  return new;
end $$;
