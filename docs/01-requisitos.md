# Otto — Documento de Requisitos (v0.1)

> Status: **rascunho para aprovação** · Data: 22/11/2026
> Escopo do MVP: **somente TOTVS RM**, com banco de dados já preparado para outras áreas.

---

## 1. Visão do produto

O **Otto** é uma plataforma de **indicação de profissionais com curadoria técnica**.
Profissionais se cadastram gratuitamente e passam por uma avaliação técnica (prova online,
caso prático e entrevista com avaliador parceiro). Empresas e consultorias abrem demandas e
recebem uma **shortlist** de profissionais já avaliados, pagando por assinatura, por pacote
de créditos ou por percentual na contratação.

As avaliações geram um mapa das **lacunas de conhecimento** do mercado, usado para
direcionar e vender cursos de especialização.

### Decisões já tomadas

| # | Tema | Decisão |
|---|------|---------|
| 1 | Cobrança das empresas | Três modelos convivem: **assinatura mensal**, **pacote de créditos** e **success fee** (% na contratação) |
| 2 | Tipos de vínculo | **CLT**, **PJ/projetos de consultoria** e **freelance** |
| 3 | Entrega para a empresa | **Shortlist curada** (a empresa não navega em catálogo) |
| 4 | Profissional | **Gratuito**, com aceite para receber ofertas de treinamentos |
| 5 | Avaliação | **Combinação**: prova online + caso prático + entrevista com **avaliador parceiro remunerado** |
| 6 | Registros profissionais | Verificação de **CRC, CREA, CRM** etc. nas áreas regulamentadas (fora do MVP, mas o banco já suporta) |
| 7 | Empresa Otto | Possui **CNPJ** e emite nota fiscal |
| 8 | Desenvolvimento | Claude desenvolve; o fundador testa e aprova cada fase |
| 9 | Orçamento de infraestrutura | **Até R$ 300/mês** |
| 11 | MVP | **Somente TOTVS RM** |

### Suposições (confirmar)

- **S1.** No MVP, o Otto **apenas indica**. O contrato e o pagamento do profissional são feitos
  diretamente entre empresa e profissional. Intermediar pagamento de PJ/freelance traz
  obrigações fiscais e jurídicas e fica para uma fase posterior, se desejado.
- **S2.** O success fee é calculado sobre o **1º salário** (CLT) ou sobre o **valor do contrato/
  1º mês** (PJ/freelance), informado pela empresa ao marcar o profissional como contratado.
- **S3.** O aceite de ofertas de treinamento é um **consentimento separado e destacado** no
  cadastro (exigência da LGPD), revogável a qualquer momento. *Validar redação com advogado.*
- **S4.** Selos técnicos valem **12 meses**; depois disso, o profissional refaz a avaliação.

---

## 2. Perfis de usuário

| Perfil | Quem é | Acesso principal |
|--------|--------|------------------|
| **Profissional** | Consultor, analista, desenvolvedor TOTVS RM | Perfil, avaliações, selos, convites de indicação |
| **Empresa (admin)** | Responsável da empresa/consultoria | Demandas, shortlists, plano, cobranças, usuários da empresa |
| **Empresa (usuário)** | Recrutador/gestor da empresa | Demandas e shortlists |
| **Avaliador parceiro** | Especialista remunerado por avaliação | Fila de avaliações, agenda, rubrica, extrato |
| **Admin Otto** | Você | Tudo: curadoria, banco de questões, financeiro, métricas |

---

## 3. Fluxos principais

### 3.1 Profissional
1. Cadastro (e-mail/senha, link mágico ou LinkedIn) + aceite de termos, privacidade e ofertas de treinamento.
2. Preenche perfil: resumo, cidade/UF, remoto, vínculos aceitos (CLT/PJ/freela), pretensão, LinkedIn, currículo (PDF).
3. Declara competências TOTVS RM (ex.: Labore, Chronus, Fluxus) com nível e anos de experiência.
4. **Etapa 1 — Prova online**: questões sorteadas do banco, com tempo limite. Nota mínima libera a etapa 2.
5. **Etapa 2 — Caso prático**: recebe um enunciado e envia a solução (arquivo/texto).
6. **Etapa 3 — Entrevista**: é atribuído a um avaliador parceiro, que agenda e conduz a conversa.
7. Recebe **nota por competência**, **nível validado** (Júnior/Pleno/Sênior/Especialista) e **selo** Otto.
8. Fica elegível para shortlists. Quando indicado, recebe convite e decide se **aceita liberar o contato** para a empresa.

### 3.2 Empresa
1. Cadastro com **CNPJ**, razão social e responsável. MFA obrigatório.
2. Escolhe forma de pagamento: assinatura, créditos ou success fee.
3. Abre uma **demanda**: título, vínculo, competências exigidas e nível mínimo, modalidade (remoto/presencial/híbrido), local, faixa de valor, descrição.
4. Recebe a **shortlist** com perfis **anonimizados** (sem nome e contato): competências, notas, nível, selo, parecer do avaliador.
5. Solicita contato de um candidato → profissional aceita → **nome e contato são liberados**.
6. Informa o resultado (contratado / não selecionado). Se success fee, a cobrança é gerada.
7. Avalia a indicação (feedback 1–5 + comentário), alimentando a qualidade da curadoria.

### 3.3 Avaliador parceiro
1. Cadastro por convite do admin; admin aprova e define especialidades e valor por avaliação.
2. Vê fila de avaliações atribuídas, agenda entrevistas, lê o caso prático.
3. Preenche **rubrica**: nota por competência, nível, parecer escrito.
4. Vê extrato de avaliações concluídas e status de pagamento.

### 3.4 Admin Otto
1. Gerencia áreas, especialidades, competências e **banco de questões**.
2. Aprova avaliadores e atribui avaliações.
3. Verifica registros profissionais (CRC/CREA/CRM) quando a área exigir.
4. Faz a **curadoria**: para cada demanda, vê sugestões de profissionais (filtro por competência/nível/vínculo/local) e monta a shortlist.
5. Gerencia planos, créditos, cobranças e notas fiscais.
6. Acompanha o **painel de lacunas** (base para os cursos) e métricas do negócio.

---

## 4. Requisitos funcionais

Legenda de fase: **F1** = MVP · **F2** = Monetização · **F3** = Inteligência · **F4** = Expansão

### Acesso e conta
| ID | Requisito | Fase |
|----|-----------|------|
| RF01 | Cadastro e login por e-mail/senha e link mágico | F1 |
| RF02 | Login com LinkedIn | F1 |
| RF03 | MFA obrigatório para admin e empresas; opcional para profissionais | F1 |
| RF04 | Recuperação de senha | F1 |
| RF05 | Registro de consentimentos com versão do termo, data e IP | F1 |
| RF06 | Profissional pode exportar e excluir seus dados (LGPD) | F1 |

### Profissional
| ID | Requisito | Fase |
|----|-----------|------|
| RF10 | Perfil com dados profissionais e currículo em PDF | F1 |
| RF11 | Declaração de competências com nível e anos de experiência | F1 |
| RF12 | Prova online com questões sorteadas, tempo limite e correção automática | F1 |
| RF13 | Envio de caso prático | F1 |
| RF14 | Acompanhamento do status da avaliação | F1 |
| RF15 | Visualização de notas, nível e selo, com validade | F1 |
| RF16 | Convite de indicação com aceite/recusa de liberação de contato | F1 |
| RF17 | Selo público compartilhável (link/imagem para LinkedIn) | F2 |
| RF18 | Recomendação de cursos com base nas lacunas individuais | F4 |

### Empresa
| ID | Requisito | Fase |
|----|-----------|------|
| RF20 | Cadastro de empresa com CNPJ e múltiplos usuários | F1 |
| RF21 | Abertura e acompanhamento de demandas | F1 |
| RF22 | Visualização da shortlist anonimizada | F1 |
| RF23 | Solicitação de contato e liberação após aceite do profissional | F1 |
| RF24 | Registro de resultado (contratado/não selecionado) e feedback | F1 |
| RF25 | Assinatura mensal, compra de créditos e success fee com pagamento online (PIX/boleto/cartão) | F2 |
| RF26 | Histórico de cobranças e notas fiscais | F2 |

### Avaliador
| ID | Requisito | Fase |
|----|-----------|------|
| RF30 | Fila de avaliações atribuídas | F1 |
| RF31 | Rubrica de avaliação por competência com parecer | F1 |
| RF32 | Agendamento de entrevista (link de videochamada) | F1 |
| RF33 | Extrato de avaliações e pagamentos | F2 |

### Admin
| ID | Requisito | Fase |
|----|-----------|------|
| RF40 | Cadastro de áreas, especialidades e competências | F1 |
| RF41 | Banco de questões por competência e nível (com importação por planilha) | F1 |
| RF42 | Configuração de provas (nº de questões, tempo, nota mínima) | F1 |
| RF43 | Gestão de avaliadores e atribuição de avaliações | F1 |
| RF44 | Curadoria: busca de profissionais e montagem de shortlist | F1 |
| RF45 | Gestão de planos, créditos e cobranças manuais | F1 |
| RF46 | Verificação de registros profissionais (CRC/CREA/CRM) | F4 |
| RF47 | Painel de lacunas por competência (% de erro, nota média, nível) | F3 |
| RF48 | Sugestão automática de candidatos por IA para cada demanda | F3 |
| RF49 | Painel de métricas do negócio (demandas, contratações, receita, NPS) | F3 |
| RF50 | Log de auditoria (quem viu qual perfil, alterações de nota) | F1 |

### Comunicação
| ID | Requisito | Fase |
|----|-----------|------|
| RF60 | E-mails transacionais (cadastro, convite, shortlist, resultado) | F1 |
| RF61 | Avisos por WhatsApp (API oficial) | F3 |
| RF62 | Envio de ofertas de treinamento para quem consentiu | F4 |

---

## 5. Regras de negócio

- **RN01 — Anonimização.** A empresa nunca vê nome, e-mail, telefone, LinkedIn ou currículo
  antes de o profissional aceitar a liberação de contato para aquela demanda.
- **RN02 — Elegibilidade.** Só entra em shortlist quem tem selo válido na especialidade da demanda.
- **RN03 — Prova.** Questões sorteadas por competência e nível; ordem embaralhada; o gabarito
  nunca é enviado ao navegador; a prova expira no tempo limite.
- **RN04 — Nova tentativa.** Reprovado na prova pode tentar de novo após 30 dias.
- **RN05 — Nota final.** Média ponderada: prova 30% · caso prático 30% · entrevista 40% (ajustável).
- **RN06 — Níveis.** Júnior < 60 · Pleno 60–74 · Sênior 75–89 · Especialista ≥ 90 (ajustável).
- **RN07 — Créditos.** Cada shortlist enviada consome créditos (quantidade definida por plano).
- **RN08 — Success fee.** Gerado quando a empresa marca um indicado como contratado.
- **RN09 — Conflito de interesse.** Avaliador não avalia profissional da mesma empresa em que trabalha.
- **RN10 — Validade.** Selo expira em 12 meses.

---

## 6. Requisitos não funcionais

| ID | Requisito |
|----|-----------|
| RNF01 | **LGPD**: consentimento registrado, finalidade clara, exportação/exclusão, encarregado (DPO) indicado |
| RNF02 | **Segurança no banco**: Row Level Security em todas as tabelas; cada perfil só lê o que é seu |
| RNF03 | Arquivos (currículos, casos práticos) em armazenamento privado com links temporários |
| RNF04 | HTTPS, senhas com hash, MFA, limite de tentativas de login, proteção contra robôs |
| RNF05 | Backups diários do banco |
| RNF06 | Interface em português, responsiva (celular primeiro) |
| RNF07 | Multiárea: novas áreas/especialidades entram por cadastro, sem mudar código |
| RNF08 | Custo de infraestrutura dentro de R$ 300/mês no início |

---

## 7. Fora do escopo do MVP

- Áreas além de ERP/TOTVS RM (contabilidade, saúde, educação, engenharia)
- Verificação de registros em conselhos
- Pagamento automatizado (no MVP a cobrança pode ser manual/PIX)
- Intermediação de pagamento ao profissional
- WhatsApp automatizado, IA de matching, plataforma de cursos

---

## 8. Pendências para o fundador

1. Confirmar suposições **S1 a S4**.
2. Definir **preços**: valor da assinatura, preço do crédito, quantos créditos por shortlist, % do success fee.
3. Definir **valor pago ao avaliador** por avaliação.
4. Enviar **domínio** e **arquivos do logo** (SVG ou PNG em alta).
5. Validar textos de **Termos de Uso** e **Política de Privacidade** com advogado.
