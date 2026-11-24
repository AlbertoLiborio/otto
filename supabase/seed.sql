-- =====================================================================
-- Otto — Dados iniciais
-- =====================================================================

-- Áreas (só ERP ativa no MVP; as demais já ficam cadastradas)
insert into public.areas (slug, nome, exige_registro_conselho, conselhos_aceitos, ativa) values
  ('erp',           'ERP e Sistemas de Gestão', false, '{}',                       true),
  ('contabilidade', 'Contabilidade',            true,  '{CRC}',                    false),
  ('saude',         'Saúde',                    true,  '{CRM,COREN,CRF,CREFITO}',  false),
  ('educacao',      'Educação',                 false, '{}',                       false),
  ('engenharia',    'Engenharia e Arquitetura', true,  '{CREA,CAU}',               false);

insert into public.especialidades (area_id, slug, nome)
select id, 'totvs-rm', 'TOTVS RM' from public.areas where slug = 'erp';

insert into public.competencias (especialidade_id, slug, nome, descricao)
select e.id, c.slug, c.nome, c.descricao
  from public.especialidades e
 cross join (values
  ('labore',        'RM Labore (Folha de Pagamento)', 'Cálculo de folha, eventos, fórmulas, encargos, férias, rescisão'),
  ('esocial',       'eSocial / EFD-Reinf / DCTFWeb',  'Eventos, mensageria, conferências e retificações'),
  ('chronus',       'RM Chronus (Ponto)',             'Jornadas, batidas, abonos, banco de horas, integração com folha'),
  ('vitae',         'RM Vitae (Recursos Humanos)',     'Cargos e salários, treinamentos, avaliação de desempenho, SESMT'),
  ('fluxus',        'RM Fluxus (Financeiro)',          'Contas a pagar/receber, CNAB, conciliação, fluxo de caixa'),
  ('nucleus',       'RM Nucleus (Estoque, Compras e Faturamento)', 'Movimentos, parametrização de tipos de movimento, cotação, faturamento'),
  ('liber',         'RM Liber (Fiscal)',               'Escrituração fiscal, SPED Fiscal e Contribuições'),
  ('saldus',        'RM Saldus (Contabilidade)',       'Lançamentos, integração contábil, SPED Contábil/ECF'),
  ('bonum',         'RM Bonum (Patrimônio)',           'Ativo imobilizado, depreciação, CIAP'),
  ('educacional',   'TOTVS Educacional',               'Gestão acadêmica, matrículas, financeiro educacional'),
  ('sql',           'SQL e Consultas no RM',           'Consultas SQL, relatórios, dicionário de dados'),
  ('formulas',      'Fórmulas e Visões do RM',         'Fórmulas visuais, sentenças, gatilhos'),
  ('integracoes',   'Integrações e APIs do RM',        'TBC, web services, API REST, fluxos'),
  ('infra',         'Infraestrutura e Instalação RM',  'Instalação, atualização, Host, licenças, performance')
 ) as c(slug, nome, descricao)
 where e.slug = 'totvs-rm';

insert into public.provas (especialidade_id, nome, num_questoes, tempo_limite_min, nota_minima)
select id, 'Prova técnica TOTVS RM', 30, 60, 60 from public.especialidades where slug = 'totvs-rm';

-- Planos (valores provisórios — definir com o fundador)
insert into public.planos (nome, tipo, preco_centavos, creditos_inclusos, creditos_por_shortlist, success_fee_percentual) values
  ('Assinatura Mensal',   'assinatura',  0, 3, 1, 0),
  ('Pacote de Créditos',  'creditos',    0, 5, 1, 0),
  ('Success Fee',         'success_fee', 0, 0, 0, 0);
