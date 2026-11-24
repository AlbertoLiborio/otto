-- =====================================================================
-- Otto — LGPD (exclusão de conta) e MFA obrigatório para admin
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Exclusão de conta (LGPD): referências que impediriam apagar um
--    usuário passam a ficar nulas. Registros financeiros e demandas da
--    empresa são preservados, sem o vínculo com a pessoa excluída.
-- ---------------------------------------------------------------------
alter table public.demandas alter column criada_por drop not null;
alter table public.demandas drop constraint demandas_criada_por_fkey,
  add constraint demandas_criada_por_fkey foreign key (criada_por) references public.perfis (id) on delete set null;

alter table public.questoes drop constraint questoes_criada_por_fkey,
  add constraint questoes_criada_por_fkey foreign key (criada_por) references public.perfis (id) on delete set null;

alter table public.registros_profissionais drop constraint registros_profissionais_verificado_por_fkey,
  add constraint registros_profissionais_verificado_por_fkey foreign key (verificado_por) references public.perfis (id) on delete set null;

alter table public.avaliacoes drop constraint avaliacoes_avaliador_id_fkey,
  add constraint avaliacoes_avaliador_id_fkey foreign key (avaliador_id) references public.avaliadores (id) on delete set null;

alter table public.cobrancas drop constraint cobrancas_indicacao_id_fkey,
  add constraint cobrancas_indicacao_id_fkey foreign key (indicacao_id) references public.indicacoes (id) on delete set null;

alter table public.movimentos_credito drop constraint movimentos_credito_demanda_fk,
  add constraint movimentos_credito_demanda_fk foreign key (demanda_id) references public.demandas (id) on delete set null;

-- Só o próprio criador (ou ninguém, após exclusão) — política de insert continua exigindo criada_por = auth.uid()

-- ---------------------------------------------------------------------
-- 2. Admin só tem poderes no banco com sessão verificada em 2 etapas
--    (aal2). Mesmo com a senha vazada, sem o código do app autenticador
--    o RLS não libera nada de administrador.
-- ---------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'admin')
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- ---------------------------------------------------------------------
-- 3. Último consentimento de cada tipo (para a tela "Minha conta")
-- ---------------------------------------------------------------------
create view public.vw_consentimentos_atuais with (security_invoker = true) as
select distinct on (user_id, tipo) user_id, tipo, versao, aceito, created_at
  from public.consentimentos
 order by user_id, tipo, created_at desc, id desc;
