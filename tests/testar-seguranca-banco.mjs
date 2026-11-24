import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const projeto = process.argv[2];
const db = new PGlite();
let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FALHA'} ${msg}`); if (!cond) falhas++; };

// ---- Simulação mínima do ambiente Supabase ----
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`);

await db.exec(readFileSync(join(projeto, 'supabase/migrations/20261122000001_schema_inicial.sql'), 'utf8'));
console.log('OK   migração 1 aplicada');
await db.exec(readFileSync(join(projeto, 'supabase/seed.sql'), 'utf8'));
console.log('OK   seed aplicado');
await db.exec(readFileSync(join(projeto, 'supabase/migrations/20261122000002_fase1.sql'), 'utf8'));
console.log('OK   migração 2 aplicada');
await db.exec(readFileSync(join(projeto, 'supabase/migrations/20261124000003_lgpd_mfa.sql'), 'utf8'));
console.log('OK   migração 3 aplicada');

const q = async (sql, p) => (await db.query(sql, p)).rows;
const comoUsuario = async (uid, fn, aal = 'aal1') => {
  const claims = JSON.stringify({ sub: uid, aal, role: 'authenticated' });
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${claims}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role;`); }
};
const falha = async (fn) => { try { await fn(); return false; } catch { return true; } };

// ---- Cenário ----
const U = {
  admin: '00000000-0000-0000-0000-00000000000a', emp: '00000000-0000-0000-0000-00000000000e',
  emp2: '00000000-0000-0000-0000-0000000000e2',
  A: '00000000-0000-0000-0000-0000000000a1', B: '00000000-0000-0000-0000-0000000000b1',
  C: '00000000-0000-0000-0000-0000000000c1', aval: '00000000-0000-0000-0000-0000000000d1',
};
const meta = { admin: { nome: 'Admin', papel: 'admin' }, emp: { nome: 'Recrutadora', papel: 'empresa' },
  emp2: { nome: 'Outra Empresa', papel: 'empresa' },
  A: { nome: 'Ana', ip: '200.1.2.3', consentimentos: { versao: '2026-11', termos_uso: true, ofertas_treinamento: true } },
  B: { nome: 'Bruno', ip: 'lixo', consentimentos: { versao: '2026-11', termos_uso: true, ofertas_treinamento: false } },
  C: { nome: 'Carla' },
  aval: { nome: 'Avaliador' } };
for (const [k, id] of Object.entries(U))
  await q(`insert into auth.users values ($1, $2, $3)`, [id, `${k}@teste.com`, JSON.stringify(meta[k])]);

const papelAdmin = (await q(`select papel from public.perfis where id=$1`, [U.admin]))[0].papel;
ok(papelAdmin === 'profissional', 'cadastro pedindo papel "admin" vira "profissional" (não dá para se autopromover)');
const cons = await q(`select p.nome, c.tipo, c.aceito from public.consentimentos c join public.perfis p on p.id=c.user_id order by 1,2`);
ok(cons.length === 6, `consentimentos registrados no cadastro (${cons.length} = 3 da Ana + 3 do Bruno)`);
ok(cons.some(c => c.nome === 'Bruno' && c.tipo === 'ofertas_treinamento' && c.aceito === false), 'recusa de ofertas também fica registrada');
ok((await q(`select count(*)::int n from storage.buckets where id='documentos' and public=false`))[0].n === 1, 'bucket privado "documentos" criado');
await q(`update public.perfis set papel='admin' where id=$1`, [U.admin]);
await q(`update public.perfis set papel='avaliador' where id=$1`, [U.aval]);

const esp = (await q(`select id from public.especialidades where slug='totvs-rm'`))[0].id;
const comp = (await q(`select id from public.competencias where slug='labore'`))[0].id;
for (const p of [U.A, U.B, U.C])
  await q(`insert into public.profissionais (id, titulo, uf, status) values ($1, 'Consultor RM', 'SP', 'aprovado')`, [p]);
await q(`insert into public.competencias_profissional values ($1,$2,'senior',8,'senior',85,now())`, [U.A, comp]);
await q(`insert into public.avaliadores (id, aprovado) values ($1, true)`, [U.aval]);
const [{ id: av }] = await q(`insert into public.avaliacoes (profissional_id, especialidade_id, avaliador_id, status, nota_final, nivel_atribuido, parecer)
  values ($1,$2,$3,'concluida',85,'senior','Domina folha e eSocial') returning id`, [U.A, esp, U.aval]);
await q(`insert into public.selos (profissional_id, especialidade_id, avaliacao_id, nivel, nota_final, valido_ate)
  values ($1,$2,$3,'senior',85, now() + interval '12 months')`, [U.A, esp, av]);

const [{ id: empresa }] = await q(`insert into public.empresas (cnpj, razao_social) values ('12345678000199','Empresa X') returning id`);
const [{ id: empresa2 }] = await q(`insert into public.empresas (cnpj, razao_social) values ('99999999000199','Empresa Y') returning id`);
await q(`insert into public.membros_empresa values ($1,$2,'admin')`, [empresa, U.emp]);
await q(`insert into public.membros_empresa values ($1,$2,'admin')`, [empresa2, U.emp2]);
const [{ id: dem }] = await q(`insert into public.demandas (empresa_id, criada_por, titulo, especialidade_id, vinculo, modelo_cobranca)
  values ($1,$2,'Consultor Labore',$3,'pj','creditos') returning id`, [empresa, U.emp, esp]);
await q(`insert into public.indicacoes (demanda_id, profissional_id, status, contato_liberado_em) values ($1,$2,'aceito_profissional', now())`, [dem, U.A]);
await q(`insert into public.indicacoes (demanda_id, profissional_id, status) values ($1,$2,'enviado_empresa')`, [dem, U.B]);
await q(`insert into public.indicacoes (demanda_id, profissional_id, status) values ($1,$2,'sugerido')`, [dem, U.C]);
await q(`insert into public.questoes (competencia_id, nivel, enunciado, alternativas, resposta_correta) values ($1,'pleno','?','[]','A')`, [comp]);
await q(`insert into public.movimentos_credito (empresa_id, quantidade, motivo) values ($1, 5, 'compra'), ($1, -1, 'shortlist')`, [empresa]);

// ---- Testes de segurança: EMPRESA ----
await comoUsuario(U.emp, async () => {
  const perfis = (await q(`select nome from public.perfis order by nome`)).map(r => r.nome);
  ok(JSON.stringify(perfis) === JSON.stringify(['Ana', 'Recrutadora']), `empresa vê só a si mesma e o contato liberado (Ana): ${perfis}`);
  const profs = await q(`select id from public.profissionais`);
  ok(profs.length === 1 && profs[0].id === U.A, 'empresa só lê a ficha completa de quem liberou contato');
  const sl = await q(`select nome, email, nivel, nota_final, parecer, competencias from public.shortlist_anonima($1) order by nota_final nulls last`, [dem]);
  ok(sl.length === 2, `shortlist mostra 2 enviados e esconde o "sugerido" interno (${sl.length})`);
  ok(sl[0].nome === 'Ana' && sl[0].nivel === 'senior' && sl[0].parecer, 'Ana: nome, nível e parecer visíveis');
  ok(sl[1].nome === null && sl[1].email === null, 'Bruno: nome e e-mail ocultos (ainda não aceitou)');
  ok((await q(`select * from public.questoes`)).length === 0, 'empresa não lê o banco de questões');
  ok((await q(`select public.saldo_creditos($1) s`, [empresa]))[0].s === 4, 'saldo de créditos = 4');
  ok(await falha(() => q(`update public.indicacoes set status='contratado' where demanda_id=$1`, [dem]))
     || (await q(`select count(*)::int n from public.indicacoes where status='contratado'`))[0].n === 0,
     'empresa não altera status da indicação direto pelo navegador');
});

// ---- Outra empresa não vê nada da Empresa X ----
await comoUsuario(U.emp2, async () => {
  ok((await q(`select * from public.demandas`)).length === 0, 'outra empresa não vê demandas alheias');
  ok((await q(`select * from public.shortlist_anonima($1)`, [dem])).length === 0, 'outra empresa não vê a shortlist alheia');
  ok((await q(`select public.saldo_creditos($1) s`, [empresa]))[0].s === null, 'outra empresa não vê saldo alheio');
});

// ---- Testes de segurança: PROFISSIONAL ----
await comoUsuario(U.B, async () => {
  ok((await q(`select * from public.profissionais`)).length === 1, 'profissional só vê o próprio perfil');
  await falha(() => q(`update public.perfis set papel='admin' where id=$1`, [U.B]));
  await falha(() => q(`update public.profissionais set status='aprovado' where id=$1`, [U.B]));
  ok(await falha(() => q(`insert into public.competencias_profissional (profissional_id, competencia_id, nivel_declarado, nivel_validado, nota_validada)
     values ($1,$2,'senior','especialista',100)`, [U.B, comp])), 'profissional não consegue gravar nota validada');
  ok(await falha(() => q(`insert into public.selos (profissional_id, especialidade_id, avaliacao_id, nivel, nota_final, valido_ate)
     values ($1,$2,$3,'especialista',100, now())`, [U.B, esp, av])), 'profissional não consegue emitir selo');
  ok((await q(`select * from public.questoes`)).length === 0, 'profissional não lê o gabarito');
  ok((await q(`select * from public.indicacoes`)).length === 1, 'profissional vê o convite recebido');
});
ok((await q(`select papel from public.perfis where id=$1`, [U.B]))[0].papel === 'profissional', 'profissional não se promove a admin');

await comoUsuario(U.C, async () => {
  ok((await q(`select * from public.indicacoes`)).length === 0, 'indicação ainda "sugerida" fica invisível ao profissional');
});

// ---- Operações feitas pelas telas com o login do próprio usuário ----
const novo = '00000000-0000-0000-0000-0000000000f1';
await q(`insert into auth.users values ($1, 'novo@teste.com', '{"nome":"Novo"}')`, [novo]);
await comoUsuario(novo, async () => {
  ok(!(await falha(() => q(`insert into public.profissionais (id, titulo, status) values ($1, 'Consultor RM', 'rascunho')`, [novo]))),
     'profissional novo cria o próprio perfil');
  ok(await falha(() => q(`insert into public.profissionais (id, titulo, status) values ($1, 'x', 'aprovado')`, [U.C])),
     'não cria perfil em nome de outra pessoa');
  await q(`update public.profissionais set titulo='Consultor RM Labore' where id=$1`, [novo]);
  ok((await q(`select titulo from public.profissionais where id=$1`, [novo]))[0].titulo === 'Consultor RM Labore', 'profissional edita o próprio perfil');
  await q(`update public.profissionais set status='aprovado' where id=$1`, [novo]).catch(() => {});
  ok((await q(`select status from public.profissionais where id=$1`, [novo]))[0].status === 'rascunho', 'profissional não se autoaprova');
  await q(`insert into public.competencias_profissional (profissional_id, competencia_id, nivel_declarado, anos_experiencia) values ($1,$2,'senior',5)`, [novo, comp]);
  await q(`delete from public.competencias_profissional where profissional_id=$1 and nivel_validado is null`, [novo]);
  ok((await q(`select * from public.competencias_profissional`)).length === 0, 'profissional declara e remove competências não validadas');
  await q(`insert into public.consentimentos (user_id, tipo, versao, aceito) values ($1,'ofertas_treinamento','2026-11',false)`, [novo]);
  ok((await q(`select * from public.consentimentos`)).length === 1, 'profissional registra revogação de consentimento');
});
await comoUsuario(U.A, async () => {
  const antes = (await q(`select count(*)::int n from public.competencias_profissional`))[0].n;
  await q(`delete from public.competencias_profissional where profissional_id=$1`, [U.A]);
  const depois = (await q(`select count(*)::int n from public.competencias_profissional`))[0].n;
  ok(antes === 1 && depois === 1, 'competência já validada não pode ser apagada pelo profissional');
});
await comoUsuario(U.emp, async () => {
  const [{ id: d2 }] = await q(`insert into public.demandas (empresa_id, criada_por, titulo, especialidade_id, vinculo, modelo_cobranca)
    values ($1,$2,'Analista Chronus',$3,'clt','success_fee') returning id`, [empresa, U.emp, esp]);
  await q(`insert into public.demanda_competencias (demanda_id, competencia_id, nivel_minimo, obrigatoria) values ($1,$2,'pleno',true)`, [d2, comp]);
  ok((await q(`select * from public.demanda_competencias where demanda_id=$1`, [d2])).length === 1, 'empresa cria demanda com competências');
  ok(await falha(() => q(`insert into public.demandas (empresa_id, criada_por, titulo, especialidade_id, vinculo, modelo_cobranca)
    values ($1,$2,'invasão',$3,'clt','creditos')`, [empresa2, U.emp, esp])), 'empresa não cria demanda em nome de outra');
  await q(`update public.demandas set status='shortlist_enviada' where id=$1`, [d2]).catch(() => {});
  ok((await q(`select status from public.demandas where id=$1`, [d2]))[0].status === 'aberta', 'empresa não muda status da demanda para "enviada"');
  await q(`update public.demandas set status='cancelada' where id=$1`, [d2]);
  ok((await q(`select status from public.demandas where id=$1`, [d2]))[0].status === 'cancelada', 'empresa cancela a própria demanda');
  const emb = await q(`select d.titulo, (select count(*)::int from public.indicacoes i where i.demanda_id=d.id) n from public.demandas d where d.id=$1`, [dem]);
  ok(emb[0].n === 2, 'contagem de indicados da empresa ignora as "sugeridas"');
});

// ---- AVALIADOR ----
await comoUsuario(U.aval, async () => {
  const p = await q(`select id from public.profissionais`);
  ok(p.length === 1 && p[0].id === U.A, 'avaliador vê só quem ele avalia');
});

// ---- ADMIN ----
await comoUsuario(U.admin, async () => {
  ok((await q(`select * from public.profissionais`)).length === 0, 'admin SEM 2ª etapa (aal1) não vê nada no banco');
  ok((await q(`select * from public.questoes`)).length === 0, 'admin SEM 2ª etapa não lê o gabarito');
}, 'aal1');
await comoUsuario(U.admin, async () => {
  ok((await q(`select * from public.profissionais`)).length === 4, 'admin COM 2ª etapa (aal2) vê todos os profissionais');
  ok((await q(`select * from public.questoes`)).length === 1, 'admin COM 2ª etapa lê o banco de questões');
  await q(`select * from public.vw_lacunas_competencia`);
}, 'aal2');

// ---- Consentimentos atuais ----
await comoUsuario(U.B, async () => {
  await q(`insert into public.consentimentos (user_id, tipo, versao, aceito) values ($1,'ofertas_treinamento','2026-11',true)`, [U.B]);
  const atual = await q(`select tipo, aceito from public.vw_consentimentos_atuais where tipo='ofertas_treinamento'`);
  ok(atual.length === 1 && atual[0].aceito === true, 'view mostra só o consentimento mais recente do próprio usuário');
});

// ---- LGPD: exclusão de conta ----
const [{ id: indA }] = await q(`select id from public.indicacoes where profissional_id=$1`, [U.A]);
await q(`insert into public.cobrancas (empresa_id, tipo, indicacao_id, valor_centavos, vencimento) values ($1,'success_fee',$2,100000,current_date)`, [empresa, indA]);
ok(!(await falha(() => q(`delete from auth.users where id=$1`, [U.A]))), 'profissional com indicação e cobrança consegue excluir a conta');
ok((await q(`select count(*)::int n from public.perfis where id=$1`, [U.A]))[0].n === 0, 'dados pessoais do profissional removidos');
ok((await q(`select count(*)::int n from public.selos where profissional_id=$1`, [U.A]))[0].n === 0, 'selos e avaliações do profissional removidos');
ok((await q(`select indicacao_id from public.cobrancas where empresa_id=$1`, [empresa]))[0].indicacao_id === null, 'cobrança da empresa preservada (sem vínculo com a pessoa)');
ok(!(await falha(() => q(`delete from auth.users where id=$1`, [U.aval]))), 'avaliador consegue excluir a conta');
ok(!(await falha(() => q(`delete from auth.users where id=$1`, [U.emp]))), 'usuário de empresa que criou demandas consegue excluir a conta');
ok((await q(`select count(*)::int n from public.demandas where empresa_id=$1`, [empresa]))[0].n === 2, 'demandas da empresa preservadas');

// ---- ANÔNIMO (visitante do site) ----
await db.exec(`set role anon; select set_config('request.jwt.claims', '', false);`);
ok((await q(`select * from public.competencias`)).length === 14, 'visitante vê o catálogo de competências');
ok((await q(`select * from public.profissionais`)).length === 0, 'visitante não vê profissionais');
ok(await falha(() => q(`select * from public.shortlist_anonima($1)`, [dem])), 'visitante não executa shortlist');
await db.exec(`reset role;`);

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTodos os testes passaram.');
process.exit(falhas ? 1 : 0);
