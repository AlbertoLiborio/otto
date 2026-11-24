# Publicar o Otto (Vercel + domínio na HostGator)

Como fica:

| Peça | Onde |
|---|---|
| Código | GitHub (repositório **privado**) |
| Site | Vercel (região São Paulo, `gru1`) |
| Banco, login, arquivos | Supabase |
| Domínio e e-mails do domínio | Continuam na HostGator. Só 2 registros DNS mudam |
| E-mails de aviso | Resend |

Faça na ordem. Nenhuma senha ou chave secreta deve ser enviada por chat: elas só são coladas nos painéis.

---

## 0. Antes: Supabase pronto
Siga o passo **1. Supabase** do [README](../README.md): criar o projeto em São Paulo e rodar os 4 arquivos SQL.
Anote (Project Settings > API): **Project URL**, **anon key** e **service_role key**.

## 1. GitHub
1. Crie a conta em github.com.
2. Clique em **New repository**:
   - Nome `otto`, **Private**.
   - **Não** marque README, .gitignore nem licença.
3. Copie o endereço do repositório (ex.: `https://github.com/SEU-USUARIO/otto.git`).
4. Na pasta do projeto, rode:
   ```
   git remote add origin https://github.com/SEU-USUARIO/otto.git
   git push -u origin main
   ```
   Na primeira vez, o Windows abre o navegador para você entrar no GitHub.

## 2. Vercel
1. Crie a conta em vercel.com usando **Continue with GitHub**.
2. Clique em **Add New > Project**, autorize o acesso ao repositório `otto` e clique em **Import**.
3. Framework: **Next.js** (detectado automaticamente). Não mude os comandos de build.
4. Abra **Environment Variables** e cole uma por uma:

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**secreta**) |
   | `NEXT_PUBLIC_SITE_URL` | `https://seudominio.com.br` (sem barra no final) |
   | `RESEND_API_KEY` | chave do Resend (**secreta**; pode deixar para depois) |
   | `EMAIL_REMETENTE` | `Otto <avisos@seudominio.com.br>` |

5. Clique em **Deploy**. Em 1 a 2 minutos o site abre num endereço `otto-xxxx.vercel.app`.

> Mudou alguma variável depois? Vá em **Deployments**, clique nos **…** do último e escolha **Redeploy**.
> Variáveis que começam com `NEXT_PUBLIC_` só passam a valer após um novo deploy.

## 3. Domínio (HostGator → Vercel)
1. Na Vercel, abra **Settings > Domains** e adicione `seudominio.com.br` e `www.seudominio.com.br`.
   A Vercel mostra os registros DNS que precisa. Normalmente são:

   | Tipo | Nome | Valor |
   |---|---|---|
   | A | `@` (domínio raiz) | `76.76.21.21` |
   | CNAME | `www` | `cname.vercel-dns.com` |

   **Use os valores exibidos pela Vercel**, se forem diferentes destes.
2. Na HostGator, abra **cPanel > Domínios > Zone Editor** (Editor de Zona) e clique em **Gerenciar** ao lado do domínio:
   - Edite o registro **A** do domínio raiz para o IP da Vercel.
   - Edite (ou crie) o **CNAME** `www`.
   - **Não mexa** nos registros **MX**, `mail`, `autodiscover` nem nos **TXT** de SPF/DKIM. São eles que mantêm seus e-mails funcionando.
3. Espere a Vercel mostrar **Valid Configuration**. Pode levar de minutos a algumas horas. O HTTPS é ativado sozinho.

> Se o domínio estiver registrado na HostGator mas os **nameservers** apontarem para outro lugar (Registro.br, Cloudflare), faça a mesma alteração onde a zona DNS estiver.

## 4. Ajustes finais no Supabase
Abra **Authentication > URL Configuration**:
- **Site URL**: `https://seudominio.com.br`
- **Redirect URLs**: `https://seudominio.com.br/**`, `https://www.seudominio.com.br/**` e `http://localhost:3000/**`

Sem isso, os links de confirmação, convite e recuperação de senha mandam a pessoa para o endereço errado.

## 5. Resend (e-mails de aviso)
1. Em resend.com, abra **Domains > Add Domain**.
2. Copie os registros (TXT/MX de `send`, DKIM) para o mesmo **Zone Editor** da HostGator.
   São registros **novos**: não substituem os do seu e-mail atual.
3. Quando aparecer **Verified**, crie a API key, cole em `RESEND_API_KEY` na Vercel e faça **Redeploy**.

## 6. Plano da Vercel
- **Hobby (grátis)**: serve para testar. Os termos da Vercel não permitem uso comercial nesse plano.
- **Pro (US$ 20/mês, cerca de R$ 110)**: mude antes de cobrar a primeira empresa (Settings > Billing).

## Atualizações depois
Toda alteração enviada ao GitHub (`git push`) gera um novo deploy automático.
Antes de ir para o ar, cada alteração gera também um endereço de **pré-visualização** para você testar.
