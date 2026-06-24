# CLAUDE.md — SyncroFlowEleições

> Documento de especificação completo para desenvolvimento do SyncroFlowEleições.
> Este é um SaaS eleitoral independente, derivado do SyncroFlow, com stack idêntico
> mas totalmente isolado: novo repositório GitHub, novo projeto Supabase, novo projeto
> Vercel, novo serviço EasyPanel, nova conta Stripe.
>
> **Prazo:** 10 dias para MVP funcional.
> **Base legal:** Resolução TSE nº 23.755, de 02/03/2026.

---

## ⚠️ AVISO CRÍTICO — LEIA ANTES DE TOCAR EM QUALQUER ARQUIVO

Este projeto é uma **cópia** da pasta do SyncroFlow original. Isso significa que
**todos os arquivos que você vai abrir contêm referências ao sistema mãe (SyncroFlow)**.
Essas referências estão erradas para este projeto e precisam ser substituídas.

### O risco que você DEVE evitar

O sistema mãe (SyncroFlow) está em produção com usuários reais.
**Se você deixar qualquer referência antiga apontando para os serviços do SyncroFlow,
você vai contaminar o sistema mãe** — apagar dados, sobrescrever configurações,
misturar usuários eleitorais com usuários comerciais. Isso é inaceitável.

**Regra absoluta:** Nunca aponte para nenhum serviço, URL, chave ou projeto
do SyncroFlow original. Cada serviço abaixo tem um substituto novo e exclusivo.

---

### Mapa de substituição obrigatória

Ao abrir qualquer arquivo `.env`, `.env.local`, `.env.production`, ou qualquer
arquivo de configuração, você vai encontrar variáveis apontando para o SyncroFlow.
Substitua tudo conforme a tabela abaixo:

| O que você vai encontrar no código | O que deve ser no SyncroFlowEleições |
|---|---|
| URL do projeto Supabase do SyncroFlow | Nova URL do projeto Supabase (conta nova) |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Novo valor — conta Supabase separada |
| `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Novas chaves — projeto Supabase novo |
| URL do Vercel / domínio do SyncroFlow | Novo domínio do SyncroFlowEleições |
| `NEXTAUTH_URL` apontando para syncroflow.* | Novo domínio electoral |
| Nome do projeto no Vercel | `syncroflow-eleicoes` (projeto Vercel novo) |
| Repositório GitHub do SyncroFlow | `syncroflow-eleicoes` (repositório novo) |
| Serviço EasyPanel do SyncroFlow | Novo serviço EasyPanel (VPS separado) |
| Variáveis Stripe do SyncroFlow (price IDs, product IDs) | Novos produtos/preços criados no Stripe para eleições |
| Webhooks Stripe apontando para URL do SyncroFlow | Novo webhook apontando para URL do SyncroFlowEleições |
| Nome do banco de dados / schema Supabase | Schema novo, criado do zero no projeto novo |
| Qualquer string `"syncroflow"` em nomes de tabela, bucket, storage | Substituir por `"syncroflow-eleicoes"` ou equivalente |

### Variáveis de ambiente que NÃO mudam

Estas variáveis podem ser reaproveitadas porque são credenciais da empresa, não do produto:

| Variável | Motivo para reaproveitar |
|---|---|
| `WHATSAPP_TOKEN` / `META_WABA_*` | Aprovação WABA é da empresa, não do produto |
| `META_APP_ID` / `META_APP_SECRET` | Mesmo app Meta pode servir múltiplos produtos |

> **Atenção:** Mesmo as variáveis Meta devem ser verificadas. Se o código usar
> um número de telefone ou WABA ID específico do SyncroFlow, o candidato eleitoral
> vai conectar o seu próprio número — então as variáveis de número/WABA do candidato
> virão do banco de dados, não do `.env`.

### Como proceder ao encontrar uma referência antiga

1. **Não delete** — substitua pelo novo valor correspondente
2. **Não assuma** que uma variável já está certa — verifique sempre
3. **Se não souber o novo valor** — deixe um comentário `// TODO: substituir pelo valor do SyncroFlowEleições` e continue. Não use o valor do SyncroFlow como temporário.
4. **Nunca faça commit** com valores do SyncroFlow original neste repositório

### Ordem de configuração recomendada

Antes de rodar qualquer código, configure os serviços na seguinte ordem:

1. **Supabase** — criar novo projeto em nova conta (`glaucio.sellect+eleicoes@gmail.com`)
2. **Variáveis de ambiente** — preencher `.env.local` com os novos valores
3. **Banco de dados** — rodar as migrations do schema novo no Supabase novo
4. **Stripe** — criar novos produtos/preços, configurar novo webhook
5. **Vercel** — criar projeto novo, conectar ao repositório `syncroflow-eleicoes`
6. **EasyPanel** — criar novo serviço na VPS, configurar variáveis de ambiente
7. **Testar** — só então iniciar o servidor de desenvolvimento

> Seguindo essa ordem, o código nunca vai "ligar" para o SyncroFlow original
> porque os serviços do SyncroFlowEleições já estarão prontos antes de qualquer execução.

---

## 1. VISÃO GERAL DO PRODUTO

O SyncroFlowEleições é um agente de atendimento inteligente exclusivo para campanhas
eleitorais. O candidato cadastra suas propostas, história de vida e agenda. O agente
responde eleitores 24h/7 nos canais digitais (WhatsApp, Instagram, Facebook, Telegram,
e-mail), registra solicitações, informa compromissos e gera relatórios estratégicos para
a equipe de campanha.

O agente NUNCA simula ser o candidato. SEMPRE se identifica como assistente virtual.
NUNCA recomenda voto. NUNCA responde fora do conteúdo cadastrado pelo candidato.

---

## 2. STACK TÉCNICO

Manter exatamente o mesmo stack do SyncroFlow original:

- **Frontend:** Next.js + Tailwind CSS
- **Backend:** Node.js / API Routes Next.js
- **Banco de dados:** Supabase (PostgreSQL) — NOVO projeto isolado
- **Autenticação:** Supabase Auth
- **Pagamentos:** Stripe (cartão de crédito + PIX)
- **Deploy frontend:** Vercel — NOVO projeto
- **Deploy backend/agente:** EasyPanel (VPS) — NOVO serviço
- **WhatsApp API:** Meta Cloud API (mesma aprovação WABA do SyncroFlow)
- **Agendamento:** Google Calendar API

---

## 3. O QUE REMOVER DO SYNCROFLOW ORIGINAL

Remover completamente os seguintes módulos e referências:

- [ ] Seção "Treinamento" do cadastro do agente
- [ ] "IA Tools" / ferramentas externas de IA
- [ ] "Lead Automático" do perfil
- [ ] "Descrição da Empresa"
- [ ] Módulo de Integrações EXCETO Google Calendar
- [ ] Templates de mensagem (seção Integrações)
- [ ] Módulo de Planos de Pagamento dentro do painel (substituído pelo fluxo de registro)
- [ ] Qualquer referência a "empresa", "negócio", "cliente comercial"
- [ ] Fluxos genéricos de vendas ou atendimento comercial

---

## 4. MÓDULOS E ESPECIFICAÇÕES

---

### 4.1 AUTENTICAÇÃO E REGISTRO

#### Tela de Login
- Campos: e-mail + senha
- Link "Esqueci minha senha"
- Botão "Criar conta" → redireciona para Registro
- Design: cores do Brasil (verde #009C3B, amarelo #FFDF00, azul #002776, branco)

#### Tela de Registro (fluxo completo)

**Passo 1 — Dados do candidato:**
- Nome completo *
- CPF * (validar formato)
- Número do candidato (número eleitoral, opcional neste momento)
- E-mail *
- WhatsApp * (com máscara)
- Senha * (mínimo 8 caracteres)
- Confirmar senha *
- Checkbox: "Li e aceito os Termos de Uso e a Política de Privacidade"
- Botão: AVANÇAR PARA PAGAMENTO

**Passo 2 — Pagamento (Stripe):**
- Exibir plano selecionado e valor
- Formas: Cartão de crédito (Stripe Elements) ou PIX (Stripe + geração de QR)
- Ao confirmar pagamento aprovado → redireciona para Dashboard
- Ao falhar → exibe erro e mantém na tela de pagamento

**Regras:**
- Conta criada no Supabase Auth somente após pagamento aprovado
- Status da conta: `ativo` / `suspenso` / `cancelado`
- Webhook Stripe atualiza status automaticamente

---

### 4.2 DASHBOARD PRINCIPAL

Visão geral ao entrar no sistema:

- **Status do Agente** (destaque visual, topo): ATIVO (verde) / PAUSADO (amarelo) / DESATIVADO-TSE (vermelho)
- Contador de conversas hoje / semana
- Últimas 5 conversas recentes com acesso rápido
- Solicitações abertas pendentes de encaminhamento
- Alerta de pico: se volume de mensagens sobre um tema estiver 30%+ acima da média, exibe banner de alerta
- Próximo compromisso da agenda
- Botão rápido: ATIVAR / PAUSAR agente
- Indicador de conformidade TSE (quantos dias até a próxima eleição / countdown para desativação automática)

---

### 4.3 CADASTRO DO AGENTE

#### Aba: Minha História (antes "Perfil" / "Comportamento")

- **Nome do agente** (como o assistente se apresentará: ex: "Assistente da Campanha de João Silva")
- **Função do agente** (texto curto: ex: "Assistente virtual de atendimento eleitoral")
- **Estilo de comunicação** (formal / informal / próximo e acolhedor)
- **Minha História** — campo de texto GRANDE (altura dobrada, mínimo 300px, com contador de caracteres). Aqui o candidato escreve sua trajetória de vida, motivações, conquistas, por que quer ser eleito. Este conteúdo é usado pelo agente para apresentar o candidato de forma humanizada.
- **Nome do Candidato** (campo — substitui "Nome da Empresa")
- **Site do Candidato** (campo URL)

**Remover:** Descrição da empresa, Lead automático.

#### Aba: Disclaimer de Apresentação

Campo editável pelo candidato com a mensagem que o agente envia na PRIMEIRA interação com qualquer eleitor desconhecido.

Modelo padrão (editável):
```
Olá! Sou o assistente virtual da campanha de [Nome do Candidato],
pré-candidato(a) a [Cargo] pelo [Partido].
Estou aqui para responder suas dúvidas sobre as propostas,
informar sobre eventos e registrar suas sugestões.
Como posso ajudar você hoje?
```

- Preview em tempo real do disclaimer
- Aviso: "Esta mensagem é obrigatória pela Resolução TSE nº 23.755/2026 e será enviada automaticamente na primeira mensagem de cada novo contato."
- Para contatos já conhecidos (histórico no banco), o disclaimer NÃO é enviado novamente.

#### Aba: Plataforma Eleitoral (antes "Intenções")

Campos fixos pré-definidos, cada um com:
- Título do tema (fixo, não editável)
- Área de texto grande para o candidato escrever suas propostas e soluções

**Temas fixos:**
1. Saúde
2. Segurança Pública
3. Educação
4. Economia e Emprego
5. Habitação e Urbanismo
6. Reforma Tributária
7. Infraestrutura e Mobilidade
8. Proteção Ambiental
9. Família e Valores
10. Transparência e Combate à Corrupção
11. Direitos Humanos e Inclusão
12. Tecnologia e Inovação
13. Agricultura e Agronegócio
14. Cultura e Esporte
15. Outras Propostas (campo livre)

O agente responde sobre qualquer tema SOMENTE se o candidato tiver preenchido aquele campo. Se o campo estiver vazio, o agente informa que vai encaminhar a dúvida para a equipe.

#### Aba: Fluxos (simplificado)

Manter fluxos mas com 3 fluxos-padrão já criados e editáveis:

1. **Fluxo: Pergunta fora do escopo** — quando eleitor pergunta algo não cadastrado → resposta padrão educada + encaminhamento
2. **Fluxo: Encerramento de conversa** — após X minutos sem resposta → mensagem de encerramento cordial
3. **Fluxo: Registro de solicitação** — quando eleitor faz um pedido/reclamação → confirmação de protocolo

#### Aba: Configuração

- Manter configurações existentes
- **VOZ**: manter funcionalidade completa (diferencial do produto)
- Velocidade de resposta
- Idioma
- Fuso horário

---

### 4.4 MEMÓRIA E CONTINUIDADE DE CONVERSA

**Regra fundamental:**

- Todo contato é identificado por número de WhatsApp / e-mail / ID de canal
- Na primeira interação: envia Disclaimer → registra contato no banco
- Nas interações seguintes: chama pelo nome, retoma contexto, NÃO reenvia disclaimer
- O agente tem acesso ao histórico completo de conversas do eleitor
- O agente sabe quais solicitações o eleitor já fez e qual o status de cada uma
- Se o eleitor retoma um assunto anterior, o agente reconhece: "Sobre sua solicitação do dia [X] sobre [tema]..."

**Estrutura no banco (tabela `contacts`):**
```
id, channel_id, channel_type, name, phone, email,
first_contact_at, last_contact_at, total_interactions,
is_known (boolean), notes (text)
```

**Estrutura no banco (tabela `requests`):**
```
id, contact_id, protocol_number, subject, description,
status (recebido|em_analise|encaminhado|resolvido),
created_at, updated_at, resolved_by
```

---

### 4.5 CHAT

#### Visualização
- Lista de conversas com filtro por canal (abas): Todos | WhatsApp | Instagram | Facebook | Telegram | E-mail
- Badge com contador de não lidos por aba
- Busca por nome, número ou palavra-chave
- Indicador visual de canal (ícone colorido por canal)
- Marcação de conversas urgentes (flag vermelha — ativada automaticamente pelo agente quando detecta tom agressivo ou situação sensível)

#### Dentro da conversa
- Histórico completo
- Informações do contato no painel lateral (nome, canal, total de interações, solicitações abertas)
- Botão: Assumir conversa (equipe humana assume o atendimento)
- Botão: Devolver para o agente
- Campo de resposta manual (quando equipe assumiu)
- Botão: Marcar como urgente

#### Transcrição de áudio
- Mensagens de voz recebidas são transcritas automaticamente
- Transcrição exibida abaixo do áudio na conversa
- Agente responde baseado na transcrição

---

### 4.6 CONTATOS

- Lista paginada de todos os contatos registrados
- Campos visíveis: Nome, Canal, Número/E-mail, Data do primeiro contato, Total de interações, Solicitações abertas
- Busca por nome ou número (como está no original)
- Ao clicar no contato: abre painel com histórico completo + todas as solicitações
- **Exportar CSV**: botão para exportar lista completa de contatos para uso da equipe de campanha
- **QR Code**: cada candidato tem QR Code gerado automaticamente apontando para o canal principal de atendimento. Disponível para download em alta resolução (para impressão em material de campanha)

---

### 4.7 AGENDA

**Finalidade:** o agente INFORMA compromissos, NUNCA agenda.

#### Cadastro de eventos (pela equipe/candidato)
- Data e hora
- Título do evento
- Local (endereço completo)
- Bairro / Cidade
- Descrição
- Link (para lives, transmissões)
- Tipo: Presencial | Online | Live | Debate | Reunião
- Público: Aberto ao público | Interno

#### Integração Google Calendar
- Conectar via OAuth a agenda do candidato
- Eventos marcados como "público" no Google Calendar são automaticamente importados
- Sincronização automática a cada 30 minutos
- O agente usa a agenda para responder perguntas sobre compromissos

#### Como o agente usa a agenda
- "Quando será o próximo evento?" → agente consulta agenda e informa
- "O candidato vai ao Bairro X?" → agente verifica e responde
- "Tem live esta semana?" → agente informa data, hora e link
- Para eventos futuros: eleitor pode solicitar lembrete → agente registra e envia mensagem no dia

---

### 4.8 INTEGRAÇÕES

**Manter apenas:**
- Google Calendar (spec na seção 4.7)

**Remover:**
- Todas as outras integrações
- Templates

---

### 4.9 RELATÓRIOS

Painel de relatórios completo com os seguintes relatórios:

#### Relatório 1: Visão Geral da Semana
- Total de conversas
- Novos contatos
- Solicitações registradas
- Taxa de resolução
- Comparativo com semana anterior (%) 

#### Relatório 2: Temas Mais Perguntados
- Ranking dos temas mais abordados pelos eleitores
- Gráfico de barras
- Filtro por período (7, 14, 30 dias)

#### Relatório 3: Mapa de Solicitações por Região
- Mapa visual ou tabela com solicitações agrupadas por bairro
- Permite identificar onde focar a agenda de rua

#### Relatório 4: Volume por Canal
- Gráfico comparativo: WhatsApp x Instagram x Facebook x Telegram x E-mail
- Identifica qual canal tem mais eleitores ativos

#### Relatório 5: Sentimento dos Eleitores
- Análise de sentimento das conversas: Positivo / Neutro / Negativo
- Gráfico por semana
- Alerta automático se negativo ultrapassar 30%

#### Relatório 6: Perguntas Sem Resposta (Gaps de Conteúdo)
- Lista de perguntas que o agente não conseguiu responder
- Indica quais temas da Plataforma Eleitoral precisam ser complementados

#### Relatório 7: Horários de Pico
- Mapa de calor por dia da semana e hora do dia
- Identifica quando os eleitores estão mais ativos

#### Relatório 8: Eleitores Mais Engajados
- Top 20 eleitores por número de interações
- Potenciais multiplicadores / líderes comunitários

#### Relatório 9: Evolução Semanal
- Gráfico de linha com crescimento de conversas ao longo do tempo
- Início da campanha até hoje

#### Relatório 10: Status das Solicitações
- Quantas solicitações por status: Recebido | Em análise | Encaminhado | Resolvido
- Lista detalhada com filtro por status
- Botão para marcar como resolvido diretamente do relatório

#### Briefing Automático
- Todo segundo-feira de manhã: e-mail automático para o candidato com resumo da semana anterior
- Inclui: volume, temas em alta, solicitações pendentes, alerta de gaps
- Pode ser ativado/desativado nas configurações

---

### 4.10 EQUIPE

#### Modelo de acesso por equipe

O candidato (dono da conta) é o **Administrador Master**. Ele pode convidar colaboradores com diferentes níveis de acesso.

#### Níveis de acesso

| Função | Minha História | Plataforma Eleitoral | Chat | Contatos | Agenda | Relatórios | Configurações | Equipe |
|---|---|---|---|---|---|---|---|---|
| **Administrador** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Atendimento** | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Conteúdo** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Relatórios** | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |

#### Fluxo de convite

1. Administrador vai em Equipe → "Convidar Colaborador"
2. Informa: nome, e-mail, função
3. Sistema envia e-mail com link de convite (válido por 48h)
4. Colaborador clica no link → define sua senha → acessa o sistema
5. Cada colaborador entra com seu próprio e-mail + senha
6. Administrador pode remover ou trocar a função a qualquer momento

**Tabela no banco (`team_members`):**
```
id, account_id, user_id, name, email, role, invited_at,
accepted_at, status (pending|active|removed)
```

---

### 4.11 CONFIGURAÇÕES

#### Aba: Perfil da Conta
- Nome completo do candidato
- **Número do candidato** (número eleitoral — novo campo)
- E-mail
- WhatsApp
- CPF
- Foto do candidato (upload)
- Partido político
- Cargo disputado
- Estado / Município

#### Aba: Canais
- Manter todos os canais: WhatsApp, Instagram, Facebook, Telegram, E-mail
- Instrução de conexão por canal

#### Aba: Chaves de API
- Manter seção
- Atualizar labels e descrições para contexto eleitoral
- Adicionar: chave Google Calendar

#### Aba: Compliance TSE
- **Desativação automática:** sistema desativa o agente automaticamente 72h antes de cada turno de eleição
- Datas configuradas pelo sistema (1º turno: 4 out 2026 / 2º turno: 25 out 2026)
- Countdown visível: "Agente será desativado em X dias Y horas (conformidade TSE)"
- Reativação: disponível somente após o pleito
- Log de auditoria: registro imutável de todas as conversas com timestamp (para defesa legal)

#### Aba: Modo Mandato
- Após a eleição, o candidato eleito pode ativar o "Modo Mandato"
- O agente se transforma em ouvidoria do mandato
- Novo disclaimer, novo contexto — mesma plataforma
- Upgrade de plano (preço diferente do plano de campanha)

---

### 4.12 SOLICITAÇÕES E PROTOCOLOS

- Toda solicitação registrada recebe número de protocolo automático (ex: `#EL-2026-00042`)
- O eleitor recebe o protocolo na mesma conversa: "Sua solicitação foi registrada com o protocolo #EL-2026-00042. Nossa equipe entrará em contato em breve."
- A equipe gerencia as solicitações no painel de Relatórios (Relatório 10)
- O agente consulta o status se o eleitor perguntar: "Sobre o protocolo #EL-2026-00042, sua solicitação está em análise pela equipe."

---

### 4.13 ALERTAS AUTOMÁTICOS

- **Alerta de pico:** mais de 30% acima da média de mensagens sobre um tema → notificação no dashboard + e-mail para o administrador
- **Mensagem urgente:** tom agressivo, palavras-chave sensíveis ou ameaça detectada → marca conversa como urgente + notifica a equipe
- **Gap de conteúdo:** mais de 10 perguntas sem resposta sobre o mesmo tema em 7 dias → alerta para preencher a Plataforma Eleitoral
- **Compliance TSE:** 7 dias antes da desativação automática → aviso destacado no dashboard

---

## 5. LANDING PAGE

### Identidade Visual
- **Cores:** Verde #009C3B, Amarelo #FFDF00, Azul #002776, Branco #FFFFFF
- **Tom:** profissional, apartidário, sem opinião política, sem menção a partidos
- **Foco:** eleições 2026, tecnologia a serviço da democracia

### Estrutura da página

**Header:**
- Logo SyncroFlowEleições
- Menu: Como Funciona | Recursos | Preços | Contato
- Botões: ENTRAR | REGISTRAR

**Hero:**
- Headline: "Seu eleitor merece atenção 24 horas por dia."
- Subheadline: "O assistente inteligente para candidatos que levam a campanha a sério."
- CTA primário: REGISTRAR AGORA
- CTA secundário: Ver como funciona

**Seção: Como Funciona (3 passos)**
1. Cadastre suas propostas
2. Conecte seus canais
3. Atenda eleitores 24/7 com inteligência

**Seção: Recursos**
- Cards visuais para cada módulo principal
- Destaque para: Agente 24/7, Painel de Inteligência, Compliance TSE, Múltiplos Canais

**Seção: Conformidade TSE**
- Explicar em linguagem simples o que a Res. 23.755 exige e como o sistema garante conformidade
- Badge de conformidade

**Seção: Preços**
- Planos claros com botão ASSINAR

**Footer:**
- Links legais: Termos de Uso, Política de Privacidade, Política de Cookies
- "Em conformidade com a Resolução TSE nº 23.755/2026"
- Contato

---

## 6. TUTORIAL COMPLETO DO SISTEMA

> Este tutorial deve ser implementado como um módulo interativo dentro do sistema.
> Ao entrar pela primeira vez (logo após o pagamento), o candidato é guiado
> passo a passo antes de chegar ao Dashboard.

---

### Tutorial — Passo 1: Bem-vindo ao SyncroFlowEleições

**Tela de boas-vindas:**
- "Olá, [Nome do Candidato]! Seja bem-vindo ao SyncroFlowEleições."
- "Vamos configurar seu assistente em 5 passos simples. Leva cerca de 15 minutos."
- Barra de progresso: Passo 1 de 5
- Botão: COMEÇAR

---

### Tutorial — Passo 2: Sua História

**Objetivo:** preencher a aba "Minha História"

Instruções na tela:
- "Conte quem você é para seus eleitores. Sua trajetória, seus valores, por que você quer servir ao povo."
- "Seja autêntico. Esse conteúdo será usado pelo seu assistente para apresentar você de forma humanizada."
- Campo de texto grande com placeholder: "Nasci em [cidade], sou [profissão] há X anos. Ao longo da minha vida..."
- Dica: "Escreva na primeira pessoa. Fale sobre sua família, suas conquistas e o que te motivou a entrar na política."
- Mínimo sugerido: 200 caracteres. Sem máximo.
- Botão: SALVAR E CONTINUAR

---

### Tutorial — Passo 3: Suas Propostas (Plataforma Eleitoral)

**Objetivo:** preencher ao menos 3 temas da Plataforma Eleitoral

Instruções na tela:
- "Aqui você cadastra suas propostas para cada área. Seu assistente só vai responder sobre os temas que você preencher."
- "Você não precisa preencher todos agora — pode completar depois. Mas quanto mais você preencher, melhor será o atendimento."
- Exibe os 15 campos de temas
- Destaque visual nos campos preenchidos (borda verde)
- Contador: "X de 15 temas preenchidos"
- Dica: "Seja específico. Em vez de 'vou melhorar a saúde', escreva 'vou ampliar o horário das UBS para atendimento noturno e aos sábados'."
- Botão: SALVAR E CONTINUAR

---

### Tutorial — Passo 4: Mensagem de Apresentação (Disclaimer)

**Objetivo:** personalizar o disclaimer

Instruções na tela:
- "Esta é a primeira mensagem que seu assistente enviará para cada novo eleitor."
- "Ela é obrigatória pela Resolução TSE nº 23.755/2026."
- Exibe o modelo padrão já preenchido com os dados do candidato
- Campo editável
- Preview ao vivo: "É assim que o eleitor vai receber:"
- Balão de WhatsApp estilizado mostrando o preview
- Aviso: "Não remova a identificação como assistente virtual — isso é exigência legal."
- Botão: SALVAR E CONTINUAR

---

### Tutorial — Passo 5: Conectar o Primeiro Canal

**Objetivo:** conectar pelo menos o WhatsApp

Instruções na tela:
- "Agora vamos conectar seu WhatsApp para que os eleitores possam conversar com seu assistente."
- Opções de canal com ícones: WhatsApp | Instagram | Facebook | Telegram | E-mail
- Destaque no WhatsApp (canal mais importante)
- Instrução passo a passo para conexão do WhatsApp via QR Code ou API
- "Pode pular este passo e conectar depois em Configurações > Canais"
- Botão: CONECTAR WHATSAPP ou PULAR POR AGORA

---

### Tutorial — Passo 6: Pronto! Ative seu Assistente

**Tela de conclusão:**
- "Parabéns! Seu assistente está configurado."
- Resumo do que foi preenchido (checklist visual)
- Status do agente: PRONTO PARA ATIVAR
- "Revise tudo e quando estiver pronto, ative seu assistente."
- Botão grande: ATIVAR MEU ASSISTENTE → muda status para ATIVO
- Botão secundário: IR PARA O DASHBOARD (ativa depois)

---

### Tutorial — Dicas Contextuais (durante o uso)

Além do tutorial inicial, implementar dicas contextuais (tooltips ou banners informativos) nas telas:

| Tela | Dica exibida |
|---|---|
| Plataforma Eleitoral (campo vazio) | "Eleitores já perguntaram sobre este tema. Preencha para não perder oportunidades." |
| Chat (primeira mensagem recebida) | "Este é seu primeiro eleitor! Você pode acompanhar a conversa aqui em tempo real." |
| Relatórios | "Use estes dados para definir sua agenda de rua. Vá onde os eleitores estão pedindo." |
| Compliance TSE | "Faltam X dias para a eleição. Seu assistente será desativado automaticamente às 0h do dia [data]." |
| Equipe (vazia) | "Convide sua equipe para ajudar no atendimento. Cada colaborador tem seu próprio acesso." |

---

### Tutorial — Central de Ajuda (Help Center)

Implementar ícone "?" em todas as telas que abre um painel lateral com:

- Vídeo curto explicativo da tela atual (placeholder por ora)
- FAQ da tela
- Link para "Falar com suporte"

**FAQs por módulo:**

**Minha História:**
- Q: "Posso mudar minha história depois?"
- A: "Sim, a qualquer momento. As mudanças valem para conversas futuras."

**Plataforma Eleitoral:**
- Q: "E se o eleitor perguntar sobre um tema que não preenchi?"
- A: "O assistente informará que vai encaminhar a dúvida para sua equipe e registrará a pergunta no relatório de Gaps."

**Agenda:**
- Q: "O assistente pode agendar reuniões com eleitores?"
- A: "Não. Por segurança e conformidade, o assistente apenas informa compromissos existentes. Nunca cria compromissos novos."

**Compliance TSE:**
- Q: "O que acontece nas 72h antes da eleição?"
- A: "Seu assistente é desativado automaticamente às 0h de 72h antes do pleito, conforme a Resolução TSE nº 23.755/2026. Você receberá um aviso com antecedência."

**Equipe:**
- Q: "Um colaborador pode ver o histórico de conversas?"
- A: "Depende da função. Colaboradores de Atendimento têm acesso ao Chat. Colaboradores de Conteúdo não."

**Chat:**
- Q: "Como assumo uma conversa manualmente?"
- A: "Clique no botão 'Assumir Conversa' dentro de qualquer chat. O assistente para de responder e você assume o controle. Para devolver ao assistente, clique em 'Devolver para o Agente'."

---

## 7. REGRAS DE NEGÓCIO — COMPLIANCE TSE

Implementar rigorosamente:

1. **Identificação obrigatória:** primeira mensagem SEMPRE contém identificação como assistente virtual, não como o candidato.

2. **Sem recomendação de voto:** qualquer tentativa do usuário de fazer o agente recomendar votar no candidato deve ser redirecionada educadamente.

3. **Conteúdo restrito:** o agente responde APENAS com base no conteúdo cadastrado na Plataforma Eleitoral e Minha História. Nenhuma resposta gerada por IA fora desse escopo.

4. **Desativação automática 72h:** implementar cron job que desativa o agente 72 horas antes de cada turno. Datas 2026: 1º turno 4 out (desativação 1 out 0h), 2º turno 25 out (desativação 22 out 0h).

5. **Sem deepfake ou síntese:** nenhuma funcionalidade de geração de imagem, vídeo ou áudio do candidato.

6. **Log imutável:** todas as conversas devem ser armazenadas com timestamp e não podem ser deletadas durante o período eleitoral (preservação para auditoria).

7. **Sem ataque a adversários:** se eleitor mencionar adversário, o agente desvia o assunto para as propostas do candidato sem atacar.

---

## 8. BANCO DE DADOS — TABELAS PRINCIPAIS

```sql
-- Candidatos (conta principal)
candidates (
  id, name, cpf, email, whatsapp, candidate_number,
  party, position, state, city, photo_url,
  stripe_customer_id, stripe_subscription_id,
  status (active|suspended|cancelled),
  plan (campaign|mandate),
  created_at
)

-- Membros da equipe
team_members (
  id, candidate_id, user_id, name, email, role,
  invited_at, accepted_at, status
)

-- Configuração do agente
agent_config (
  id, candidate_id, agent_name, agent_role, agent_style,
  story (text), disclaimer (text), candidate_site,
  voice_enabled, is_active, deactivated_at, deactivation_reason
)

-- Plataforma eleitoral (propostas)
platform_topics (
  id, candidate_id, topic_name, topic_key, content (text),
  updated_at
)

-- Contatos (eleitores)
contacts (
  id, candidate_id, channel_type, channel_id,
  name, phone, email, first_contact_at, last_contact_at,
  total_interactions, notes
)

-- Conversas
conversations (
  id, candidate_id, contact_id, channel_type,
  started_at, last_message_at, status (active|closed|urgent),
  assigned_to (null = agente, user_id = humano)
)

-- Mensagens
messages (
  id, conversation_id, sender_type (voter|agent|human),
  content (text), media_url, media_type,
  audio_transcript, created_at, is_read
)

-- Solicitações
requests (
  id, candidate_id, contact_id, conversation_id,
  protocol_number, subject, description, region, neighborhood,
  status (received|analyzing|forwarded|resolved),
  created_at, updated_at, resolved_by, resolved_at
)

-- Agenda
events (
  id, candidate_id, title, description, event_type,
  location, neighborhood, city, link,
  starts_at, ends_at, is_public,
  google_event_id, created_at
)

-- Log de auditoria (imutável)
audit_log (
  id, candidate_id, conversation_id, message_id,
  event_type, content, metadata (jsonb),
  created_at
)
```

---

## 9. VARIÁVEIS DE AMBIENTE

```env
# Supabase (novo projeto isolado)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Meta / WhatsApp
META_APP_ID=
META_APP_SECRET=
META_VERIFY_TOKEN=
META_WABA_ID=

# Google Calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# App
NEXT_PUBLIC_APP_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# E-mail (briefing automático)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

---

## 10. PRIORIDADE DE DESENVOLVIMENTO (10 DIAS)

### Dias 1–2: Setup e Infra
- [ ] Fork do repositório SyncroFlow → `syncroflow-eleicoes`
- [ ] Novo projeto Supabase + schema inicial
- [ ] Deploy Vercel + variáveis de ambiente
- [ ] Novo serviço EasyPanel
- [ ] Remover módulos listados na seção 3

### Dias 3–4: Autenticação e Pagamento
- [ ] Tela de login
- [ ] Fluxo de registro com 2 passos (dados + pagamento)
- [ ] Integração Stripe (cartão + PIX)
- [ ] Webhook Stripe → ativar conta
- [ ] Níveis de acesso da equipe

### Dias 5–6: Cadastro do Agente
- [ ] Minha História
- [ ] Disclaimer editável com preview
- [ ] Plataforma Eleitoral (15 temas)
- [ ] Fluxos simplificados
- [ ] Configuração de voz

### Dias 7–8: Chat, Contatos e Agenda
- [ ] Filtro por canal no chat
- [ ] Memória de conversa (contatos conhecidos)
- [ ] Transcrição de áudio
- [ ] Módulo de solicitações + protocolos
- [ ] Agenda + integração Google Calendar

### Dias 9–10: Relatórios, Tutorial e Landing Page
- [ ] 10 relatórios
- [ ] Briefing automático por e-mail
- [ ] Tutorial onboarding (6 passos)
- [ ] Help Center com FAQs
- [ ] Landing page
- [ ] Compliance TSE (cron job desativação)
- [ ] Testes e ajustes finais

---

## 11. NOTAS FINAIS PARA O DESENVOLVEDOR

- Nunca usar o banco Supabase do SyncroFlow original. Usar somente o projeto `syncroflow-eleicoes`.
- Nunca compartilhar tokens ou chaves entre os dois sistemas.
- Todo texto voltado ao usuário final deve usar linguagem eleitoral (candidato, eleitor, proposta, mandato) — nunca linguagem comercial (empresa, cliente, produto, lead).
- O agente nunca gera conteúdo por iniciativa própria. Responde APENAS com base no que o candidato cadastrou.
- Manter o código limpo e comentado para facilitar manutenção pós-eleição.
- Implementar rate limiting nas rotas de API para evitar spam de eleitores.
- Todas as datas de desativação TSE devem ser configuráveis via painel admin, não hardcoded.
