# Otto

Plataforma de indicação de profissionais com curadoria técnica.
Stack: **Next.js 15** + **Supabase** (PostgreSQL, Auth, Storage) + **Vercel** + **Resend** (e-mails).

## Estrutura

```
docs/                     Requisitos, contas/custos, questões de exemplo (CSV)
supabase/migrations/      Banco de dados (rodar em ordem)
supabase/seed.sql         Dados iniciais (áreas, competências TOTVS RM, planos)
src/app/(acesso)          Entrar, cadastro, esqueci minha senha, termos, privacidade
src/app/seguranca         Definir senha, login em duas etapas (ativar e verificar)
src/app/conta             Minha conta: 2 etapas, consentimentos, exportar e excluir dados
src/app/profissional      Perfil, competências, prova, caso prático, convites
src/app/empresa           Cadastro da empresa, demandas, shortlist, equipe
src/app/avaliador         Fila de avaliações, agendamento, rubrica
src/app/admin             Curadoria, avaliações, questões, avaliadores, empresas,
                          catálogo, preços e provas
src/lib/email.ts          Avisos por e-mail
tests/                    Testes de segurança do banco (sem precisar de Supabase)
```

## Como colocar no ar (primeira vez)

> Publicação na internet (GitHub + Vercel + domínio na HostGator): veja [docs/03-publicar-vercel.md](docs/03-publicar-vercel.md).

### 1. Supabase
1. Crie um projeto em supabase.com (região **South America (São Paulo)**).
2. Em **SQL Editor**, rode nesta ordem o conteúdo de:
   1. `supabase/migrations/20261122000001_schema_inicial.sql`
   2. `supabase/seed.sql`
   3. `supabase/migrations/20261122000002_fase1.sql`
   4. `supabase/migrations/20261124000003_lgpd_mfa.sql`
3. **Authentication > URL Configuration**
   - Site URL: `https://SEU-DOMINIO` (ou `http://localhost:3000` para testes)
   - Redirect URLs: `https://SEU-DOMINIO/**` e `http://localhost:3000/**`
4. **Authentication > Providers > Email**: senha mínima **10** caracteres.
5. **Authentication > Multi-Factor**: deixe **TOTP habilitado** (padrão).
6. **Authentication > Emails > Templates**: troque o link de cada modelo para o formato abaixo.
   Assim os links funcionam mesmo se a pessoa abrir o e-mail em outro aparelho, e o **convite de equipe** passa a funcionar
   (convites exigem este formato).

   | Modelo | Link (substitua o `{{ .ConfirmationURL }}`) |
   |---|---|
   | Confirm signup | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` |
   | Invite user | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` |
   | Magic Link | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` |
   | Reset Password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` |

7. **Authentication > Emails > SMTP Settings**: para produção, use o SMTP do Resend
   (host `smtp.resend.com`, porta 465, usuário `resend`, senha = sua API key). O SMTP padrão do Supabase
   envia poucos e-mails por hora e serve só para testes.
8. (Opcional) **LinkedIn (OIDC)**: crie um app em linkedin.com/developers e cole Client ID/Secret.

### 2. Resend (e-mails de aviso)
1. Crie a conta em resend.com e **verifique seu domínio** (registros DNS que eles indicam).
2. Gere uma API key e coloque em `RESEND_API_KEY`; defina `EMAIL_REMETENTE` (ex.: `Otto <avisos@seudominio.com.br>`).

Sem a chave, o sistema funciona normalmente e apenas registra no log que o e-mail não foi enviado.

### 3. Variáveis de ambiente
Copie `.env.example` para `.env.local` e preencha (Supabase em **Project Settings > API**).
`SUPABASE_SERVICE_ROLE_KEY` e `RESEND_API_KEY` são secretas: nunca as coloque no GitHub nem envie por chat.

### 4. Rodar no computador
```
npm install
npm run dev
```
Acesse http://localhost:3000.

### 5. Tornar-se administrador
Crie sua conta pelo site, confirme o e-mail e rode no SQL Editor:
```sql
update public.perfis set papel = 'admin' where email = 'SEU-EMAIL';
```
No próximo acesso o sistema pede para **ativar o login em duas etapas** (app autenticador no celular).
Sem a 2ª etapa, o banco não libera nenhum dado de administrador.

### 6. Primeiras configurações no painel admin
1. **Preços e provas**: defina valores dos planos, % do success fee e regras da prova.
2. **Questões**: importe `docs/questoes-exemplo-rm.csv` (revise antes!) e adicione as suas.
3. **Catálogo**: ajuste competências e o caso prático padrão do TOTVS RM.
4. **Avaliadores**: a pessoa cria conta no site; você informa o e-mail em Admin > Avaliadores.

## Segurança
- Row Level Security em todas as tabelas; gabarito das provas nunca vai ao navegador.
- Login em duas etapas **obrigatório** para admin, empresas e avaliadores (opcional para profissionais).
- Admin sem 2ª etapa verificada não tem acesso a nada no banco (regra no próprio PostgreSQL).
- Empresas veem perfis anonimizados; contato só após aceite do profissional.
- Log de auditoria de ações sensíveis (ver contato, notas, exportação, exclusão).
- LGPD: exportação dos dados em JSON, exclusão da conta, revogação de consentimento.

## Avisos por e-mail
| Quando | Quem recebe |
|---|---|
| Empresa abre demanda | Admins |
| Profissional envia caso prático | Admins |
| Admin atribui avaliador | Avaliador e profissional |
| Avaliador agenda entrevista | Profissional (data e link) |
| Avaliação concluída / selo emitido | Profissional |
| Shortlist enviada | Usuários da empresa |
| Empresa solicita contato | Profissional |
| Profissional aceita ou recusa | Usuários da empresa |
| Contratação registrada | Admins |
| Pessoa adicionada à equipe / virou avaliador | A própria pessoa |

## Testes
```
npm run test:banco   # 50 verificações de segurança e regras do banco
npm run typecheck
npm run build
```

## Fluxo completo
1. Profissional se cadastra → perfil → competências → **prova online** (correção automática)
2. Aprovado → envia **caso prático** → admin atribui **avaliador**
3. Avaliador agenda e faz a **entrevista** → dá notas → **selo** emitido (válido 12 meses)
4. Empresa se cadastra (CNPJ) → ativa 2 etapas → convida a equipe → abre **demanda**
5. Admin faz a **curadoria** (candidatos ordenados por aderência) → envia **shortlist** (consome créditos, se for o caso)
6. Empresa vê perfis **anonimizados** → solicita contato → profissional **aceita** → contato liberado
7. Empresa registra **contratação** → success fee gerado (se for o modelo da demanda)
