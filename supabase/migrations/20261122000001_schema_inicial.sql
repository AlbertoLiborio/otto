-- =====================================================================
-- Otto — Schema inicial (PostgreSQL / Supabase)
-- Multiárea: area > especialidade > competencia
-- Segurança: Row Level Security em TODAS as tabelas.
-- Escritas sensíveis (notas, selos, gabarito, status de indicação,
-- cobranças) são feitas apenas pelo servidor (service_role), que
-- ignora RLS. O navegador só lê o que as políticas permitem.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.papel_usuario       as enum ('profissional', 'empresa', 'avaliador', 'admin');
create type public.vinculo             as enum ('clt', 'pj', 'freelance');
create type public.nivel               as enum ('junior', 'pleno', 'senior', 'especialista');
create type public.modalidade          as enum ('remoto', 'presencial', 'hibrido');
create type public.status_perfil       as enum ('rascunho', 'em_avaliacao', 'aprovado', 'reprovado', 'inativo');
create type public.status_verificacao  as enum ('pendente', 'verificado', 'rejeitado');
create type public.status_tentativa    as enum ('em_andamento', 'finalizada', 'expirada');
create type public.status_avaliacao    as enum ('aguardando_caso', 'aguardando_avaliador', 'agendada', 'concluida', 'cancelada');
create type public.papel_membro        as enum ('admin', 'usuario');
create type public.tipo_plano          as enum ('assinatura', 'creditos', 'success_fee');
create type public.status_assinatura   as enum ('ativa', 'suspensa', 'cancelada');
create type public.status_demanda      as enum ('aberta', 'em_curadoria', 'shortlist_enviada', 'encerrada', 'cancelada');
create type public.status_indicacao    as enum ('sugerido', 'enviado_empresa', 'contato_solicitado', 'aceito_profissional',
                                                'recusado_profissional', 'contratado', 'nao_selecionado');
create type public.tipo_cobranca       as enum ('assinatura', 'creditos', 'success_fee');
create type public.status_cobranca     as enum ('pendente', 'paga', 'vencida', 'cancelada');
create type public.tipo_consentimento  as enum ('termos_uso', 'privacidade', 'ofertas_treinamento');
create type public.tipo_questao        as enum ('multipla_escolha', 'verdadeiro_falso');

-- ---------------------------------------------------------------------
-- Função utilitária: updated_at automático
-- ---------------------------------------------------------------------
create function public.tg_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- =====================================================================
-- 1. IDENTIDADE
-- =====================================================================
create table public.perfis (
  id          uuid primary key references auth.users (id) on delete cascade,
  papel       public.papel_usuario not null default 'profissional',
  nome        text not null,
  email       text not null,
  telefone    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger perfis_updated before update on public.perfis
  for each row execute function public.tg_set_updated_at();

-- =====================================================================
-- 2. TAXONOMIA (multiárea)
-- =====================================================================
create table public.areas (
  id                         smallint generated always as identity primary key,
  slug                       text not null unique,
  nome                       text not null,
  exige_registro_conselho    boolean not null default false,
  conselhos_aceitos          text[] not null default '{}',   -- ex.: {CRC} {CREA,CAU} {CRM,COREN}
  ativa                      boolean not null default true
);

create table public.especialidades (
  id        smallint generated always as identity primary key,
  area_id   smallint not null references public.areas (id),
  slug      text not null unique,
  nome      text not null,                                    -- ex.: TOTVS RM
  ativa     boolean not null default true
);

create table public.competencias (
  id                 integer generated always as identity primary key,
  especialidade_id   smallint not null references public.especialidades (id),
  slug               text not null,
  nome               text not null,                           -- ex.: RM Labore (Folha)
  descricao          text,
  ativa              boolean not null default true,
  unique (especialidade_id, slug)
);

-- =====================================================================
-- 3. PROFISSIONAIS
-- =====================================================================
create table public.profissionais (
  id                          uuid primary key references public.perfis (id) on delete cascade,
  titulo                      text,                           -- ex.: Consultor RM Labore Sênior
  resumo                      text,
  cidade                      text,
  uf                          char(2),
  aceita_remoto               boolean not null default true,
  vinculos_aceitos            public.vinculo[] not null default '{}',
  pretensao_clt_centavos      bigint check (pretensao_clt_centavos >= 0),
  valor_hora_pj_centavos      bigint check (valor_hora_pj_centavos >= 0),
  linkedin_url                text,
  curriculo_path              text,                           -- caminho no Storage privado
  status                      public.status_perfil not null default 'rascunho',
  empresa_atual_cnpj          text,                           -- para conflito de interesse (RN09)
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create trigger profissionais_updated before update on public.profissionais
  for each row execute function public.tg_set_updated_at();

create table public.registros_profissionais (
  id                 uuid primary key default gen_random_uuid(),
  profissional_id    uuid not null references public.profissionais (id) on delete cascade,
  conselho           text not null,                           -- CRC, CREA, CRM...
  numero             text not null,
  uf                 char(2) not null,
  documento_path     text,
  status             public.status_verificacao not null default 'pendente',
  verificado_por     uuid references public.perfis (id),
  verificado_em      timestamptz,
  created_at         timestamptz not null default now(),
  unique (conselho, numero, uf)
);

create table public.competencias_profissional (
  profissional_id     uuid not null references public.profissionais (id) on delete cascade,
  competencia_id      integer not null references public.competencias (id),
  nivel_declarado     public.nivel not null,
  anos_experiencia    smallint not null default 0 check (anos_experiencia between 0 and 60),
  -- preenchidos SOMENTE pelo servidor após avaliação:
  nivel_validado      public.nivel,
  nota_validada       numeric(5,2) check (nota_validada between 0 and 100),
  validado_em         timestamptz,
  primary key (profissional_id, competencia_id)
);

-- =====================================================================
-- 4. AVALIAÇÃO TÉCNICA
-- =====================================================================
create table public.questoes (
  id                 uuid primary key default gen_random_uuid(),
  competencia_id     integer not null references public.competencias (id),
  nivel              public.nivel not null,
  tipo               public.tipo_questao not null default 'multipla_escolha',
  enunciado          text not null,
  alternativas       jsonb not null,                          -- [{"chave":"A","texto":"..."}]
  resposta_correta   text not null,                           -- NUNCA exposta ao navegador
  explicacao         text,
  ativa              boolean not null default true,
  criada_por         uuid references public.perfis (id),
  created_at         timestamptz not null default now()
);

create table public.provas (
  id                   smallint generated always as identity primary key,
  especialidade_id     smallint not null references public.especialidades (id),
  nome                 text not null,
  num_questoes         smallint not null default 30 check (num_questoes > 0),
  tempo_limite_min     smallint not null default 60 check (tempo_limite_min > 0),
  nota_minima          numeric(5,2) not null default 60,
  dias_para_refazer    smallint not null default 30,
  ativa                boolean not null default true
);

create table public.tentativas_prova (
  id                 uuid primary key default gen_random_uuid(),
  prova_id           smallint not null references public.provas (id),
  profissional_id    uuid not null references public.profissionais (id) on delete cascade,
  status             public.status_tentativa not null default 'em_andamento',
  iniciada_em        timestamptz not null default now(),
  expira_em          timestamptz not null,
  finalizada_em      timestamptz,
  nota               numeric(5,2)
);
create index on public.tentativas_prova (profissional_id);

create table public.respostas_tentativa (
  tentativa_id    uuid not null references public.tentativas_prova (id) on delete cascade,
  questao_id      uuid not null references public.questoes (id),
  ordem           smallint not null,
  resposta        text,
  correta         boolean,                                    -- preenchido pelo servidor
  respondida_em   timestamptz,
  primary key (tentativa_id, questao_id)
);

create table public.avaliadores (
  id                          uuid primary key references public.perfis (id) on delete cascade,
  bio                         text,
  empresa_atual_cnpj          text,
  valor_avaliacao_centavos    bigint not null default 0,
  chave_pix                   text,
  aprovado                    boolean not null default false,
  created_at                  timestamptz not null default now()
);

create table public.avaliador_especialidades (
  avaliador_id       uuid not null references public.avaliadores (id) on delete cascade,
  especialidade_id   smallint not null references public.especialidades (id),
  primary key (avaliador_id, especialidade_id)
);

create table public.avaliacoes (
  id                      uuid primary key default gen_random_uuid(),
  profissional_id         uuid not null references public.profissionais (id) on delete cascade,
  especialidade_id        smallint not null references public.especialidades (id),
  tentativa_prova_id      uuid references public.tentativas_prova (id),
  avaliador_id            uuid references public.avaliadores (id),
  status                  public.status_avaliacao not null default 'aguardando_caso',
  caso_pratico_enunciado  text,
  caso_pratico_path       text,
  caso_enviado_em         timestamptz,
  agendada_para           timestamptz,
  link_reuniao            text,
  nota_prova              numeric(5,2),
  nota_caso               numeric(5,2),
  nota_entrevista         numeric(5,2),
  nota_final              numeric(5,2),
  nivel_atribuido         public.nivel,
  parecer                 text,                               -- visível à empresa na shortlist
  concluida_em            timestamptz,
  avaliador_pago_em       timestamptz,
  created_at              timestamptz not null default now()
);
create index on public.avaliacoes (profissional_id);
create index on public.avaliacoes (avaliador_id);

create table public.avaliacao_notas_competencia (
  avaliacao_id     uuid not null references public.avaliacoes (id) on delete cascade,
  competencia_id   integer not null references public.competencias (id),
  nota             numeric(5,2) not null check (nota between 0 and 100),
  nivel            public.nivel not null,
  comentario       text,
  primary key (avaliacao_id, competencia_id)
);

create table public.selos (
  id                 uuid primary key default gen_random_uuid(),
  profissional_id    uuid not null references public.profissionais (id) on delete cascade,
  especialidade_id   smallint not null references public.especialidades (id),
  avaliacao_id       uuid not null references public.avaliacoes (id),
  nivel              public.nivel not null,
  nota_final         numeric(5,2) not null,
  emitido_em         timestamptz not null default now(),
  valido_ate         timestamptz not null,
  codigo_publico     text not null unique default substr(md5(gen_random_uuid()::text), 1, 12)
);
create index on public.selos (profissional_id);

-- =====================================================================
-- 5. EMPRESAS E COBRANÇA
-- =====================================================================
create table public.empresas (
  id              uuid primary key default gen_random_uuid(),
  cnpj            text not null unique check (cnpj ~ '^[0-9]{14}$'),
  razao_social    text not null,
  nome_fantasia   text,
  segmento        text,
  ativa           boolean not null default true,
  created_at      timestamptz not null default now()
);

create table public.membros_empresa (
  empresa_id   uuid not null references public.empresas (id) on delete cascade,
  user_id      uuid not null references public.perfis (id) on delete cascade,
  papel        public.papel_membro not null default 'usuario',
  primary key (empresa_id, user_id)
);

create table public.planos (
  id                         smallint generated always as identity primary key,
  nome                       text not null,
  tipo                       public.tipo_plano not null,
  preco_centavos             bigint not null default 0,
  creditos_inclusos          integer not null default 0,
  creditos_por_shortlist     integer not null default 1,
  success_fee_percentual     numeric(5,2) not null default 0,
  ativo                      boolean not null default true
);

create table public.assinaturas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas (id) on delete cascade,
  plano_id        smallint not null references public.planos (id),
  status          public.status_assinatura not null default 'ativa',
  inicio          date not null default current_date,
  fim             date,
  gateway_id      text
);

create table public.movimentos_credito (
  id            bigint generated always as identity primary key,
  empresa_id    uuid not null references public.empresas (id) on delete cascade,
  quantidade    integer not null,                             -- + compra / - consumo
  motivo        text not null,
  demanda_id    uuid,
  created_at    timestamptz not null default now()
);
create index on public.movimentos_credito (empresa_id);

-- =====================================================================
-- 6. DEMANDAS E INDICAÇÕES
-- =====================================================================
create table public.demandas (
  id                     uuid primary key default gen_random_uuid(),
  empresa_id             uuid not null references public.empresas (id) on delete cascade,
  criada_por             uuid not null references public.perfis (id),
  titulo                 text not null,
  especialidade_id       smallint not null references public.especialidades (id),
  vinculo                public.vinculo not null,
  nivel_minimo           public.nivel not null default 'pleno',
  modalidade             public.modalidade not null default 'remoto',
  cidade                 text,
  uf                     char(2),
  valor_min_centavos     bigint,
  valor_max_centavos     bigint,
  descricao              text,
  modelo_cobranca        public.tipo_plano not null,
  status                 public.status_demanda not null default 'aberta',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create trigger demandas_updated before update on public.demandas
  for each row execute function public.tg_set_updated_at();
create index on public.demandas (empresa_id);

alter table public.movimentos_credito
  add constraint movimentos_credito_demanda_fk foreign key (demanda_id) references public.demandas (id);

create table public.demanda_competencias (
  demanda_id       uuid not null references public.demandas (id) on delete cascade,
  competencia_id   integer not null references public.competencias (id),
  nivel_minimo     public.nivel not null default 'pleno',
  obrigatoria      boolean not null default true,
  primary key (demanda_id, competencia_id)
);

create table public.indicacoes (
  id                          uuid primary key default gen_random_uuid(),
  demanda_id                  uuid not null references public.demandas (id) on delete cascade,
  profissional_id             uuid not null references public.profissionais (id) on delete cascade,
  status                      public.status_indicacao not null default 'sugerido',
  observacao_curador          text,                           -- visível à empresa
  enviada_em                  timestamptz,
  contato_liberado_em         timestamptz,                    -- RN01: só após aceite
  contratado_em               timestamptz,
  valor_contratacao_centavos  bigint,
  feedback_nota               smallint check (feedback_nota between 1 and 5),
  feedback_comentario         text,
  created_at                  timestamptz not null default now(),
  unique (demanda_id, profissional_id)
);
create index on public.indicacoes (profissional_id);

create table public.cobrancas (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas (id) on delete cascade,
  tipo             public.tipo_cobranca not null,
  indicacao_id     uuid references public.indicacoes (id),
  assinatura_id    uuid references public.assinaturas (id),
  valor_centavos   bigint not null check (valor_centavos >= 0),
  status           public.status_cobranca not null default 'pendente',
  vencimento       date not null,
  pago_em          timestamptz,
  gateway_id       text,
  nf_numero        text,
  created_at       timestamptz not null default now()
);
create index on public.cobrancas (empresa_id);

-- =====================================================================
-- 7. LGPD E AUDITORIA
-- =====================================================================
create table public.consentimentos (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.perfis (id) on delete cascade,
  tipo         public.tipo_consentimento not null,
  versao       text not null,
  aceito       boolean not null,
  ip           inet,
  created_at   timestamptz not null default now()
);
create index on public.consentimentos (user_id, tipo, created_at desc);

create table public.logs_auditoria (
  id           bigint generated always as identity primary key,
  user_id      uuid references public.perfis (id) on delete set null,
  acao         text not null,                                 -- ex.: 'ver_contato', 'alterar_nota'
  entidade     text not null,
  entidade_id  text,
  detalhes     jsonb,
  created_at   timestamptz not null default now()
);

-- =====================================================================
-- 8. FUNÇÕES DE APOIO ÀS POLÍTICAS (security definer, search_path fixo)
-- =====================================================================
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'admin');
$$;

create function public.is_membro_empresa(p_empresa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membros_empresa where empresa_id = p_empresa and user_id = auth.uid());
$$;

create function public.is_admin_empresa(p_empresa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membros_empresa
                 where empresa_id = p_empresa and user_id = auth.uid() and papel = 'admin');
$$;

-- Empresa do usuário pode ver o contato deste profissional? (RN01)
create function public.empresa_tem_contato_liberado(p_profissional uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.indicacoes i
      join public.demandas d        on d.id = i.demanda_id
      join public.membros_empresa m on m.empresa_id = d.empresa_id
     where i.profissional_id = p_profissional
       and i.contato_liberado_em is not null
       and m.user_id = auth.uid());
$$;

-- Usuário é o avaliador designado deste profissional?
create function public.is_avaliador_do(p_profissional uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.avaliacoes
                 where profissional_id = p_profissional and avaliador_id = auth.uid());
$$;

-- Usuário é membro de uma empresa que recebeu este profissional numa shortlist?
create function public.empresa_recebeu_indicacao(p_profissional uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.indicacoes i
      join public.demandas d        on d.id = i.demanda_id
      join public.membros_empresa m on m.empresa_id = d.empresa_id
     where i.profissional_id = p_profissional
       and i.status <> 'sugerido'
       and m.user_id = auth.uid());
$$;

-- Shortlist ANONIMIZADA de uma demanda (o que a empresa enxerga antes do aceite)
create function public.shortlist_anonima(p_demanda uuid)
returns table (
  indicacao_id        uuid,
  status              public.status_indicacao,
  titulo              text,
  resumo              text,
  uf                  char(2),
  aceita_remoto       boolean,
  vinculos_aceitos    public.vinculo[],
  nivel               public.nivel,
  nota_final          numeric,
  parecer             text,
  observacao_curador  text,
  competencias        jsonb,
  -- só preenchidos após liberação de contato:
  nome                text,
  email               text,
  telefone            text,
  linkedin_url        text
)
language sql stable security definer set search_path = '' as $$
  select i.id, i.status, p.titulo, p.resumo, p.uf, p.aceita_remoto, p.vinculos_aceitos,
         s.nivel, s.nota_final, a.parecer, i.observacao_curador,
         coalesce((select jsonb_agg(jsonb_build_object(
                    'competencia', c.nome, 'nivel', cp.nivel_validado, 'nota', cp.nota_validada)
                    order by cp.nota_validada desc nulls last)
                     from public.competencias_profissional cp
                     join public.competencias c on c.id = cp.competencia_id
                    where cp.profissional_id = p.id and cp.nivel_validado is not null), '[]'::jsonb),
         case when i.contato_liberado_em is not null then pf.nome end,
         case when i.contato_liberado_em is not null then pf.email end,
         case when i.contato_liberado_em is not null then pf.telefone end,
         case when i.contato_liberado_em is not null then p.linkedin_url end
    from public.indicacoes i
    join public.demandas d       on d.id = i.demanda_id
    join public.profissionais p  on p.id = i.profissional_id
    join public.perfis pf        on pf.id = p.id
    left join lateral (
         select s2.* from public.selos s2
          where s2.profissional_id = p.id and s2.especialidade_id = d.especialidade_id
          order by s2.emitido_em desc limit 1) s on true
    left join public.avaliacoes a on a.id = s.avaliacao_id
   where i.demanda_id = p_demanda
     and i.status <> 'sugerido'
     and (public.is_membro_empresa(d.empresa_id) or public.is_admin());
$$;

-- Saldo de créditos da empresa
create function public.saldo_creditos(p_empresa uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when public.is_membro_empresa(p_empresa) or public.is_admin()
              then coalesce((select sum(quantidade)::int from public.movimentos_credito where empresa_id = p_empresa), 0)
         end;
$$;

-- Cria perfil automaticamente ao cadastrar usuário no Auth
create function public.tg_novo_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, nome, email, papel)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
          new.email,
          case when new.raw_user_meta_data ->> 'papel' = 'empresa' then 'empresa'::public.papel_usuario
               else 'profissional'::public.papel_usuario end);   -- nunca aceita 'admin' vindo do cliente
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.tg_novo_usuario();

-- =====================================================================
-- 9. VIEW DE LACUNAS (base para cursos) — apenas admin
-- =====================================================================
create view public.vw_lacunas_competencia with (security_invoker = true) as
select c.id                    as competencia_id,
       e.nome                  as especialidade,
       c.nome                  as competencia,
       q.nivel,
       count(*)                as respostas,
       round(100.0 * avg(case when r.correta then 0 else 1 end), 1) as pct_erro,
       count(distinct t.profissional_id) as profissionais
  from public.respostas_tentativa r
  join public.tentativas_prova t on t.id = r.tentativa_id
  join public.questoes q         on q.id = r.questao_id
  join public.competencias c     on c.id = q.competencia_id
  join public.especialidades e   on e.id = c.especialidade_id
 where r.correta is not null
 group by c.id, e.nome, c.nome, q.nivel;

-- =====================================================================
-- 10. ROW LEVEL SECURITY
-- =====================================================================
alter table public.perfis                      enable row level security;
alter table public.areas                       enable row level security;
alter table public.especialidades              enable row level security;
alter table public.competencias                enable row level security;
alter table public.profissionais               enable row level security;
alter table public.registros_profissionais     enable row level security;
alter table public.competencias_profissional   enable row level security;
alter table public.questoes                    enable row level security;
alter table public.provas                      enable row level security;
alter table public.tentativas_prova            enable row level security;
alter table public.respostas_tentativa         enable row level security;
alter table public.avaliadores                 enable row level security;
alter table public.avaliador_especialidades    enable row level security;
alter table public.avaliacoes                  enable row level security;
alter table public.avaliacao_notas_competencia enable row level security;
alter table public.selos                       enable row level security;
alter table public.empresas                    enable row level security;
alter table public.membros_empresa             enable row level security;
alter table public.planos                      enable row level security;
alter table public.assinaturas                 enable row level security;
alter table public.movimentos_credito          enable row level security;
alter table public.demandas                    enable row level security;
alter table public.demanda_competencias        enable row level security;
alter table public.indicacoes                  enable row level security;
alter table public.cobrancas                   enable row level security;
alter table public.consentimentos              enable row level security;
alter table public.logs_auditoria              enable row level security;

-- ---- Admin: acesso total de leitura e escrita -----------------------
do $$
declare t text;
begin
  foreach t in array array[
    'perfis','areas','especialidades','competencias','profissionais','registros_profissionais',
    'competencias_profissional','questoes','provas','tentativas_prova','respostas_tentativa',
    'avaliadores','avaliador_especialidades','avaliacoes','avaliacao_notas_competencia','selos',
    'empresas','membros_empresa','planos','assinaturas','movimentos_credito','demandas',
    'demanda_competencias','indicacoes','cobrancas','consentimentos','logs_auditoria']
  loop
    execute format('create policy admin_tudo on public.%I for all to authenticated
                    using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---- Catálogo público (taxonomia, planos, provas) -------------------
create policy leitura_publica on public.areas          for select to anon, authenticated using (ativa);
create policy leitura_publica on public.especialidades for select to anon, authenticated using (ativa);
create policy leitura_publica on public.competencias   for select to anon, authenticated using (ativa);
create policy leitura_publica on public.planos         for select to anon, authenticated using (ativo);
create policy leitura_publica on public.provas         for select to authenticated using (ativa);
-- questoes: SEM política para não-admin => gabarito inacessível pelo navegador.

-- ---- Perfis ---------------------------------------------------------
create policy proprio on public.perfis for select to authenticated using (id = auth.uid());
create policy proprio_editar on public.perfis for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and papel = (select p.papel from public.perfis p where p.id = auth.uid()));
create policy avaliador_ve on public.perfis for select to authenticated using (public.is_avaliador_do(id));
create policy empresa_ve_liberado on public.perfis for select to authenticated
  using (public.empresa_tem_contato_liberado(id));
create policy colegas_empresa on public.perfis for select to authenticated
  using (exists (select 1 from public.membros_empresa a
                   join public.membros_empresa b on b.empresa_id = a.empresa_id
                  where a.user_id = auth.uid() and b.user_id = perfis.id));

-- ---- Profissionais --------------------------------------------------
create policy proprio on public.profissionais for select to authenticated using (id = auth.uid());
create policy proprio_criar on public.profissionais for insert to authenticated
  with check (id = auth.uid() and status = 'rascunho');
create policy proprio_editar on public.profissionais for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and status = (select p.status from public.profissionais p where p.id = auth.uid()));
create policy avaliador_ve on public.profissionais for select to authenticated using (public.is_avaliador_do(id));
create policy empresa_ve_liberado on public.profissionais for select to authenticated
  using (public.empresa_tem_contato_liberado(id));

create policy proprio on public.registros_profissionais for select to authenticated using (profissional_id = auth.uid());
create policy proprio_criar on public.registros_profissionais for insert to authenticated
  with check (profissional_id = auth.uid() and status = 'pendente' and verificado_por is null);

create policy proprio on public.competencias_profissional for select to authenticated using (profissional_id = auth.uid());
create policy proprio_criar on public.competencias_profissional for insert to authenticated
  with check (profissional_id = auth.uid() and nivel_validado is null and nota_validada is null and validado_em is null);
create policy proprio_excluir on public.competencias_profissional for delete to authenticated
  using (profissional_id = auth.uid() and nivel_validado is null);
create policy avaliador_ve on public.competencias_profissional for select to authenticated
  using (public.is_avaliador_do(profissional_id));

-- ---- Prova e avaliação (escritas só pelo servidor) -----------------
create policy proprio on public.tentativas_prova for select to authenticated using (profissional_id = auth.uid());
create policy proprio on public.respostas_tentativa for select to authenticated
  using (exists (select 1 from public.tentativas_prova t
                  where t.id = tentativa_id and t.profissional_id = auth.uid() and t.status <> 'em_andamento'));

create policy proprio on public.avaliacoes for select to authenticated
  using (profissional_id = auth.uid() or avaliador_id = auth.uid());
create policy proprio on public.avaliacao_notas_competencia for select to authenticated
  using (exists (select 1 from public.avaliacoes a where a.id = avaliacao_id
                  and (a.profissional_id = auth.uid() or a.avaliador_id = auth.uid())));

create policy proprio on public.selos for select to authenticated using (profissional_id = auth.uid());
create policy empresa_ve on public.selos for select to authenticated
  using (public.empresa_recebeu_indicacao(profissional_id));

create policy proprio on public.avaliadores for select to authenticated using (id = auth.uid());
create policy proprio on public.avaliador_especialidades for select to authenticated using (avaliador_id = auth.uid());

-- ---- Empresas -------------------------------------------------------
create policy membro on public.empresas for select to authenticated using (public.is_membro_empresa(id));
create policy admin_empresa_editar on public.empresas for update to authenticated
  using (public.is_admin_empresa(id)) with check (public.is_admin_empresa(id));

create policy membro on public.membros_empresa for select to authenticated using (public.is_membro_empresa(empresa_id));
create policy admin_empresa_gerir on public.membros_empresa for all to authenticated
  using (public.is_admin_empresa(empresa_id)) with check (public.is_admin_empresa(empresa_id));

create policy membro on public.assinaturas        for select to authenticated using (public.is_membro_empresa(empresa_id));
create policy membro on public.movimentos_credito for select to authenticated using (public.is_membro_empresa(empresa_id));
create policy membro on public.cobrancas          for select to authenticated using (public.is_membro_empresa(empresa_id));

-- ---- Demandas -------------------------------------------------------
create policy membro on public.demandas for select to authenticated using (public.is_membro_empresa(empresa_id));
create policy membro_criar on public.demandas for insert to authenticated
  with check (public.is_membro_empresa(empresa_id) and criada_por = auth.uid() and status = 'aberta');
create policy membro_editar on public.demandas for update to authenticated
  using (public.is_membro_empresa(empresa_id) and status = 'aberta')
  with check (public.is_membro_empresa(empresa_id) and status in ('aberta', 'cancelada'));

create policy membro on public.demanda_competencias for select to authenticated
  using (exists (select 1 from public.demandas d where d.id = demanda_id and public.is_membro_empresa(d.empresa_id)));
create policy membro_gerir on public.demanda_competencias for all to authenticated
  using (exists (select 1 from public.demandas d where d.id = demanda_id
                  and d.status = 'aberta' and public.is_membro_empresa(d.empresa_id)))
  with check (exists (select 1 from public.demandas d where d.id = demanda_id
                  and d.status = 'aberta' and public.is_membro_empresa(d.empresa_id)));

-- ---- Indicações -----------------------------------------------------
-- Empresa vê indicações enviadas (não as "sugeridas" internas do curador).
-- Os dados do profissional vêm pela função shortlist_anonima().
create policy membro on public.indicacoes for select to authenticated
  using (status <> 'sugerido'
         and exists (select 1 from public.demandas d where d.id = demanda_id and public.is_membro_empresa(d.empresa_id)));
-- Profissional vê convites que recebeu.
create policy profissional on public.indicacoes for select to authenticated
  using (profissional_id = auth.uid() and status <> 'sugerido');
-- Mudanças de status (solicitar contato, aceitar, contratar) passam por rotas do servidor.

-- ---- LGPD -----------------------------------------------------------
create policy proprio on public.consentimentos for select to authenticated using (user_id = auth.uid());
create policy proprio_registrar on public.consentimentos for insert to authenticated with check (user_id = auth.uid());
-- logs_auditoria: somente admin (política admin_tudo) e servidor.

-- ---- Execução das funções ------------------------------------------
revoke execute on function public.shortlist_anonima(uuid) from public, anon;
revoke execute on function public.saldo_creditos(uuid)   from public, anon;
grant  execute on function public.shortlist_anonima(uuid) to authenticated;
grant  execute on function public.saldo_creditos(uuid)   to authenticated;
