# SyncroFlow — Documento de Implementação Final
**Para uso no Claude Code | Versão 2.1 | Junho 2026**

---

## LEIA ANTES DE COMEÇAR

Este documento substitui qualquer instrução anterior sobre WhatsApp no projeto SyncroFlow. A arquitetura foi revisada com base em pesquisa direta nas políticas da Meta, legislação do TSE (Res. 23.755/2026) e análise de risco operacional.

**Terminologia proibida no sistema (código, UI, banco de dados, comentários):**
- ❌ "campanha política"
- ❌ "campanha eleitoral"
- ❌ "disparo em massa"
- ❌ "propaganda eleitoral"

**Terminologia correta:**
- ✅ "Serviço de Atendimento ao Eleitor" (SAE)
- ✅ "atendimento ao eleitor"
- ✅ "eleitor" (não "eleitorado-alvo")
- ✅ "re-engajamento" (não "disparo")
- ✅ "inteligência do eleitorado"
- ✅ "representante público" ou "contratante"

---

## 1. VISÃO GERAL DO PRODUTO

O SyncroFlow é uma plataforma de **Serviço de Atendimento ao Eleitor (SAE)** — equivalente ao SAC do consumidor, porém voltado ao relacionamento entre representantes públicos e cidadãos. O sistema centraliza, automatiza e analisa o atendimento a eleitores via múltiplos canais de comunicação.

### O que o sistema faz

1. Eleitor entra em contato espontaneamente pelo canal de sua preferência
2. IA atende, responde dúvidas, coleta sugestões e registra demandas
3. Dados são consolidados em painel de inteligência para o contratante
4. Contratante entende prioridades, temas e sentimento do eleitorado
5. Re-engajamento opcional apenas para eleitores que já iniciaram contato

### Modelo operacional: SAC inbound puro

- **Quem inicia:** sempre o eleitor
- **O sistema nunca contata eleitores que não enviaram mensagem primeiro**
- **Exceção única:** re-engajamento com criativos para eleitores que já iniciaram contato (ver Seção 7)

---

## 2. ARQUITETURA DE CANAIS

```
ELEITOR
  │
  ├── WhatsApp (canal principal)
  │     ├── Primário: WABA via Meta Cloud API
  │     └── Backup:   Baileys self-hosted (failover automático)
  │
  ├── Telegram Bot
  ├── Instagram Direct (Meta Graph API)
  ├── Facebook Messenger (Meta Graph API)
  └── Email (SMTP / SendGrid)
         │
         ▼
   [SyncroFlow Core]
         │
         ├── Motor de IA (respostas automáticas)
         ├── Banco de Dados Central (todas as conversas)
         ├── Sistema de Roteamento de Canais
         └── Painel do Contratante
```

Todos os canais gravam no mesmo banco de dados. O perfil do eleitor é unificado por número de telefone ou identificador de canal.

---

## 3. WHATSAPP — ARQUITETURA DUAL

### 3.1 Visão Geral

Cada contratante terá **dois tipos de número WhatsApp**:

| | Canal Primário | Canal Backup |
|---|---|---|
| **Tipo** | WABA (Meta Cloud API) | WhatsApp Business App + Baileys |
| **Conexão** | API key / webhook | QR code |
| **Custo** | Por conversa (~R$0,10–0,20/sessão 24h) | Zero por mensagem |
| **Volume** | Ilimitado (escala) | Moderado (por número) |
| **Estabilidade** | Alta | Média |
| **Ativação** | Sempre ativo | Standby → ativa se primário cair |
| **Mínimo recomendado** | 3 números | 2 números |

**Recomendação ao contratante: mínimo 5 números totais (3 WABA + 2 Baileys)**

### 3.2 Canal Primário — WABA via Meta Cloud API

#### Registro e Cadastro

- A SyncroFlow é titular das contas WABA via **parceria com Salvy** (provedor de números virtuais)
- O contratante **não precisa criar conta no Meta Business Manager** — o processo é interno à plataforma
- Fluxo do contratante: acessar painel → Meus Números → "Adquirir Novo Número" → pagamento → número ativo em minutos
- A SyncroFlow gerencia toda a infraestrutura WABA em nome do contratante
- Categoria de negócio no cadastro dos números: **"Serviços ao Cidadão"**
- Nome de exibição: ex. "Atendimento [Nome do Representante]" — sem linguagem política
- Descrição: "Canal oficial de atendimento e informações ao eleitor"

#### Integração com Salvy

```typescript
// Aquisição de novo número via Salvy API
async function adquirirNovoNumero(contratanteId: string): Promise<NumeroWhatsApp> {
  // 1. Solicitar número virtual à Salvy
  const numeroSalvy = await salvyApi.provisionNumber({
    country: 'BR',
    tipo: 'whatsapp_business'
  });

  // 2. Registrar número na WABA da SyncroFlow
  const waba = await metaApi.registerNumber({
    phone: numeroSalvy.telefone,
    display_name: await getDisplayName(contratanteId),
    category: 'Serviços ao Cidadão'
  });

  // 3. Salvar no banco vinculado ao contratante
  return await db.numerosWhatsapp.create({
    contratante_id: contratanteId,
    telefone: numeroSalvy.telefone,
    tipo: 'waba',
    waba_phone_number_id: waba.phone_number_id,
    waba_access_token: waba.access_token,
    is_primary: true,
    status: 'ativo'
  });
}

#### Integração técnica

```
Meta Cloud API
  └── Webhook → SyncroFlow API Gateway
        └── Roteador de Mensagens
              ├── Identificar se é primeiro contato (consultar DB)
              ├── Acionar fluxo de boas-vindas (se novo)
              └── Encaminhar ao Motor de IA (se recorrente)
```

#### Variáveis de ambiente necessárias por contratante

```env
WA_PHONE_NUMBER_ID_[CONTRATANTE_ID]=
WA_ACCESS_TOKEN_[CONTRATANTE_ID]=
WA_WABA_ID_[CONTRATANTE_ID]=
WA_WEBHOOK_VERIFY_TOKEN_[CONTRATANTE_ID]=
```

#### Templates WABA

Criar os seguintes templates (linguagem neutra, sem conteúdo político):

**Template 1 — Boas-vindas (texto)**
```
Nome: sae_boas_vindas
Categoria: UTILITY
Texto: "Olá, {{1}}! Obrigado pelo contato com o Serviço de Atendimento ao Eleitor. Em instantes você receberá uma mensagem de apresentação do nosso canal."
```

**Template 2 — Re-engajamento com criativo**
```
Nome: sae_novidade
Categoria: MARKETING
Header: IMAGE (dinâmico — imagem do criativo)
Texto: "Olá, {{1}}! Temos uma novidade que pode ser do seu interesse."
Footer: "Para não receber mais mensagens, responda SAIR."
```

**Template 3 — Reativação de atendimento**
```
Nome: sae_reativacao
Categoria: UTILITY
Texto: "Olá, {{1}}! Nosso canal de atendimento está disponível para suas dúvidas e sugestões. Como posso ajudar?"
```

> **IMPORTANTE:** Nunca submeter templates com palavras como "vote", "candidato", "eleição", "campanha". Os templates são aprovados pela Meta — conteúdo político em templates aumenta risco de rejeição da conta.

#### Janela de conversação (24h window)

- Quando eleitor envia mensagem → janela de 24h abre
- Dentro da janela: mensagens livres (sem template), incluindo vídeos e imagens
- Após 24h sem mensagem do eleitor → janela fecha
- Para reabrir: usar Template 2 (re-engajamento) ou Template 3 (reativação)

### 3.3 Canal Backup — Baileys Self-Hosted

#### Tecnologia

Usar **Baileys** (biblioteca open-source) hospedada nos servidores da SyncroFlow.

Repositório: `https://github.com/WhiskeySockets/Baileys`

#### Infraestrutura

```
SyncroFlow Server
  └── Baileys Service (Node.js)
        ├── Instância por número de telefone
        ├── Sessão salva em arquivo/Redis (persistência do QR)
        ├── Webhook interno → SyncroFlow API Gateway
        └── Health check a cada 60 segundos
```

#### Conexão pelo painel do contratante

1. Contratante acessa Painel → Configurações → Números de Backup
2. Sistema gera QR code via Baileys
3. Contratante escaneia com WhatsApp Business App no celular
4. Conexão estabelecida como "dispositivo vinculado" (multi-device)
5. Celular pode ser usado normalmente — Baileys opera em paralelo

#### Variáveis e configuração

```env
BAILEYS_SESSION_PATH=/sessions/[CONTRATANTE_ID]/[NUMERO_ID]/
BAILEYS_REDIS_URL= (opcional, para persistência em cluster)
```

#### Limitações operacionais do Baileys

- Manter abaixo de **800 mensagens/dia por número** para evitar anomalias
- Não enviar a mesmos números em sequência rápida
- Intervalo mínimo de 3 segundos entre respostas consecutivas
- Nunca usar para disparos em sequência — somente respostas a mensagens recebidas

### 3.4 Sistema de Failover Automático

```typescript
// Lógica de roteamento por contratante
async function rotearMensagem(contratanteId: string, mensagem: Mensagem) {
  const statusPrimario = await verificarSaudePrimario(contratanteId);
  
  if (statusPrimario === 'ATIVO') {
    return enviarViaWABA(contratanteId, mensagem);
  }
  
  const statusBackup = await verificarSaudeBackup(contratanteId);
  
  if (statusBackup === 'ATIVO') {
    await notificarContratante(contratanteId, 'FAILOVER_ATIVADO');
    return enviarViaBaileys(contratanteId, mensagem);
  }
  
  await criarAlertaCritico(contratanteId, 'TODOS_CANAIS_INDISPONIVEIS');
}
```

#### Estados de saúde dos números

```typescript
enum StatusNumero {
  ATIVO = 'ativo',           // Funcionando normalmente
  DEGRADADO = 'degradado',   // Quality Rating amarelo — monitorar
  SUSPENSO = 'suspenso',     // Temporariamente bloqueado pela Meta
  DESCONECTADO = 'desconectado', // Baileys: sessão perdida
  BANIDO = 'banido'          // Número permanentemente suspenso
}
```

### 3.5 Gerenciamento de Números

#### Quantidade de números — flexível, não obrigatório

- **Mínimo:** 1 número (o sistema funciona normalmente com apenas 1)
- **Recomendado:** 5+ números para maior resiliência e volume
- A recomendação é exibida no painel como sugestão, nunca como bloqueio
- Contratante pode começar com 1 e adicionar mais conforme crescimento

#### Painel de números por contratante

Cada contratante vê e gerencia:

```
┌─────────────────────────────────────────────────────────┐
│ MEUS NÚMEROS DE ATENDIMENTO                             │
├──────────────┬──────────┬──────────┬──────────┬────────┤
│ Número       │ Tipo     │ Status   │ Vol/dia  │ Ações  │
├──────────────┼──────────┼──────────┼──────────┼────────┤
│ +55 31 9xxx  │ WABA     │ 🟢 Ativo │ 1.243    │ Config │
│ +55 31 9xxx  │ WABA     │ 🟢 Ativo │ 987      │ Config │
│ +55 31 9xxx  │ WABA     │ 🟡 Atenç │ 1.891    │ Config │
│ +55 31 9xxx  │ Backup   │ 🟢 Ativo │ 23       │ QR     │
│ +55 31 9xxx  │ Backup   │ ⚪ Stand │ 0        │ QR     │
└──────────────┴──────────┴──────────┴──────────┴────────┘
[+ Adquirir novo número]  [+ Conectar número backup]
```

#### Distribuição de carga

- Com 1 número: todo tráfego vai para ele
- Com múltiplos: round-robin entre números WABA ativos
- Quality Rating amarelo → reduzir carga daquele número em 50%
- Quality Rating vermelho → **parar de receber novas conversas naquele número**, redirecionar para os demais ativos. Conversas já abertas continuam até fechar naturalmente.
- Se for o único número e ficar vermelho → alerta crítico no painel, mas o número continua respondendo (não há alternativa). Exibir aviso ao contratante para adquirir número adicional.

#### Quality Rating Monitor

Verificar via Meta API a cada 30 minutos:
- Verde → normal
- Amarelo → alerta no painel + email ao contratante
- Vermelho → alerta crítico + desvio de tráfego + email urgente + sugestão de adquirir novo número

---

## 4. FLUXO DE ONBOARDING DO ELEITOR

### 4.1 Detecção de primeiro contato

```typescript
async function processarMensagem(mensagem: MensagemRecebida) {
  const eleitorExiste = await db.eleitores.findByPhone(mensagem.telefone);
  
  if (!eleitorExiste) {
    await criarPerfilEleitor(mensagem);
    await executarFluxoBemVindo(mensagem);
  } else {
    await atualizarUltimoContato(mensagem);
    await encaminharParaIA(mensagem);
  }
}
```

### 4.2 Fluxo de boas-vindas (novo eleitor)

**Passo 1 — Mensagem de boas-vindas + Disclaimer (imediato)**

A mensagem é composta de duas partes:

**Parte A — Disclaimer obrigatório (FIXO, não editável pelo contratante):**
```
⚠️ Você está sendo atendido por uma assistente virtual com inteligência artificial. Não sou um ser humano. Suas mensagens são registradas e analisadas para melhorar o atendimento. Para encerrar, responda SAIR.
```

**Parte B — Complemento personalizado (editável pelo contratante no painel):**
```
Olá! 👋 Bem-vindo ao Serviço de Atendimento ao Eleitor de [Nome].

Aqui você pode:
✅ Tirar dúvidas
✅ Enviar sugestões
✅ Fazer perguntas
✅ Registrar demandas
```

> **Regra de exibição:** Parte A aparece SEMPRE no topo, seguida da Parte B. O contratante edita apenas a Parte B. No painel, a Parte A é exibida como bloco somente leitura com fundo cinza (não-clicável). Conformidade TSE Res. 23.755/2026.

**Passo 2 — Mídia de apresentação (5 segundos após passo 1)**

O contratante escolhe no painel **o que enviar no primeiro contato** — apenas uma opção por vez:

| Opção | Formato | Limite |
|---|---|---|
| Vídeo do representante | MP4 | máx. 16MB, 90s |
| Imagem / criativo | JPG, PNG | máx. 5MB |
| Documento / PDF | PDF | máx. 10MB |
| Nenhum | — | Pular passo 2 |

- Legenda automática: "Mensagem de [Nome do Representante]"
- Se nenhuma mídia cadastrada → passo 2 é pulado automaticamente

**Passo 3 — Abertura do atendimento**

```
Como posso te ajudar hoje? 😊
```

### 4.3 Campos do perfil do eleitor (criados no primeiro contato)

```typescript
interface PerfilEleitor {
  id: string;
  telefone: string;          // identificador principal
  canal_origem: Canal;       // whatsapp | telegram | instagram | messenger | email
  numero_atendimento: string; // qual número do contratante recebeu
  contratante_id: string;
  data_primeiro_contato: Date;
  data_ultimo_contato: Date;
  total_mensagens: number;
  status_opt_out: boolean;   // true se respondeu SAIR
  tags: string[];            // classificação automática por IA
  sentimento_geral: 'positivo' | 'neutro' | 'negativo' | null;
  temas_recorrentes: string[];
}
```

---

## 5. MOTOR DE IA — ATENDIMENTO

### 5.1 Comportamento geral

- Responde perguntas sobre posições, propostas e trabalho do contratante
- Registra sugestões e demandas dos eleitores
- Classifica automaticamente o tema de cada conversa (usando taxonomia da Plataforma Política — ver abaixo)
- Analisa sentimento (positivo, neutro, negativo)
- Escala para humano se não souber responder (notifica painel)

#### Integração com a Plataforma Política

O SyncroFlow possui um módulo separado chamado **Plataforma Política** que gerencia a taxonomia de temas eleitorais. O Motor de IA do SAE consome esta taxonomia para classificar as conversas dos eleitores.

```typescript
// Classificação de tema via Plataforma Política
async function classificarTema(mensagem: string, contratanteId: string): Promise<string[]> {
  // Buscar taxonomia ativa do contratante na Plataforma Política
  const taxonomia = await plataformaPolitica.getTaxonomia(contratanteId);
  
  // IA classifica a mensagem contra os temas disponíveis
  const temas = await ia.classificar({
    texto: mensagem,
    categorias: taxonomia.temas,
    max_temas: 3
  });
  
  return temas;
}
```

Exemplos de temas da taxonomia (definidos na Plataforma Política):
- Saúde, Educação, Segurança, Infraestrutura, Emprego
- Habitação, Meio Ambiente, Transporte, Assistência Social
- Administração pública, Corrupção, Impostos
- (Contratante pode adicionar temas específicos da sua região/cargo)

Os temas classificados alimentam o painel de **Inteligência do Eleitorado** (Seção 9).

### 5.2 Base de conhecimento (configurada pelo contratante)

O contratante alimenta no painel:
- Propostas e plataforma
- Perguntas frequentes e respostas
- Informações biográficas
- Realizações e projetos
- Temas que a IA deve evitar comentar

### 5.3 Identificação obrigatória como IA (TSE Res. 23.755/2026)

A IA deve se identificar como assistente virtual em:
- Primeira mensagem de qualquer conversa (já incluído no disclaimer de boas-vindas)
- Sempre que o eleitor perguntar diretamente "você é humano?" ou "falo com pessoa?"
- Nunca afirmar ser o próprio candidato/representante

```typescript
const FRASES_QUESTIONAMENTO_HUMANO = [
  'você é humano', 'é robô', 'é bot', 'falo com pessoa',
  'tem alguém aí', 'atendente humano', 'falar com pessoa real'
];

function deveIdentificarComoIA(mensagem: string): boolean {
  return FRASES_QUESTIONAMENTO_HUMANO.some(frase =>
    mensagem.toLowerCase().includes(frase)
  );
}

const RESPOSTA_IDENTIFICACAO_IA = `
Sou uma assistente virtual com inteligência artificial. 
Não sou um ser humano nem o(a) próprio(a) [Nome do Representante].
Estou aqui para ajudar com informações e registrar suas mensagens. 
Posso te ajudar com algo?`;
```

### 5.4 Desativação automática 72h antes da eleição

```typescript
async function verificarStatusAtendimento(contratanteId: string) {
  const dataEleicao = await db.contratantes.getDataEleicao(contratanteId);
  const agora = new Date();
  const horasParaEleicao = diferencaEmHoras(agora, dataEleicao);
  
  if (horasParaEleicao <= 72 && horasParaEleicao > 0) {
    // Desativar IA — TSE proíbe conteúdo de IA nas 72h pré-eleição
    await desativarIA(contratanteId);
    await ativarMensagemDesativacao(contratanteId);
    return false;
  }
  
  return true;
}

const MENSAGEM_DESATIVACAO_72H = `
Nosso serviço de atendimento virtual está temporariamente pausado 
em cumprimento à legislação eleitoral brasileira.
Obrigado pelo contato! 🙏`;
```

---

## 6. RE-ENGAJAMENTO (ENVIO DE CRIATIVOS)

### 6.1 Regras de elegibilidade

Um eleitor pode receber um criativo **somente se**:
- Já enviou pelo menos 1 mensagem para o contratante (tem perfil no banco)
- `status_opt_out` = false
- Última mensagem há menos de 90 dias (evitar contatos antigos/inativos)
- Não recebeu criativo nas últimas 48h (evitar excesso)

```typescript
async function verificarElegibilidadeReengajamento(
  eleitoreId: string
): Promise<boolean> {
  const eleitor = await db.eleitores.findById(eleitorId);
  
  if (eleitor.status_opt_out) return false;
  if (!eleitor.data_ultimo_contato) return false;
  
  const diasSemContato = diferencaEmDias(new Date(), eleitor.data_ultimo_contato);
  if (diasSemContato > 90) return false;
  
  const ultimoReengajamento = await db.reengajamentos.findLast(eleitorId);
  if (ultimoReengajamento) {
    const horasSinceUltimo = diferencaEmHoras(new Date(), ultimoReengajamento.data);
    if (horasSinceUltimo < 48) return false;
  }
  
  return true;
}
```

### 6.2 Envio via WABA

Se a janela de 24h estiver aberta → enviar como mensagem livre (imagem + texto).
Se a janela estiver fechada → usar Template `sae_novidade` (ver Seção 3.2).

### 6.3 Envio via Baileys (backup)

Baileys não tem restrição de janela — pode enviar imagem + texto diretamente.
Respeitar as regras de elegibilidade da Seção 6.1.

### 6.4 Opt-out automático

Se o eleitor responder SAIR, STOP, PARAR, NÃO QUERO:
```typescript
await db.eleitores.update(eleitorId, { status_opt_out: true });
await enviarConfirmacaoOptOut(eleitorId);
// Mensagem: "Você foi removido da nossa lista. Para voltar, nos envie uma mensagem."
```

---

## 7. MULTI-CANAL

### 7.1 Telegram

- Usar **Telegram Bot API** (gratuita, sem restrições políticas, sem janela de 24h)
- Criar bot via @BotFather para cada contratante (automatizado pelo painel)
- Contratante divulga link do bot: `t.me/[nome_do_bot]`
- **Telegram é o canal principal de envio de criativos** — sem as restrições do WhatsApp

```env
TELEGRAM_BOT_TOKEN_[CONTRATANTE_ID]=
```

#### O que é necessário para envio de criativos via Telegram

**1. Subscriber list (obrigatório)**

Quando o eleitor envia qualquer mensagem ao bot, salvar o `chat_id`:

```typescript
// Ao receber qualquer mensagem no bot
async function processarMensagemTelegram(update: TelegramUpdate) {
  const chatId = update.message.chat.id;
  const eleitorExiste = await db.eleitores.findByTelegramChatId(chatId);

  if (!eleitorExiste) {
    await criarPerfilEleitor({
      canal_origem: 'telegram',
      canal_id_externo: chatId.toString(),
      contratante_id: update.contratanteId
    });
  }

  // Eleitor com chat_id salvo = elegível para receber broadcasts
}
```

**2. Broadcast assíncrono com rate limiting**

Telegram bloqueia envios muito rápidos. Implementar fila com throttling:

```typescript
async function enviarBroadcastTelegram(
  contratanteId: string,
  criativo: Criativo
) {
  const inscritos = await db.eleitores.findTelegramSubscribers(contratanteId);
  const fila = criarFilaDeMensagens(inscritos);

  // Máximo 30 mensagens/segundo (limite Telegram)
  for (const lote of chunk(fila, 30)) {
    await Promise.all(lote.map(eleitor =>
      telegram.sendMedia(eleitor.canal_id_externo, criativo)
    ));
    await sleep(1000); // 1 segundo entre lotes
  }
}
```

**3. Opt-out via comando /sair**

```typescript
bot.command('sair', async (ctx) => {
  await db.eleitores.update(ctx.chat.id, { status_opt_out: true });
  await ctx.reply('Você foi removido da lista. Para voltar, envie qualquer mensagem.');
});
```

**4. Tipos de mídia suportados para criativos**

| Tipo | Método Telegram API |
|---|---|
| Imagem (JPG/PNG) | `sendPhoto` |
| Vídeo (MP4) | `sendVideo` |
| PDF / Documento | `sendDocument` |
| Texto + botão de link | `sendMessage` com `InlineKeyboardButton` |

**5. No painel — Módulo de re-engajamento Telegram**

- Upload do criativo (imagem, vídeo ou PDF)
- Texto opcional de legenda
- Botão de pré-visualização
- Contador de inscritos elegíveis
- Botão "Enviar para todos" com confirmação
- Relatório após envio: total enviados / entregues / erros

**Broadcasts Telegram — sem restrição:**
- Sem proibição política na plataforma
- Sem janela de 24h — pode enviar a qualquer hora para qualquer inscrito
- Sem necessidade de template aprovado
- Sem custo por mensagem

### 7.2 Instagram Direct

- Usar **Meta Graph API** (não WhatsApp Business Platform — sem restrição política)
- Conectar conta do Instagram do contratante via OAuth
- Webhook para mensagens recebidas → mesmo fluxo de atendimento

```env
INSTAGRAM_ACCESS_TOKEN_[CONTRATANTE_ID]=
INSTAGRAM_ACCOUNT_ID_[CONTRATANTE_ID]=
```

### 7.3 Facebook Messenger

- Usar **Meta Graph API** — mesma conexão do Instagram (mesmo token)
- Página do Facebook do contratante conectada via OAuth
- Webhook separado do WhatsApp

### 7.4 Email

- SMTP ou SendGrid
- Para re-engajamento e newsletters para eleitores que forneceram email
- Templates HTML editáveis no painel

---

## 8. BANCO DE DADOS

### 8.1 Tabelas principais

```sql
-- Contratantes (representantes públicos)
CREATE TABLE contratantes (
  id UUID PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cargo VARCHAR(100),
  data_eleicao DATE,
  video_boas_vindas_url TEXT,
  mensagem_boas_vindas TEXT,
  ia_ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Números WhatsApp por contratante
CREATE TABLE numeros_whatsapp (
  id UUID PRIMARY KEY,
  contratante_id UUID REFERENCES contratantes(id),
  telefone VARCHAR(20) NOT NULL,
  tipo VARCHAR(10) NOT NULL, -- 'waba' | 'baileys'
  status VARCHAR(20) DEFAULT 'ativo',
  quality_rating VARCHAR(10) DEFAULT 'green', -- 'green' | 'yellow' | 'red'
  volume_hoje INTEGER DEFAULT 0,
  waba_phone_number_id VARCHAR(100),
  waba_access_token TEXT,
  baileys_session_path TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_backup BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Eleitores
CREATE TABLE eleitores (
  id UUID PRIMARY KEY,
  contratante_id UUID REFERENCES contratantes(id),
  telefone VARCHAR(20),
  canal_origem VARCHAR(20), -- 'whatsapp' | 'telegram' | 'instagram' | 'messenger' | 'email'
  canal_id_externo VARCHAR(255), -- ID do usuário na plataforma de origem
  numero_atendimento_id UUID REFERENCES numeros_whatsapp(id),
  data_primeiro_contato TIMESTAMP DEFAULT NOW(),
  data_ultimo_contato TIMESTAMP,
  total_mensagens INTEGER DEFAULT 0,
  status_opt_out BOOLEAN DEFAULT false,
  sentimento_geral VARCHAR(20),
  temas TEXT[], -- array de tags
  created_at TIMESTAMP DEFAULT NOW()
);

-- Conversas
CREATE TABLE conversas (
  id UUID PRIMARY KEY,
  eleitor_id UUID REFERENCES eleitores(id),
  contratante_id UUID REFERENCES contratantes(id),
  canal VARCHAR(20),
  numero_whatsapp_id UUID REFERENCES numeros_whatsapp(id),
  status VARCHAR(20) DEFAULT 'aberta', -- 'aberta' | 'fechada' | 'escalada'
  janela_expira_em TIMESTAMP, -- para WABA: 24h após última msg do eleitor
  tema_principal VARCHAR(100),
  sentimento VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Mensagens
CREATE TABLE mensagens (
  id UUID PRIMARY KEY,
  conversa_id UUID REFERENCES conversas(id),
  origem VARCHAR(10) NOT NULL, -- 'eleitor' | 'ia' | 'humano'
  conteudo TEXT,
  tipo VARCHAR(20) DEFAULT 'texto', -- 'texto' | 'imagem' | 'video' | 'audio' | 'documento'
  midia_url TEXT,
  wamid VARCHAR(255), -- ID da mensagem no WhatsApp (para status de entrega)
  status_entrega VARCHAR(20), -- 'enviado' | 'entregue' | 'lido' | 'falhou'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Re-engajamentos enviados
CREATE TABLE reengajamentos (
  id UUID PRIMARY KEY,
  eleitor_id UUID REFERENCES eleitores(id),
  contratante_id UUID REFERENCES contratantes(id),
  canal VARCHAR(20),
  criativo_url TEXT,
  template_usado VARCHAR(100),
  status VARCHAR(20), -- 'enviado' | 'entregue' | 'lido' | 'respondido' | 'opt_out'
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 9. PAINEL DO CONTRATANTE

### 9.1 Seções do painel

#### Dashboard Principal
- Total de eleitores atendidos (hoje / 7 dias / total)
- Mensagens recebidas por canal (gráfico)
- Status dos números (saúde em tempo real)
- Últimas conversas abertas
- Alertas ativos

#### Configuração do SAE
- Upload de vídeo de apresentação
- Edição da mensagem de boas-vindas (com disclaimer bloqueado)
- Base de conhecimento da IA (propostas, FAQ, informações)
- Data da eleição (para desativação automática da IA)

#### Gerenciamento de Números
- Lista de todos os números (WABA e Backup)
- Status e Quality Rating de cada número
- Adicionar novo número WABA (formulário de integração)
- Adicionar número backup (gerar QR code para Baileys)
- Alertas de saúde por número

#### Inteligência do Eleitorado
- Temas mais mencionados pelos eleitores (nuvem de palavras / ranking)
- Sentimento geral ao longo do tempo (gráfico)
- Distribuição geográfica (se disponível)
- Perguntas mais frequentes
- Demandas não respondidas / escaladas
- Exportação de relatório (PDF / Excel)

#### Atendimento Humano
- Fila de conversas escaladas pela IA
- Interface de chat para resposta manual
- Histórico completo do eleitor

#### Re-engajamento
- Envio de criativo para eleitores elegíveis
- Upload de imagem / vídeo do criativo
- Pré-visualização antes do envio
- Seleção de canal (WhatsApp, Telegram, Email)
- Relatório de entrega e resposta

### 9.2 Alertas e notificações (email + painel)

| Evento | Prioridade |
|---|---|
| Número com Quality Rating amarelo | ⚠️ Atenção |
| Número com Quality Rating vermelho | 🔴 Urgente |
| Failover ativado (primário caiu) | 🔴 Urgente |
| Sessão Baileys desconectada | ⚠️ Atenção |
| Conversa escalada para humano | ℹ️ Info |
| 72h antes da eleição (IA será desativada) | ⚠️ Atenção |
| Eleitor respondeu SAIR | ℹ️ Info |

---

## 10. CONFORMIDADE TSE (Res. 23.755/2026)

### O que a resolução exige

1. **Identificação obrigatória de IA:** todo conteúdo gerado por IA deve ser identificado como tal → implementado no disclaimer de boas-vindas e nas respostas a perguntas diretas sobre humanidade do atendente

2. **Proibição de neurobots:** sistemas que simulam ser o candidato/pessoa real → proibido. O SyncroFlow identifica-se como assistente virtual, nunca como o representante. ✅ Conforme

3. **Desativação 72h antes da eleição:** todo conteúdo de IA deve ser removido/desativado → implementado na Seção 5.4

4. **Conteúdo sintético (deepfake):** não aplicável — o sistema não gera imagens/vídeos sintéticos de candidatos

### Checklist de conformidade

- [ ] Disclaimer de IA visível no primeiro contato de todo eleitor
- [ ] IA jamais afirma ser humano ou o próprio representante
- [ ] Sistema de desativação automática 72h antes da eleição configurado
- [ ] Data da eleição obrigatória no cadastro do contratante
- [ ] Opt-out funcional e imediato (resposta SAIR)
- [ ] Auditoria de logs (todas as mensagens salvas com timestamp)

---

## 11. CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1 — Infraestrutura WhatsApp Dual
- [ ] Implementar adaptador WABA (Meta Cloud API)
  - [ ] Webhook de recebimento
  - [ ] Envio de mensagens de texto, imagem, vídeo
  - [ ] Envio de templates
  - [ ] Verificação de Quality Rating (polling a cada 30min)
- [ ] Implementar adaptador Baileys
  - [ ] Serviço Node.js com Baileys
  - [ ] Endpoint de geração de QR code
  - [ ] Webhook interno para mensagens recebidas
  - [ ] Health check a cada 60s
  - [ ] Persistência de sessão (Redis ou arquivo)
- [ ] Implementar sistema de failover automático
- [ ] Implementar distribuição de carga entre números WABA

### Fase 2 — Banco de Dados e Core
- [ ] Criar schema de banco de dados (ver Seção 8)
- [ ] Implementar gerenciamento de perfis de eleitores
- [ ] Implementar controle de janela de 24h (WABA)
- [ ] Sistema de opt-out

### Fase 3 — Motor de IA
- [ ] Integrar LLM com base de conhecimento por contratante
- [ ] Implementar classificação automática de temas
- [ ] Implementar análise de sentimento
- [ ] Implementar detecção de perguntas sobre humanidade → resposta obrigatória
- [ ] Implementar desativação automática 72h antes da eleição

### Fase 4 — Fluxo de Onboarding do Eleitor
- [ ] Detecção de primeiro contato
- [ ] Envio de mensagem de boas-vindas com disclaimer
- [ ] Envio de vídeo de apresentação
- [ ] Transição para atendimento IA

### Fase 5 — Multi-Canal
- [ ] Telegram Bot API
- [ ] Instagram Direct (Meta Graph API)
- [ ] Facebook Messenger (Meta Graph API)
- [ ] Email (SendGrid)
- [ ] Roteador unificado (todos os canais → mesmo banco)

### Fase 6 — Re-engajamento
- [ ] Verificação de elegibilidade
- [ ] Envio de criativo via WABA (template + imagem)
- [ ] Envio de criativo via Baileys
- [ ] Relatório de entrega e resposta
- [ ] Opt-out automático por resposta

### Fase 7 — Painel do Contratante
- [ ] Dashboard com métricas em tempo real
- [ ] Configuração do SAE (vídeo, mensagem, base de conhecimento)
- [ ] Gerenciamento de números (WABA + Baileys/QR)
- [ ] Monitor de saúde dos números
- [ ] Painel de Inteligência do Eleitorado
- [ ] Interface de atendimento humano (escaladas)
- [ ] Módulo de re-engajamento (upload criativo + envio)
- [ ] Sistema de alertas (email + painel)

### Fase 8 — Conformidade e Segurança
- [ ] Disclaimer de IA não-removível no onboarding
- [ ] Desativação automática 72h antes da eleição
- [ ] Auditoria de logs completa
- [ ] Isolamento total entre contratantes (dados segregados por contratante_id)
- [ ] LGPD: política de retenção de dados, exportação e exclusão

---

## 12. VARIÁVEIS DE AMBIENTE (modelo completo)

```env
# Banco de Dados
DATABASE_URL=

# Meta Cloud API (por contratante — gerenciado dinamicamente no DB)
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=

# Baileys
BAILEYS_SESSION_BASE_PATH=/sessions/
REDIS_URL=

# Telegram
TELEGRAM_BOT_FATHER_TOKEN= (para criar bots — gerenciado no painel)

# Meta Graph API (Instagram + Messenger)
META_GRAPH_API_VERSION=v19.0

# Email
SENDGRID_API_KEY=
EMAIL_FROM=atendimento@syncrofloweleicoes.com.br

# IA
OPENAI_API_KEY= (ou outro LLM)

# Alertas
ALERT_EMAIL_FROM=alertas@syncrofloweleicoes.com.br
```

---

## 13. NOTAS IMPORTANTES PARA O DESENVOLVEDOR

1. **Isolamento por contratante é crítico.** Nenhum eleitor, conversa ou dado deve vazar entre contratantes diferentes. Todos os queries devem incluir `contratante_id`.

2. **O disclaimer de IA não pode ser removível.** A interface do painel deve mostrar o bloco do disclaimer como somente leitura, apenas a saudação pode ser personalizada.

3. **Nunca armazenar tokens WABA em texto plano.** Usar variáveis de ambiente ou cofre de segredos (ex: AWS Secrets Manager, Vault).

4. **O sistema nunca inicia contato com eleitores que não mensagaram primeiro.** Esta regra deve ser validada em código (não apenas UI) antes de qualquer envio.

5. **Logs de auditoria são obrigatórios.** Toda mensagem enviada/recebida deve ter timestamp, remetente, destinatário, canal e número.

6. **A data da eleição é obrigatória no cadastro.** Bloquear ativação do serviço se não preenchida.

---

## 14. FONTES E REFERÊNCIAS

- [Business Policy | WhatsApp for Business](https://business.whatsapp.com/policy) — Política oficial Meta (março/2026)
- [Meta Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api) — Documentação técnica WABA
- [Baileys — WhiskeySockets](https://github.com/WhiskeySockets/Baileys) — Biblioteca Baileys
- [TSE Resolução 23.755/2026](https://www.tse.jus.br) — Regulamentação IA em eleições
- [CADE vs Meta — TechCrunch Jan/2026](https://techcrunch.com/2026/01/15/after-italy-whatsapp-excludes-brazil-from-rival-chatbot-ban/) — Precedente regulatório brasileiro
- [WhatsApp Messaging Limits 2026](https://chatarmin.com/en/blog/whats-app-messaging-limits) — Quality Rating e limites

---

*Documento gerado em junho/2026. Revisar políticas da Meta antes de cada nova eleição.*
