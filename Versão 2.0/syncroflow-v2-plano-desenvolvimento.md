# SyncroFlow v2.0 — Plano de Desenvolvimento

> **Stack:** Next.js · Supabase · EasyPanel (Hostinger VPS) · Vercel  
> **Estratégia de deploy:** Modular e incremental — cada módulo entra em produção independentemente  
> **Banco:** Supabase (Postgres + Realtime + Storage + Edge Functions)  
> **Hospedagem:** Vercel (frontend/API routes) + EasyPanel/Hostinger (workers, filas, serviços background)

---

## Visão Geral da v2.0

A versão 2.0 tem três objetivos estratégicos claros baseados na análise competitiva:

1. **Fechar o gap de integrações** — sair de ~180 para 280+ conectores focados no ecossistema brasileiro
2. **Lançar o motor de IA em PT-BR** — agentes com multi-LLM, memória e builder em linguagem natural
3. **Amadurecer a plataforma** — RBAC completo, audit log, SLA 99.9%, base para enterprise

---

## Regras Gerais para o Claude Code

```
ANTES de iniciar qualquer módulo:
- Leia este documento completo
- Confirme o estado atual do código existente
- Nunca altere módulos já aprovados sem aviso explícito

AO FINAL de cada submódulo marcado com 🔍:
- Execute análise completa do código produzido naquele bloco
- Verifique: tipos TypeScript, queries Supabase, tratamento de erro, edge cases, lógica de negócio
- Liste os problemas encontrados e corrija ANTES de prosseguir
- Só avance para o próximo bloco após aprovação

AO FINAL de cada MÓDULO completo:
- Faça revisão cruzada entre os submódulos do módulo
- Rode os testes unitários e de integração
- Verifique se as migrações Supabase estão corretas e reversíveis
- Crie o commit com mensagem semântica: feat(modulo-X): descrição
- Execute git push apenas após todos os checks passarem

PADRÃO de commit:
feat(mod-1): descrição da feature
fix(mod-2): descrição do fix
chore(infra): descrição de infra
```

---

## Módulo 1 — Infraestrutura & Fundação v2.0
> **Invisível para o usuário. Deploy silencioso. Obrigatório antes de tudo.**  
> **Duração estimada:** 1 semana

### Contexto
Este módulo prepara o terreno para suportar múltiplas integrações simultâneas, filas de jobs, webhooks de alta volume e o motor de IA. Nenhuma feature nova visível — é a fundação.

---

### 1.1 — Schema Supabase v2.0 🔍

Criar as seguintes tabelas/alterações no Supabase. Todas as migrações devem ser versionadas em `/supabase/migrations/`.

```sql
-- Tabela de conectores disponíveis (catálogo)
CREATE TABLE connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,           -- ex: 'nuvemshop', 'hubspot'
  name TEXT NOT NULL,
  category TEXT NOT NULL,              -- 'ecommerce' | 'crm' | 'marketing' | 'finance' | 'communication' | 'ai' | 'productivity'
  logo_url TEXT,
  auth_type TEXT NOT NULL,             -- 'oauth2' | 'api_key' | 'webhook' | 'basic'
  is_active BOOLEAN DEFAULT true,
  is_beta BOOLEAN DEFAULT false,
  config_schema JSONB,                 -- schema dos campos de configuração
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Credenciais de integração por workspace
CREATE TABLE workspace_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  connector_slug TEXT REFERENCES connectors(slug),
  credentials JSONB,                   -- encriptado via Vault do Supabase
  metadata JSONB,                      -- dados extras (account_name, etc)
  status TEXT DEFAULT 'active',        -- 'active' | 'error' | 'expired'
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, connector_slug)
);

-- Fila de execução de workflows (jobs)
CREATE TABLE workflow_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  workflow_id UUID REFERENCES workflows(id),
  trigger_data JSONB,
  status TEXT DEFAULT 'pending',       -- 'pending' | 'running' | 'success' | 'failed' | 'retrying'
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit log
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,                -- 'workflow.created' | 'integration.connected' | etc
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RBAC: roles por workspace
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT DEFAULT 'member',          -- 'owner' | 'admin' | 'member' | 'viewer'
  permissions JSONB,                   -- permissões granulares opcionais
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Row Level Security em todas as tabelas
ALTER TABLE workspace_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (exemplo para workspace_integrations)
CREATE POLICY "Members can view their workspace integrations"
  ON workspace_integrations FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
```

**🔍 CHECKPOINT 1.1:** Revisar todas as migrações. Verificar: RLS em todas as tabelas, foreign keys, indexes nas colunas de busca frequente (workspace_id, status, created_at), reversibilidade das migrações.

---

### 1.2 — Sistema de Filas (Job Queue) 🔍

O SyncroFlow precisa processar webhooks e execuções de workflow de forma assíncrona e confiável. Implementar usando **Supabase Edge Functions + pg_cron** ou **BullMQ no EasyPanel**.

**Opção recomendada:** BullMQ rodando no EasyPanel (Node.js worker) + Redis (também no EasyPanel).

```
/workers/
  queue.ts          -- Configuração do BullMQ
  processors/
    workflow.ts     -- Processa execução de workflow
    webhook.ts      -- Recebe e enfileira webhooks externos
    notification.ts -- Dispara notificações
```

Regras do job queue:
- Máximo 3 tentativas com backoff exponencial (1s, 5s, 30s)
- Jobs com falha persistem no banco com erro detalhado
- Webhook recebido deve ser confirmado em < 2s (enfileira e retorna 200)
- Timeout de execução: 30s por step de workflow

**🔍 CHECKPOINT 1.2:** Testar enfileiramento, processamento, retry logic, timeout. Simular falha de worker e verificar recuperação.

---

### 1.3 — Encryption & Secrets Management 🔍

Credenciais de integrações (API keys, tokens OAuth) NUNCA devem ser armazenadas em plain text.

```typescript
// lib/encryption.ts
// Usar Supabase Vault para chaves sensíveis
// Campos JSONB de credentials devem usar pgcrypto

// Exemplo de armazenamento seguro
const encryptedCredentials = await supabase.rpc('encrypt_credentials', {
  data: JSON.stringify(credentials),
  workspace_id: workspaceId
})
```

Implementar:
- Supabase Vault para secrets por workspace
- Função RPC `encrypt_credentials` e `decrypt_credentials`
- Nunca retornar credentials no SELECT — apenas status e metadata
- Rotação automática de tokens OAuth (refresh token flow)

**🔍 CHECKPOINT 1.3:** Auditar que nenhuma rota retorna credentials em plain text. Verificar que logs não expõem tokens.

---

### 1.4 — Rate Limiting & Circuit Breaker 🔍

Para chamadas a APIs externas (Nuvemshop, HubSpot, etc.):

```typescript
// lib/connector-client.ts
class ConnectorClient {
  private rateLimiter: RateLimiter     // por conector, por workspace
  private circuitBreaker: CircuitBreaker

  async call(connector: string, endpoint: string, payload: any) {
    // Verificar rate limit
    // Verificar circuit breaker (se API externa está falhando, parar de tentar)
    // Executar com timeout
    // Em caso de erro: registrar, incrementar contador, decidir retry
  }
}
```

**🔍 CHECKPOINT 1.4:** Simular API externa down. Verificar que circuit breaker abre após 5 falhas. Verificar que rate limit protege a API externa.

---

### ✅ COMMIT MÓDULO 1
```
feat(infra): supabase schema v2, job queue, encryption, rate limiting
- Adicionar migrações de audit_log, workspace_members, workflow_jobs, connectors
- Implementar BullMQ worker no EasyPanel
- Implementar encryption via Supabase Vault
- Implementar rate limiter e circuit breaker para conectores externos
```

---

## Módulo 2 — Motor de Integrações (Connector Engine)
> **Deploy: silencioso. Usuário não vê ainda — back-end apenas.**  
> **Duração estimada:** 1 semana

### Contexto
O coração da v2.0. Um sistema padronizado que permite adicionar qualquer conector novo em horas, não dias. Hoje provavelmente cada integração foi feita de forma ad-hoc. O Módulo 2 cria a arquitetura que suporta 300+ conectores de forma consistente.

---

### 2.1 — Interface Padrão de Conector 🔍

```typescript
// types/connector.ts
interface ConnectorDefinition {
  slug: string
  name: string
  category: ConnectorCategory
  authType: 'oauth2' | 'api_key' | 'webhook' | 'basic'

  // Autenticação
  auth: {
    oauth2?: OAuth2Config
    apiKey?: ApiKeyConfig
  }

  // Triggers: eventos que o conector gera (ex: "novo pedido")
  triggers: TriggerDefinition[]

  // Actions: ações que o conector executa (ex: "criar contato")
  actions: ActionDefinition[]

  // Opcional: polling para APIs sem webhook
  polling?: {
    interval: number
    endpoint: string
    transform: (data: any) => any
  }
}

interface TriggerDefinition {
  slug: string             // ex: 'new_order'
  name: string             // ex: 'Novo Pedido'
  description: string
  outputSchema: JSONSchema  // shape dos dados que o trigger entrega
  webhookPath?: string      // se usa webhook
}

interface ActionDefinition {
  slug: string             // ex: 'create_contact'
  name: string             // ex: 'Criar Contato'
  description: string
  inputSchema: JSONSchema  // campos que o usuário configura
  outputSchema: JSONSchema // o que a action retorna
  execute: (credentials: any, input: any) => Promise<ActionResult>
}
```

**Regra importante:** cada conector é um arquivo isolado em `/connectors/[slug]/index.ts`. Nenhuma lógica de conector dentro do core do sistema.

**🔍 CHECKPOINT 2.1:** Verificar que a interface é type-safe. Criar conector de teste (`test-connector`) usando a interface e validar que o sistema o reconhece corretamente.

---

### 2.2 — OAuth2 Flow Universal 🔍

Implementar um handler OAuth2 genérico que qualquer conector pode usar:

```
GET  /api/integrations/connect/[slug]          -- inicia OAuth
GET  /api/integrations/callback/[slug]         -- recebe callback
POST /api/integrations/disconnect/[slug]       -- remove integração
GET  /api/integrations/refresh/[slug]          -- força refresh do token
POST /api/integrations/test/[slug]             -- testa se a integração está funcionando
```

Fluxo:
1. Usuário clica "Conectar HubSpot"
2. Sistema redireciona para OAuth do HubSpot com state seguro
3. HubSpot retorna para `/callback/hubspot` com code
4. Sistema troca code por access_token + refresh_token
5. Salva no Supabase (encriptado)
6. Redireciona usuário para tela de confirmação

**🔍 CHECKPOINT 2.2:** Testar fluxo completo de OAuth com conector real (sugestão: usar GitHub para teste, que tem OAuth simples). Verificar state CSRF. Verificar que tokens são encriptados no banco.

---

### 2.3 — Webhook Receiver Universal 🔍

```
POST /api/webhooks/[workspace_id]/[connector_slug]
```

Este endpoint único recebe todos os webhooks externos:
- Valida assinatura do webhook (cada conector tem sua forma de assinar)
- Retorna 200 imediatamente
- Enfileira o processamento no BullMQ
- Registra no audit log

```typescript
// app/api/webhooks/[workspaceId]/[connectorSlug]/route.ts
export async function POST(req: Request, { params }) {
  const rawBody = await req.text()

  // 1. Validar assinatura (conector-específico)
  const connector = getConnector(params.connectorSlug)
  const isValid = await connector.validateWebhookSignature(req.headers, rawBody)
  if (!isValid) return new Response('Unauthorized', { status: 401 })

  // 2. Retornar 200 imediatamente
  const job = await webhookQueue.add('process', {
    workspaceId: params.workspaceId,
    connectorSlug: params.connectorSlug,
    payload: JSON.parse(rawBody),
    receivedAt: new Date()
  })

  return new Response('OK', { status: 200 })
}
```

**🔍 CHECKPOINT 2.3:** Simular webhooks com payload incorreto, assinatura inválida, body malformado. Verificar que o endpoint sempre retorna 200 mesmo com erro interno (para evitar reenvios infinitos do sender).

---

### 2.4 — UI: Tela de Integrações 🔍

Primeira parte visível ao usuário deste módulo.

```
/settings/integrations
  - Grid de conectores disponíveis por categoria
  - Filtro por: Todos | E-commerce | CRM | Marketing | Financeiro | Comunicação
  - Card de cada conector: logo, nome, status (conectado/não conectado), botão conectar
  - Tela de detalhes do conector: campos de configuração, status, última sincronização, botão desconectar
  - Badge "Beta" nos conectores ainda em teste
```

Design: seguir o padrão visual atual do SyncroFlow. Não introduzir novo sistema de design neste módulo.

**🔍 CHECKPOINT 2.4:** Testar responsividade. Testar estados: sem integrações, com algumas, com erro em uma. Verificar que dados sensíveis (tokens) nunca aparecem na UI.

---

### ✅ COMMIT MÓDULO 2
```
feat(connector-engine): motor universal de integrações
- Interface padrão ConnectorDefinition
- OAuth2 flow universal
- Webhook receiver universal com validação de assinatura
- UI de gerenciamento de integrações
```

---

## Módulo 3 — Integrações E-commerce 🛒
> **Deploy: imediato após módulo 2. Anunciar para clientes.**  
> **Duração estimada:** 3 semanas (expandido para 8 plataformas)

### Contexto
Maior gap atual vs. concorrentes. E-commerce é a vertical com mais demanda de automação no Brasil. Este módulo cobre as **11 principais plataformas de e-commerce e marketplaces do Brasil**, tornando o SyncroFlow a ferramenta de automação com maior cobertura de canais de venda no mercado nacional. Inclui lojas virtuais, marketplaces tradicionais e os novos marketplaces de social commerce. Este módulo sozinho abre dois segmentos de clientes: lojistas com loja própria e vendedores de marketplace.

**Plataformas cobertas neste módulo:**
| Plataforma | Tipo | Auth | Base de clientes BR | Prioridade |
|---|---|---|---|---|
| Nuvemshop | Loja virtual | OAuth2 | 120k+ lojistas | 🔴 Máxima |
| Shopify | Loja virtual | OAuth2 | Crescimento acelerado no BR | 🔴 Máxima |
| Mercado Livre | Marketplace | OAuth2 | Maior marketplace BR | 🔴 Máxima |
| Bling ERP | ERP | OAuth2 | ERP líder para e-commerce pequeno | 🔴 Máxima |
| TikTok Shop | Social marketplace | OAuth2 | 102x crescimento em 2025-26 | 🔴 Máxima |
| Shopee | Marketplace | API Key | 2º maior marketplace BR | 🔴 Máxima |
| Tray Commerce | Loja virtual | OAuth2 | Forte em médias lojas BR | 🟠 Alta |
| Loja Integrada | Loja virtual | API Key | Popular em microempreendedores | 🟠 Alta |
| Bagy | Loja virtual | API Key + Webhooks | Crescendo rapidamente no BR | 🟠 Alta |
| Tiny ERP | ERP | API Key | Par do Bling, base fiel | 🟠 Alta |
| Shein | Marketplace | API Key | Expansão marketplace BR 2026 | 🟡 Média |

**Estratégia de implementação:** as plataformas foram agrupadas em 4 blocos (3.A, 3.B, 3.C, 3.D) para reduzir erros e facilitar testes isolados. Cada bloco é revisado antes de avançar para o próximo.

**Por que TikTok Shop e Shopee são prioridade máxima:** vendedores que operam em múltiplos canais simultaneamente (Shopee + TikTok Shop + Mercado Livre + loja própria) têm a maior dor de automação do mercado — estoque desatualizado entre canais, respostas lentas que penalizam ranking, NF-e manual para cada pedido. Nenhum concorrente resolve isso em PT-BR de forma acessível. Esse é o perfil de cliente com maior urgência e maior disposição a pagar.

---

---

### 🔵 BLOCO 3.A — Nuvemshop + Shopify
> Implementar juntas: ambas usam OAuth2 e têm estrutura de webhooks similar. Reutilizar o mesmo OAuth handler com config diferente.
> **Bloco focado em:** lojas virtuais próprias com maior volume de lojistas no BR.

---

### 3.1 — Nuvemshop Integration 🔍

**Autenticação:** OAuth2  
**Documentação:** https://tiendanube.github.io/api-documentation/

Triggers a implementar:
```
nuvemshop/new_order          -- Novo pedido criado
nuvemshop/order_paid         -- Pedido pago
nuvemshop/order_shipped      -- Pedido enviado
nuvemshop/order_cancelled    -- Pedido cancelado
nuvemshop/new_customer       -- Novo cliente cadastrado
nuvemshop/abandoned_cart     -- Carrinho abandonado
nuvemshop/low_stock          -- Produto com estoque baixo
```

Actions a implementar:
```
nuvemshop/get_order          -- Buscar dados de um pedido
nuvemshop/update_order       -- Atualizar status do pedido
nuvemshop/get_product        -- Buscar produto
nuvemshop/update_stock       -- Atualizar estoque
nuvemshop/create_coupon      -- Criar cupom de desconto
nuvemshop/get_customer       -- Buscar dados do cliente
```

Caso de uso prioritário a documentar e criar template:
> "Quando cliente faz pedido → enviar WhatsApp de confirmação com número do pedido e previsão de entrega"

**🔍 CHECKPOINT 3.1:** Testar cada trigger com pedido real em loja de teste Nuvemshop. Verificar mapeamento correto dos campos. Testar ação de atualizar status.

---

### 3.2 — Shopify Integration 🔍

**Autenticação:** OAuth2 (Shopify Partner App)  
**Documentação:** https://shopify.dev/docs/api/webhooks  
**Observação:** Shopify usa HMAC-SHA256 para assinar webhooks — verificar obrigatoriamente antes de processar.  
**Importante:** Shopify cobra por API call em volume — implementar cache de respostas e respeitar rate limit de 40 req/s.

Triggers a implementar:
```
shopify/orders_create          -- Novo pedido criado
shopify/orders_paid            -- Pedido pago (financial_status = paid)
shopify/orders_fulfilled       -- Pedido marcado como enviado
shopify/orders_cancelled       -- Pedido cancelado
shopify/orders_partially_refunded -- Reembolso parcial
shopify/customers_create       -- Novo cliente cadastrado
shopify/customers_update       -- Cliente atualizado
shopify/inventory_levels_update -- Estoque atualizado
shopify/carts_create           -- Carrinho criado (para abandono)
shopify/checkouts_create       -- Checkout iniciado
shopify/checkouts_delete       -- Checkout abandonado (não finalizou)
shopify/products_update        -- Produto atualizado
```

Actions a implementar:
```
shopify/get_order              -- Buscar dados completos do pedido
shopify/update_order           -- Atualizar tags/notas do pedido
shopify/cancel_order           -- Cancelar pedido
shopify/create_refund          -- Criar reembolso
shopify/get_customer           -- Buscar dados do cliente
shopify/update_customer        -- Atualizar tags/notas do cliente
shopify/get_product            -- Buscar produto e variantes
shopify/update_inventory       -- Atualizar nível de estoque
shopify/create_discount        -- Criar código de desconto
shopify/send_invoice           -- Enviar invoice por e-mail ao cliente
```

Nota para o Claude Code:
> Shopify tem dois tipos de webhooks: **app webhooks** (registrados via API) e **manual webhooks** (configurados no painel). Usar app webhooks — eles são registrados automaticamente quando a loja conecta o SyncroFlow. Usar a versão de API `2026-01` ou mais recente.

**🔍 CHECKPOINT 3.2:** Verificar validação HMAC em todos os webhooks recebidos. Testar fluxo OAuth completo com Shopify Partner account. Testar abandono de carrinho (checkouts_delete). Verificar cache de respostas para não estourar rate limit.

---

### 🔵 BLOCO 3.B — Mercado Livre + Tray + Loja Integrada
> Implementar juntas: as três têm APIs REST brasileiras com webhook notification system similar.

---

### 3.3 — Mercado Livre Integration 🔍

**Autenticação:** OAuth2  
**Documentação:** https://developers.mercadolibre.com.br/

Triggers a implementar:
```
mercadolivre/new_order       -- Nova venda realizada
mercadolivre/order_paid      -- Pagamento confirmado
mercadolivre/new_question    -- Comprador fez uma pergunta
mercadolivre/new_message     -- Nova mensagem no chat
mercadolivre/low_stock       -- Anúncio com estoque crítico
```

Actions a implementar:
```
mercadolivre/answer_question -- Responder pergunta
mercadolivre/send_message    -- Enviar mensagem ao comprador
mercadolivre/get_order       -- Buscar dados do pedido
mercadolivre/update_stock    -- Atualizar estoque do anúncio
mercadolivre/pause_listing   -- Pausar anúncio
```

Caso de uso prioritário:
> "Quando comprador faz pergunta → IA gera resposta baseada no catálogo e envia automaticamente"

**🔍 CHECKPOINT 3.3:** Testar OAuth com conta ML de teste. Verificar que notifications chegam corretamente. Testar resposta automática de perguntas.

---

### 3.4 — Tray Commerce Integration 🔍

**Autenticação:** OAuth2  
**Documentação:** https://developers.tray.com.br/  
**Observação:** Tray usa um sistema de notificações próprio — não é webhook push padrão. O sistema envia um aviso e o SyncroFlow precisa fazer um GET para buscar os detalhes do evento.

Triggers a implementar:
```
tray/new_order                 -- Novo pedido criado
tray/order_status_changed      -- Status do pedido alterado
tray/order_paid                -- Pedido com pagamento aprovado
tray/order_shipped             -- Pedido despachado
tray/new_customer              -- Novo cliente cadastrado
tray/low_stock                 -- Produto com estoque abaixo do mínimo
tray/abandoned_cart            -- Carrinho abandonado
```

Actions a implementar:
```
tray/get_order                 -- Buscar pedido completo
tray/update_order_status       -- Atualizar status do pedido
tray/get_product               -- Buscar produto
tray/update_stock              -- Atualizar estoque
tray/get_customer              -- Buscar cliente
tray/create_coupon             -- Criar cupom de desconto
```

Nota para o Claude Code:
> Tray usa sistema de notificação com polling diferente do webhook push. Ao receber a notificação, fazer GET em `/orders/{id}` para buscar os dados completos. Implementar timeout e retry para esse segundo GET.

**🔍 CHECKPOINT 3.4:** Testar fluxo completo de notificação → polling → processamento. Verificar que o sistema não processa o mesmo evento duas vezes (idempotência). Testar em conta Tray de desenvolvimento.

---

### 3.5 — Loja Integrada Integration 🔍

**Autenticação:** API Key (chave_aplicacao + chave_api por loja)  
**Documentação:** https://api-docs.lojaintegrada.com.br/  
**Observação:** Loja Integrada tem duas chaves: a `chave_aplicacao` identifica o SyncroFlow como integrador, e a `chave_api` identifica a loja específica do cliente. Ambas são necessárias em cada request.

Triggers a implementar:
```
lojaintegrada/new_order        -- Novo pedido realizado
lojaintegrada/order_paid       -- Pedido pago
lojaintegrada/order_shipped    -- Pedido despachado
lojaintegrada/order_cancelled  -- Pedido cancelado
lojaintegrada/new_customer     -- Novo cliente cadastrado
lojaintegrada/product_updated  -- Produto atualizado
```

Actions a implementar:
```
lojaintegrada/get_order        -- Buscar dados do pedido
lojaintegrada/update_order_status -- Atualizar situação do pedido
lojaintegrada/get_product      -- Buscar produto
lojaintegrada/update_stock     -- Atualizar estoque
lojaintegrada/get_customer     -- Buscar dados do cliente
```

Configuração especial no onboarding:
> O usuário precisará informar sua `chave_api` da loja durante a configuração da integração. Criar UI clara explicando onde encontrar essa chave no painel da Loja Integrada. Não confundir com a `chave_aplicacao` que é do SyncroFlow (fica no .env do servidor).

**🔍 CHECKPOINT 3.5:** Testar autenticação com as duas chaves. Verificar rate limit (100 req/min por loja — implementar throttle). Testar webhook de novo pedido. Verificar que o onboarding é claro para o usuário encontrar a chave API.

---

### 🔵 BLOCO 3.C — Bagy + Bling + Tiny
> Implementar juntas: Bagy com API Key moderna, Bling e Tiny como par de ERPs com lógica similar.

---

### 3.6 — Bagy Integration 🔍

**Autenticação:** API Key + Bearer Token  
**Documentação:** https://basedeconhecimento.bagy.com.br/hc/pt-br/categories/23326946048660  
**Observação:** Bagy tem um sistema de webhooks nativo bem documentado — um dos mais modernos entre as plataformas brasileiras. Suporta eventos granulares.

Triggers a implementar:
```
bagy/order_created             -- Novo pedido criado
bagy/order_paid                -- Pagamento confirmado
bagy/order_approved            -- Pedido aprovado
bagy/order_dispatched          -- Pedido despachado
bagy/order_delivered           -- Pedido entregue
bagy/order_cancelled           -- Pedido cancelado
bagy/order_refunded            -- Pedido reembolsado
bagy/customer_created          -- Novo cliente
bagy/abandoned_cart            -- Carrinho abandonado
bagy/product_stock_updated     -- Estoque atualizado
```

Actions a implementar:
```
bagy/get_order                 -- Buscar pedido
bagy/update_order_status       -- Atualizar status
bagy/get_customer              -- Buscar cliente
bagy/get_product               -- Buscar produto e estoque
bagy/create_discount_coupon    -- Criar cupom
bagy/cancel_order              -- Cancelar pedido
```

Configuração de webhook no onboarding:
> Ao conectar a Bagy, o SyncroFlow deve registrar automaticamente o webhook URL no painel da Bagy via API (Settings > APIs e Webhooks). Criar o registro programaticamente para não exigir que o usuário configure manualmente.

**🔍 CHECKPOINT 3.6:** Testar registro automático de webhook via API. Verificar todos os eventos de status de pedido. Testar carrinho abandonado (tem delay — verificar lógica de timing). Testar em loja Bagy de desenvolvimento.

---

### 3.7 — Bling ERP Integration 🔍

**Autenticação:** OAuth2 (Bling V3)  
**Documentação:** https://developer.bling.com.br/

Triggers a implementar:
```
bling/new_order              -- Novo pedido de venda
bling/invoice_issued         -- NF-e emitida
bling/payment_received       -- Pagamento lançado
bling/low_stock              -- Produto com estoque mínimo
```

Actions a implementar:
```
bling/create_order           -- Criar pedido de venda
bling/issue_invoice          -- Emitir NF-e
bling/get_product            -- Buscar produto/estoque
bling/create_contact         -- Criar contato/cliente
bling/launch_payment         -- Lançar pagamento recebido
```

Caso de uso prioritário:
> "Quando pedido é pago na Nuvemshop → criar pedido no Bling → emitir NF-e → enviar por e-mail automaticamente"
*(Este é o fluxo multi-conector mais valioso do módulo 3)*

**🔍 CHECKPOINT 3.7:** Testar emissão de NF-e em ambiente sandbox Bling. Verificar fluxo completo Nuvemshop → Bling. Verificar tratamento de erros fiscais (SEFAZ fora do ar, dados inválidos).

---

### 3.8 — Tiny ERP Integration 🔍

**Autenticação:** API Key  
**Documentação:** https://www.tiny.com.br/api/docs/  
**Observação:** Tiny e Bling são concorrentes diretos com bases de clientes distintas — o Tiny tem forte penetração em e-commerces que vieram da Tray e Loja Integrada. Implementar com a mesma interface do Bling para facilitar templates multi-ERP.

Triggers a implementar:
```
tiny/new_order                 -- Novo pedido de venda
tiny/invoice_issued            -- NF-e emitida
tiny/payment_received          -- Pagamento lançado
tiny/low_stock                 -- Produto com estoque mínimo
tiny/order_status_changed      -- Status do pedido alterado
```

Actions a implementar:
```
tiny/create_order              -- Criar pedido de venda
tiny/issue_invoice             -- Emitir NF-e
tiny/get_product               -- Buscar produto/estoque
tiny/create_contact            -- Criar contato/cliente
tiny/update_stock              -- Atualizar estoque
tiny/get_order                 -- Buscar pedido
```

Nota para o Claude Code:
> Tiny tem API v2 e v3. Usar **v3** (mais recente e com suporte ativo). A v2 ainda funciona mas está sendo descontinuada. Documentar claramente a versão usada no conector.

**🔍 CHECKPOINT 3.8:** Verificar paridade de funcionalidades com Bling. Testar NF-e no sandbox Tiny. Documentar diferenças de comportamento entre Bling e Tiny (campos diferentes, status diferentes).

---

### 🔵 BLOCO 3.D — TikTok Shop + Shopee + Shein
> Implementar juntos: os três são marketplaces externos (não lojas do cliente). A lógica de negócio é diferente dos blocos anteriores — aqui o cliente **vende dentro** da plataforma, não tem controle total sobre a experiência.  
> **Atenção especial:** estes marketplaces penalizam vendedores por resposta lenta — o agente de IA do Módulo 7 tem integração direta com este bloco.  
> **Caso de uso central:** sincronização de estoque em tempo real entre todos os canais para evitar overselling.

---

### 3.9 — TikTok Shop Integration 🔍

**Autenticação:** OAuth2 (TikTok Shop Open Platform)  
**Documentação:** https://developers.tiktok.com/doc/research-api-specs-query-tiktok-shop-info  
**Seller Center:** https://seller.tiktok.com  
**Contexto:** Crescimento de 102x no GMV diário no Brasil entre maio/2025 e maio/2026. O TikTok Shop é o marketplace que mais cresce no BR e tem integração nativa com WhatsApp Business desde 2026.

Triggers a implementar:
```
tiktokshop/new_order              -- Novo pedido realizado
tiktokshop/order_paid             -- Pagamento confirmado
tiktokshop/order_shipped          -- Pedido enviado pelo vendedor
tiktokshop/order_cancelled        -- Pedido cancelado pelo comprador
tiktokshop/order_return_requested -- Solicitação de devolução
tiktokshop/new_product_comment    -- Comentário em produto (avaliação)
tiktokshop/low_stock              -- Produto com estoque crítico
tiktokshop/live_order             -- Pedido feito durante live (prioridade de fulfillment)
```

Actions a implementar:
```
tiktokshop/get_order              -- Buscar dados do pedido
tiktokshop/update_shipping        -- Atualizar código de rastreio
tiktokshop/confirm_order          -- Confirmar pedido (obrigatório para envio)
tiktokshop/cancel_order           -- Cancelar pedido
tiktokshop/update_stock           -- Atualizar estoque do produto
tiktokshop/get_product            -- Buscar produto e variantes
tiktokshop/update_price           -- Atualizar preço do produto
tiktokshop/reply_comment          -- Responder comentário/avaliação
```

Notas críticas para o Claude Code:
> 1. TikTok Shop tem **SLA de confirmação de pedido** — o vendedor precisa confirmar em até 2 dias ou o pedido é cancelado automaticamente. Implementar trigger de alerta antes do prazo vencer.
> 2. Pedidos de **live commerce** têm prazo de fulfillment menor — identificar pelo campo `order_type` e tratar com prioridade.
> 3. A API do TikTok Shop no Brasil usa versão regionalizada — verificar endpoints específicos para `pt-BR` vs endpoints globais.
> 4. Autenticação OAuth2 do TikTok tem escopo diferenciado entre `seller` (gestão de loja) e `business` (anúncios). Usar escopo `seller`.

**🔍 CHECKPOINT 3.9a:** Testar OAuth com conta TikTok Shop BR. Verificar que pedido de live é identificado corretamente. Testar alerta de SLA de confirmação. Verificar atualização de estoque reflete imediatamente na plataforma.

---

### 3.10 — Shopee Integration 🔍

**Autenticação:** API Key (Partner ID + Partner Key)  
**Documentação:** https://seller.br.shopee.cn/edu/article/3445  
**Acesso:** https://open.shopee.com (Open Platform para parceiros)  
**Contexto:** Segundo maior marketplace do BR em volume de vendedores. Em 2026 aumentou taxas — vendedores precisam de automação para manter margem.

Triggers a implementar:
```
shopee/new_order               -- Novo pedido criado
shopee/order_ready_to_ship     -- Pedido pronto para envio (prazo inicia aqui)
shopee/order_shipped           -- Pedido coletado pela transportadora
shopee/order_completed         -- Pedido entregue e confirmado
shopee/order_cancelled         -- Pedido cancelado
shopee/return_requested        -- Devolução solicitada
shopee/new_message             -- Nova mensagem do comprador no chat
shopee/low_stock               -- Produto com estoque crítico
shopee/penalty_warning         -- Alerta de penalidade por prazo ou avaliação
```

Actions a implementar:
```
shopee/get_order               -- Buscar dados do pedido
shopee/ship_order              -- Marcar como enviado + código rastreio
shopee/cancel_order            -- Cancelar pedido
shopee/get_tracking_info       -- Buscar status de rastreio
shopee/reply_message           -- Responder mensagem do comprador
shopee/update_stock            -- Atualizar estoque de produto
shopee/update_price            -- Atualizar preço
shopee/get_shop_performance    -- Buscar métricas da loja (avaliação, penalidades)
```

Notas críticas para o Claude Code:
> 1. **Penalidade por resposta lenta:** a Shopee rebaixa o ranking se o vendedor não responde mensagens em < 12h. O agente de IA deve ser conectado ao `shopee/new_message` para resposta automática em segundos.
> 2. **Prazo de envio:** após `order_ready_to_ship`, o vendedor tem prazo fixo (normalmente 2 dias úteis) para postar o pedido. Implementar alerta automático quando o prazo está próximo.
> 3. **Assinatura de webhook Shopee:** usa HMAC-SHA256 com `Partner Key`. Verificar obrigatoriamente em todo request recebido.
> 4. **Ambiente de teste:** Shopee tem sandbox em `https://partner.test-stable.shopeemobile.com`. Usar para desenvolvimento e testes.

**🔍 CHECKPOINT 3.9b:** Testar no sandbox Shopee. Verificar validação HMAC. Simular nova mensagem → agente responde em < 3s. Testar alerta de prazo de envio. Verificar que penalidade_warning dispara notificação para o vendedor.

---

### 3.11 — Shein Marketplace Integration 🔍

**Autenticação:** API Key (credenciais via parceria oficial Shein)  
**Referência:** Bling é o 1º parceiro oficial de ERP da Shein no BR — a integração segue o mesmo padrão  
**Contexto:** Shein cobra 16% de comissão (0% nos 3 primeiros meses). Expansão de marketplace com vendedores brasileiros é foco em 2026.

> **Atenção para o Claude Code:** a API da Shein para marketplace não tem documentação pública aberta como Shopee e TikTok Shop. O acesso é via **parceria oficial** com a Shein. Implementar este conector requer que o SyncroFlow solicite acesso como parceiro integrador. Enquanto o acesso não é aprovado, implementar o conector usando o mesmo padrão dos demais e deixar como `is_beta: true` no catálogo.

Triggers a implementar:
```
shein/new_order                -- Novo pedido recebido
shein/order_paid               -- Pagamento confirmado pela Shein
shein/order_shipped            -- Pedido enviado ao comprador
shein/order_returned           -- Devolução recebida
shein/product_approved         -- Produto aprovado para publicação
shein/product_rejected         -- Produto rejeitado (com motivo)
shein/low_stock                -- Produto com estoque baixo
```

Actions a implementar:
```
shein/get_order                -- Buscar pedido
shein/update_shipping          -- Informar código de rastreio
shein/get_product_status       -- Verificar status de aprovação do produto
shein/update_stock             -- Atualizar estoque
shein/update_price             -- Atualizar preço
shein/get_commission_report    -- Buscar relatório de comissões
```

Nota de negócio para o Claude Code:
> A Shein tem processo de aprovação de produtos antes da publicação — às vezes demora dias. Implementar o trigger `product_rejected` com notificação detalhada do motivo é muito valioso para o vendedor: ele recebe por WhatsApp o motivo da rejeição e pode corrigir rapidamente.

**🔍 CHECKPOINT 3.9c:** Como a API Shein requer parceria oficial, testar com mock/stub das respostas da API. Documentar claramente o processo de ativação da parceria. Lançar como beta com aviso na UI: "Disponível após aprovação do SyncroFlow como parceiro Shein — estimativa: [data]".

---

### 3.12 — Hub de Sincronização Multi-Canal 🔍

> Este é o diferencial que nenhum concorrente entrega de forma simples. Um vendedor com 4 canais (Shopee + TikTok Shop + Mercado Livre + Nuvemshop) precisa que o estoque seja sincronizado em tempo real entre todos. Se vende 1 unidade na Shopee, todos os outros canais precisam saber.

```typescript
// lib/multichannel-sync.ts

interface StockSyncConfig {
  workspaceId: string
  masterSource: string            // qual conector é a "fonte da verdade" (ex: Bling)
  channels: string[]              // quais canais sincronizar (ex: ['shopee', 'tiktokshop', 'mercadolivre'])
  safetyBuffer: number            // % de buffer de segurança (ex: 0.1 = manter 10% reservado)
  syncOnSale: boolean             // sincronizar imediatamente quando vender
  syncOnReturn: boolean           // sincronizar quando houver devolução
}

// Fluxo:
// 1. Venda ocorre em qualquer canal
// 2. Trigger dispara → decrementar no ERP (Bling/Tiny)
// 3. Hub busca estoque atualizado do ERP
// 4. Atualiza simultaneamente em todos os outros canais
// 5. Se estoque = 0 → pausar anúncio em todos os canais automaticamente
// 6. Log de sincronização salvo para auditoria
```

UI para o usuário configurar:
```
/integrations/multichannel-sync
  - Selecionar fonte de verdade (ERP)
  - Selecionar canais para sincronizar
  - Configurar buffer de segurança
  - Ativar/desativar sincronização automática
  - Log de sincronizações recentes com status
```

**🔍 CHECKPOINT 3.12:** Simular venda simultânea em dois canais para o mesmo produto (race condition). Verificar que estoque nunca fica negativo. Testar pausa automática de anúncios quando zera estoque. Verificar latência da sincronização (meta: < 30 segundos entre a venda e a atualização nos outros canais).

---

### 3.13 — Templates Marketplaces (Bloco 3.D) 🔍

```
Template 11: "Resposta automática de mensagens Shopee"
  Trigger: Shopee → Nova mensagem do comprador
  Action: IA → Analisar pergunta → Responder automaticamente se for FAQ
         → Se não for FAQ → WhatsApp para o vendedor com contexto

Template 12: "Alerta de prazo de envio Shopee"
  Trigger: Shopee → Pedido pronto para envio
  Action: Aguardar (prazo - 8h) → WhatsApp → "Você tem até [hora] para postar o pedido #X"

Template 13: "Pedido TikTok Shop → confirmar + NF-e"
  Trigger: TikTok Shop → Novo Pedido
  Action: TikTok Shop → Confirmar pedido → Bling → Emitir NF-e → Gmail → enviar ao comprador

Template 14: "Live commerce → prioridade de fulfillment"
  Trigger: TikTok Shop → Pedido de live
  Action: WhatsApp para o time de logística → "URGENTE: pedido de live #X — postar hoje"

Template 15: "Sincronização de estoque multi-canal"
  Trigger: Qualquer marketplace → Venda realizada
  Action: Bling → Decrementar estoque → Atualizar Shopee + TikTok Shop + ML + loja própria

Template 16: "Produto rejeitado na Shein → notificar com motivo"
  Trigger: Shein → Produto rejeitado
  Action: WhatsApp → Notificar vendedor com nome do produto e motivo da rejeição

Template 17: "Estoque zerado → pausar em todos os canais"
  Trigger: Bling/Tiny → Estoque = 0
  Action: Pausar anúncio em Shopee + TikTok Shop + Mercado Livre simultaneamente
```

**🔍 CHECKPOINT 3.13:** Testar Template 15 (sincronização multi-canal) com race condition. Testar Template 11 com 10 tipos diferentes de perguntas. Verificar que o Template 17 pausa em TODOS os canais configurados, não só em um.

---

### 3.14 — Templates E-commerce Consolidados (todos os blocos) 🔍

> Revisar todos os 17 templates (10 do plano original + 7 novos do Bloco 3.D). Garantir consistência de naming, UX de instalação e documentação de cada template.

**🔍 CHECKPOINT 3.14:** Testar instalação de cada um dos 17 templates do zero, como se fosse um usuário novo. Verificar que cada template tem: título claro, descrição do que faz, lista de conectores necessários, e é ativável em menos de 3 minutos.

Criar 10 templates prontos cobrindo todas as 8 plataformas do módulo:

```
Template 1: "Confirmação de pedido via WhatsApp" (multi-plataforma)
  Trigger: Nuvemshop OU Shopify OU Tray OU Loja Integrada OU Bagy → Novo Pedido
  Action: WhatsApp → mensagem com número do pedido, valor e previsão de entrega
  Nota: criar uma versão do template para cada plataforma

Template 2: "Pedido pago → Emitir NF-e automaticamente"
  Trigger: Nuvemshop → Pedido Pago
  Action: Bling → Criar pedido → Emitir NF-e → Gmail → enviar NF-e por e-mail
  Variante: mesmo fluxo com Tiny no lugar do Bling

Template 3: "Resposta automática de perguntas ML com IA"
  Trigger: Mercado Livre → Nova Pergunta
  Action: IA (GPT/Claude) → Gerar resposta baseada no catálogo → ML → Responder

Template 4: "Alerta de estoque crítico para o gestor"
  Trigger: Bling OU Tiny → Estoque Mínimo
  Action: WhatsApp → Avisar responsável com nome do produto e qtd atual

Template 5: "Carrinho abandonado → Recuperação D+1"
  Trigger: Nuvemshop OU Shopify OU Bagy → Carrinho Abandonado (após 1h)
  Action: WhatsApp → mensagem de recuperação com link do carrinho

Template 6: "Shopify → Pedido despachado → rastreio no WhatsApp"
  Trigger: Shopify → Pedido Fulfilled (enviado)
  Action: WhatsApp → código de rastreio + link dos Correios/transportadora

Template 7: "Novo cliente → boas-vindas multi-canal"
  Trigger: Qualquer plataforma → Novo Cliente Cadastrado
  Action: WhatsApp → boas-vindas + cupom de 10% → Gmail → e-mail de boas-vindas

Template 8: "Tray/LI → Pedido pago → sincronizar no Bling"
  Trigger: Tray OU Loja Integrada → Pedido Pago
  Action: Bling → Criar pedido de venda → Emitir NF-e

Template 9: "Pedido cancelado → reverter estoque + avisar"
  Trigger: Qualquer plataforma → Pedido Cancelado
  Action: Bling/Tiny → Reverter estoque → WhatsApp → Avisar gestor

Template 10: "Pergunta frequente no ML → resposta instantânea"
  Trigger: Mercado Livre → Nova Pergunta
  Action: Verificar se é FAQ (frete, prazo, cor) → Se sim, responder automaticamente
         → Se não, notificar operador via WhatsApp
```

**🔍 CHECKPOINT 3.9:** Testar cada template end-to-end. Verificar que templates multi-plataforma funcionam para todas as variantes. Verificar delays (Template 5 deve respeitar o tempo de 1h). Confirmar que usuário consegue instalar qualquer template em menos de 3 minutos.

---

### ✅ COMMIT MÓDULO 3
```
feat(ecommerce): 11 integrações de e-commerce + marketplaces + 17 templates

Lojas virtuais:
- Nuvemshop: 7 triggers + 6 actions + OAuth2
- Shopify: 12 triggers + 10 actions + OAuth2 + HMAC validation
- Tray Commerce: 7 triggers + 6 actions + OAuth2 + polling
- Loja Integrada: 6 triggers + 5 actions + API Key dupla
- Bagy: 10 triggers + 6 actions + API Key + webhook auto-register

Marketplaces:
- Mercado Livre: 5 triggers + 5 actions + OAuth2
- TikTok Shop: 8 triggers + 8 actions + OAuth2 + live commerce
- Shopee: 9 triggers + 8 actions + API Key + HMAC + penalidade tracking
- Shein: 7 triggers + 6 actions + API Key (beta — requer parceria oficial)

ERPs:
- Bling: 4 triggers + 5 actions + OAuth2 V3 + NF-e
- Tiny: 5 triggers + 6 actions + API Key V3 + NF-e

Hub:
- Multi-channel stock sync (sincronização em tempo real entre todos os canais)

Templates: 17 templates prontos (10 e-commerce + 7 marketplace)
```

---

## Módulo 4 — Integrações CRM & Vendas
> **Deploy: após módulo 3. Anunciar separadamente.**  
> **Duração estimada:** 1 semana

### 4.1 — HubSpot Integration 🔍

**Autenticação:** OAuth2  
O conector mais solicitado globalmente.

Triggers:
```
hubspot/new_contact          -- Novo contato criado
hubspot/deal_stage_changed   -- Negócio mudou de fase
hubspot/form_submitted       -- Formulário preenchido
hubspot/contact_updated      -- Contato atualizado
```

Actions:
```
hubspot/create_contact       -- Criar contato
hubspot/update_contact       -- Atualizar propriedades
hubspot/create_deal          -- Criar negócio
hubspot/move_deal_stage      -- Mover negócio de fase
hubspot/add_note             -- Adicionar nota ao contato
hubspot/enroll_sequence      -- Adicionar em sequência de e-mail
```

**🔍 CHECKPOINT 4.1:** Testar com conta HubSpot Free (disponível gratuitamente para teste). Verificar mapeamento de propriedades customizadas.

---

### 4.2 — Pipedrive Integration 🔍

**Autenticação:** OAuth2  
Muito usado por times de vendas B2B no Brasil.

Triggers:
```
pipedrive/new_deal           -- Novo negócio criado
pipedrive/deal_won           -- Negócio ganho
pipedrive/deal_lost          -- Negócio perdido
pipedrive/new_activity       -- Nova atividade criada
```

Actions:
```
pipedrive/create_person      -- Criar pessoa
pipedrive/create_deal        -- Criar negócio
pipedrive/update_deal        -- Atualizar negócio
pipedrive/add_note           -- Adicionar nota
pipedrive/create_activity    -- Criar atividade de follow-up
```

**🔍 CHECKPOINT 4.2:** Testar fluxo: "Lead no WhatsApp → criar deal no Pipedrive → agendar follow-up".

---

### 4.3 — RD Station CRM Integration 🔍

**Autenticação:** OAuth2  
Produto brasileiro — provável que já exista parcialmente. Revisar e padronizar na nova arquitetura.

Triggers:
```
rdcrm/new_deal               -- Nova oportunidade
rdcrm/deal_stage_changed     -- Oportunidade mudou de fase
rdcrm/activity_due           -- Atividade vencendo
```

Actions:
```
rdcrm/create_contact         -- Criar contato
rdcrm/create_deal            -- Criar oportunidade
rdcrm/update_deal_stage      -- Atualizar fase
rdcrm/add_annotation         -- Adicionar anotação
```

**🔍 CHECKPOINT 4.3:** Verificar se integração anterior existia. Se sim, migrar para a nova arquitetura de connector. Testar compatibilidade.

---

### 4.4 — Templates CRM 🔍

```
Template 6: "Lead no WhatsApp → pipeline de vendas"
  Trigger: WhatsApp → Mensagem recebida com palavra-chave
  Action: HubSpot/Pipedrive → Criar contato + deal

Template 7: "Deal ganho → onboarding automático"
  Trigger: HubSpot → Deal ganho
  Action: WhatsApp → Mensagem de boas-vindas → Gmail → E-mail com próximos passos

Template 8: "Follow-up automático de leads frios"
  Trigger: Pipedrive → Negócio sem atividade há X dias
  Action: WhatsApp → Mensagem de reengajamento
```

**🔍 CHECKPOINT 4.4:** Testar cada template. Verificar lógica de tempo (delays) nos templates que envolvem espera.

---

### ✅ COMMIT MÓDULO 4
```
feat(crm): integrações HubSpot, Pipedrive, RD Station CRM
- HubSpot: 4 triggers + 6 actions + OAuth2
- Pipedrive: 4 triggers + 5 actions + OAuth2
- RD Station CRM: 3 triggers + 4 actions + OAuth2
- 3 templates de CRM e vendas
```

---

## Módulo 5 — Integrações Financeiras
> **Deploy: após módulo 4.**  
> **Duração estimada:** 1 semana  
> **Foco:** automação de cobrança via WhatsApp — o caso de uso que vende

### 5.1 — Asaas Integration 🔍

**Autenticação:** API Key  
O fintech de cobranças mais usado por PMEs brasileiras (SaaS, clínicas, academias).

Triggers:
```
asaas/payment_confirmed      -- Pagamento confirmado
asaas/payment_overdue        -- Cobrança vencida
asaas/payment_due_today      -- Cobrança vence hoje
asaas/new_customer           -- Novo cliente criado
asaas/subscription_cancelled -- Assinatura cancelada
```

Actions:
```
asaas/create_payment         -- Criar cobrança (boleto/PIX/cartão)
asaas/get_payment_link       -- Buscar link de pagamento
asaas/get_customer           -- Buscar dados do cliente
asaas/create_subscription    -- Criar assinatura recorrente
asaas/cancel_subscription    -- Cancelar assinatura
```

Caso de uso prioritário (o mais vendável deste módulo):
> "Cobrança vence amanhã → WhatsApp com link PIX → Se não pagou em 2 dias → segundo WhatsApp → Se pagou → WhatsApp de agradecimento"

**🔍 CHECKPOINT 5.1:** Testar em ambiente sandbox Asaas. Verificar fluxo completo de cobrança. Verificar que link PIX gerado é válido.

---

### 5.2 — Pagar.me Integration 🔍

**Autenticação:** API Key  
Usado principalmente por e-commerces e SaaS que processam pagamentos no site.

Triggers:
```
pagarme/payment_paid         -- Pagamento aprovado
pagarme/payment_refused      -- Pagamento recusado
pagarme/refund_created       -- Reembolso criado
pagarme/subscription_renewed -- Assinatura renovada
```

Actions:
```
pagarme/get_transaction      -- Buscar transação
pagarme/create_refund        -- Criar reembolso
pagarme/get_customer         -- Buscar cliente
```

**🔍 CHECKPOINT 5.2:** Testar em sandbox Pagar.me. Verificar payload de webhooks (Pagar.me usa formato específico).

---

### 5.3 — Templates Financeiros 🔍

```
Template 9: "Régua de cobrança automática via WhatsApp"
  D-1: WhatsApp → "Seu boleto vence amanhã" + link PIX
  D+1: Se não pago → WhatsApp → "Seu boleto venceu ontem" + novo link
  D+3: Se não pago → WhatsApp → "Última oportunidade antes de suspensão"
  Pagou: WhatsApp → "Pagamento confirmado! Obrigado."

Template 10: "Pagamento confirmado → liberar acesso"
  Trigger: Asaas → Pagamento Confirmado
  Action: Sistema do cliente (webhook) → Liberar acesso + Gmail → Recibo

Template 11: "Churn prevention"
  Trigger: Asaas → Assinatura Cancelada
  Action: Aguardar 1 hora → WhatsApp → Mensagem de retenção com oferta
```

**🔍 CHECKPOINT 5.3:** Testar régua completa com pagamento real em sandbox. Verificar lógica de condicionais (se pagou / se não pagou).

---

### ✅ COMMIT MÓDULO 5
```
feat(finance): integrações Asaas e Pagar.me
- Asaas: 5 triggers + 5 actions + API Key
- Pagar.me: 4 triggers + 3 actions + API Key
- 3 templates de automação financeira
- Régua de cobrança via WhatsApp
```

---

## Módulo 6 — Integrações Marketing
> **Deploy: após módulo 5.**  
> **Duração estimada:** 1 semana

### 6.1 — RD Station Marketing Integration 🔍

**Autenticação:** OAuth2  
Provavelmente a integração de marketing mais importante para o mercado BR.

Triggers:
```
rdmarketing/new_lead         -- Novo lead convertido
rdmarketing/lead_scored      -- Lead atingiu pontuação X
rdmarketing/workflow_entered -- Lead entrou em fluxo de nutrição
```

Actions:
```
rdmarketing/create_lead      -- Criar lead
rdmarketing/update_lead      -- Atualizar campo
rdmarketing/add_to_segment   -- Adicionar a segmento
rdmarketing/send_email       -- Disparar e-mail
rdmarketing/convert_lead     -- Marcar como convertido
```

**🔍 CHECKPOINT 6.1:** Testar com conta RD Station de parceiro ou trial. Verificar que novo lead no RD aciona WhatsApp corretamente.

---

### 6.2 — ActiveCampaign Integration 🔍

**Autenticação:** API Key  
Muito usado por infoprodutores e empresas com e-mail marketing avançado.

Triggers:
```
activecampaign/contact_added       -- Novo contato
activecampaign/tag_added           -- Tag adicionada ao contato
activecampaign/automation_complete -- Automação finalizada
activecampaign/deal_stage_changed  -- Negócio mudou de fase
```

Actions:
```
activecampaign/create_contact  -- Criar contato
activecampaign/add_tag         -- Adicionar tag
activecampaign/remove_tag      -- Remover tag
activecampaign/add_to_list     -- Adicionar à lista
activecampaign/create_deal     -- Criar negócio no CRM interno
```

**🔍 CHECKPOINT 6.2:** Testar integração tag → WhatsApp. Caso de uso: "Comprou o produto → add tag 'cliente' → WhatsApp de boas-vindas".

---

### 6.3 — Templates Marketing 🔍

```
Template 12: "Lead novo → qualificação via WhatsApp"
  Trigger: RD Station → Novo Lead
  Action: WhatsApp → Mensagem de qualificação → Respostas alimentam o CRM

Template 13: "Lead qualificado → notificar vendedor"
  Trigger: RD Station → Lead com pontuação > 50
  Action: WhatsApp para o vendedor responsável com dados do lead

Template 14: "Compra confirmada → nurturing pós-venda"
  Trigger: ActiveCampaign → Tag 'comprou' adicionada
  Action: WhatsApp D+1, D+7, D+30 com conteúdo de onboarding
```

**🔍 CHECKPOINT 6.3:** Testar templates. Verificar lógica de atribuição (lead vai para o vendedor correto, não para qualquer um).

---

### ✅ COMMIT MÓDULO 6
```
feat(marketing): integrações RD Station Marketing e ActiveCampaign
- RD Station Marketing: 3 triggers + 5 actions + OAuth2
- ActiveCampaign: 4 triggers + 5 actions + API Key
- 3 templates de automação de marketing
```

---

## Módulo 7 — Motor de IA em PT-BR
> **Deploy: feature flag. Liberar gradualmente para clientes selecionados.**  
> **Duração estimada:** 2 semanas  
> **Objetivo: ser o primeiro do mercado BR com agente de IA nativo em PT-BR**

### Contexto
n8n lidera globalmente em IA (9/10 no score). Pipefy tem IA mas é enterprise. Nenhum player tem um builder de agentes realmente em PT-BR, acessível para PMEs. Esta é a maior diferenciação possível do SyncroFlow v2.0.

---

### 7.1 — Multi-LLM Engine 🔍

```typescript
// lib/ai/llm-client.ts
interface LLMProvider {
  name: string
  model: string
  call(prompt: string, options: LLMOptions): Promise<LLMResponse>
  stream(prompt: string, options: LLMOptions): AsyncIterable<string>
}

class MultiLLMClient {
  providers: Map<string, LLMProvider>

  // OpenAI GPT-4o
  // Anthropic Claude 3.5 Sonnet
  // Google Gemini 1.5 Pro

  async call(provider: string, prompt: string, options: LLMOptions) {
    // Fallback automático se provider falhar
    // Rate limiting por workspace
    // Cost tracking por workspace
    // Cache de respostas idênticas (economia de tokens)
  }
}
```

Supabase tables necessárias:
```sql
-- Controle de uso de IA por workspace
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_input INT,
  tokens_output INT,
  cost_usd DECIMAL(10,6),
  workflow_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**🔍 CHECKPOINT 7.1:** Testar os três providers. Verificar fallback. Verificar que cost tracking é preciso. Testar rate limiting.

---

### 7.2 — Agente de Atendimento PT-BR 🔍

O core da diferenciação. Um agente que conversa em PT-BR com o cliente final, usando o contexto do negócio.

```typescript
// lib/ai/agent.ts
interface AgentConfig {
  name: string                     // Nome do agente (ex: "Assistente da Loja X")
  persona: string                  // Prompt de sistema: como ele deve se comportar
  knowledge: KnowledgeBase[]       // Base de conhecimento (FAQ, catálogo, etc)
  tools: AgentTool[]               // Ações que o agente pode executar
  escalation: EscalationConfig     // Quando transferir para humano
  language: 'pt-BR'
}

interface AgentTool {
  name: string
  description: string             // Descrito para o LLM em PT-BR
  execute: (params: any) => Promise<any>
}

// Ferramentas padrão disponíveis para agentes:
const defaultTools: AgentTool[] = [
  consultarPedido,                 // Busca pedido no Bling/Nuvemshop
  verificarEstoque,                // Consulta estoque do produto
  agendarAtendimento,              // Agenda no Google Calendar
  criarLead,                       // Registra no CRM
  emitirSegundaVia,                // Gera novo boleto/PIX no Asaas
  transferirParaHumano,            // Sinaliza para o operador humano
]
```

**🔍 CHECKPOINT 7.2:** Testar agente com 20 cenários diferentes em PT-BR. Verificar que o agente não alucina dados de pedidos. Verificar transferência para humano.

---

### 7.3 — Builder de Agente com Linguagem Natural 🔍

O diferencial de UX: o usuário descreve o agente em português e o sistema configura.

```
Interface:
1. Usuário escreve: "Quero um agente que responda perguntas sobre meus pedidos,
   consulte o status no Bling e, se o cliente quiser cancelar, pergunte o motivo
   e transfira para um humano"

2. IA interpreta e sugere:
   - Persona gerada automaticamente
   - Tools necessárias identificadas: consultarPedido, transferirParaHumano
   - Fluxo de conversa mapeado
   - Perguntas de refinamento: "Qual o horário de atendimento humano?"

3. Usuário aprova e ativa com um clique
```

**🔍 CHECKPOINT 7.3:** Testar o builder com 10 descrições diferentes. Verificar que o agente gerado funciona conforme o esperado. Verificar edge cases (usuário descreve algo impossível).

---

### 7.4 — Memória e Contexto do Agente 🔍

```sql
-- Histórico de conversas para contexto
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  agent_id UUID REFERENCES agents(id),
  contact_identifier TEXT,            -- telefone, email, etc
  messages JSONB,                     -- histórico da conversa
  context JSONB,                      -- dados coletados (nome, pedido, etc)
  status TEXT DEFAULT 'active',       -- 'active' | 'resolved' | 'escalated'
  escalated_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

O agente lembra de conversas anteriores com o mesmo contato. Se o cliente já entrou em contato antes, o agente sabe.

**🔍 CHECKPOINT 7.4:** Testar memória entre conversas. Verificar que contexto de um cliente não vaza para outro. Verificar LGPD: política de retenção de histórico.

---

### 7.5 — Dashboard de IA 🔍

```
/ai/agents
  - Lista de agentes criados
  - Status (ativo/pausado)
  - Métricas: conversas hoje, taxa de resolução, taxa de escalação, tokens usados

/ai/agents/[id]
  - Configuração do agente
  - Histórico de conversas
  - Métricas detalhadas
  - Botão "Testar agente" (chat simulado)

/ai/usage
  - Consumo de tokens por período
  - Custo estimado por provider
  - Gráfico de uso ao longo do tempo
```

**🔍 CHECKPOINT 7.5:** Verificar que métricas são calculadas corretamente. Testar o chat simulado. Verificar que custo exibido está correto.

---

### ✅ COMMIT MÓDULO 7
```
feat(ai): motor de IA multi-LLM em PT-BR
- Multi-LLM engine (OpenAI, Anthropic, Gemini) com fallback
- Agente de atendimento PT-BR com tools
- Builder de agente com linguagem natural
- Memória e contexto de conversas
- Dashboard de uso e métricas de IA
```

---

## Módulo 8 — RBAC & Controles Enterprise
> **Deploy: após módulo 7. Necessário para vender para empresas médias.**  
> **Duração estimada:** 1 semana

### 8.1 — Sistema de Roles e Permissões 🔍

```typescript
// types/rbac.ts
type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

const rolePermissions: Record<WorkspaceRole, Permission[]> = {
  owner: ['*'],                                        // Tudo
  admin: [
    'workflows.*',
    'integrations.*',
    'members.invite',
    'members.remove',
    'billing.view'
  ],
  member: [
    'workflows.create',
    'workflows.edit.own',
    'workflows.view',
    'integrations.view'
  ],
  viewer: [
    'workflows.view',
    'analytics.view'
  ]
}
```

Middleware para proteger rotas:
```typescript
// middleware/require-permission.ts
export function requirePermission(permission: string) {
  return async (req, res, next) => {
    const userRole = await getUserRole(req.user.id, req.workspace.id)
    if (!hasPermission(userRole, permission)) {
      return res.status(403).json({ error: 'Permissão insuficiente' })
    }
    next()
  }
}
```

**🔍 CHECKPOINT 8.1:** Testar cada role tentando acessar recursos não permitidos. Verificar que owner não pode ser removido. Testar herança de permissões.

---

### 8.2 — Convite e Gestão de Membros 🔍

```
/settings/members
  - Lista de membros com role e data de entrada
  - Botão "Convidar membro" → e-mail + role selecionada
  - Alterar role de membro existente
  - Remover membro
  - Pendentes: convites enviados aguardando aceitação
```

Fluxo de convite:
1. Owner/Admin insere e-mail e role
2. Sistema envia e-mail com link de convite (token com 48h de validade)
3. Convidado clica, cria conta ou faz login
4. Entra no workspace com a role definida

**🔍 CHECKPOINT 8.2:** Testar convite para e-mail novo e e-mail já cadastrado. Testar expiração do link. Testar que role é aplicada corretamente.

---

### 8.3 — Audit Log Completo 🔍

Registrar automaticamente todas as ações relevantes:

```typescript
// lib/audit.ts
const AUDITED_ACTIONS = [
  'workflow.created',
  'workflow.updated',
  'workflow.deleted',
  'workflow.enabled',
  'workflow.disabled',
  'integration.connected',
  'integration.disconnected',
  'member.invited',
  'member.removed',
  'member.role_changed',
  'agent.created',
  'agent.deleted',
  'billing.plan_changed',
]

// Automatizar via Supabase triggers (pg triggers) para ações no DB
// Via middleware para ações de API
```

Interface de Audit Log:
```
/settings/audit-log
  - Tabela com: data, usuário, ação, recurso afetado
  - Filtros: por usuário, por tipo de ação, por período
  - Exportar como CSV
  - Retenção: 90 dias (planos pagos)
```

**🔍 CHECKPOINT 8.3:** Verificar que todas as ações listadas geram registro. Testar exportação CSV. Verificar que viewer não vê audit log.

---

### ✅ COMMIT MÓDULO 8
```
feat(enterprise): RBAC, convite de membros, audit log
- Sistema de roles: owner, admin, member, viewer
- Middleware de autorização em todas as rotas
- Fluxo de convite por e-mail
- Audit log com filtros e exportação CSV
```

---

## Módulo 9 — Confiabilidade & SLA 99.9%
> **Deploy: contínuo, em paralelo com outros módulos quando possível.**  
> **Duração estimada:** 1 semana

### 9.1 — Monitoramento e Alertas 🔍

Configurar no EasyPanel/Hostinger:
```
- Uptime monitoring: verificação a cada 60 segundos
- Alertas por WhatsApp/e-mail se serviço cair
- Dashboard de status público (ex: status.syncroflow.io)
- Métricas: latência média, taxa de erro, jobs na fila
```

Stack recomendada:
- **Uptime:** Better Uptime ou UptimeRobot (gratuito)
- **Error tracking:** Sentry (plano free suficiente inicialmente)
- **Métricas:** Supabase Analytics + logs do EasyPanel

**🔍 CHECKPOINT 9.1:** Simular queda do serviço. Verificar que alerta é disparado em < 2 minutos.

---

### 9.2 — Status Page Pública 🔍

```
status.syncroflow.io
  - Status atual de cada serviço: API, Webhooks, AI Engine, Integrações
  - Histórico de incidentes dos últimos 90 dias
  - Uptime do mês atual (ex: 99.97%)
  - Assinar notificações de incidentes
```

Isso transforma 99.5% em 99.9% na **percepção** do cliente. Transparência é o diferencial.

**🔍 CHECKPOINT 9.2:** Verificar que status page atualiza automaticamente. Testar notificação de incidente.

---

### 9.3 — Backup e Recovery 🔍

```
- Backup automático do Supabase: diário (Supabase faz automaticamente no plano Pro)
- Backup de configurações de workflows: export manual disponível para o usuário
- Procedimento documentado de recovery em caso de incidente
- RPO (Recovery Point Objective): máximo 24h de perda de dados
- RTO (Recovery Time Objective): máximo 2h para restabelecimento
```

**🔍 CHECKPOINT 9.3:** Documentar e testar procedimento de restore. Verificar que backup diário está ativado no Supabase.

---

### ✅ COMMIT MÓDULO 9
```
feat(reliability): monitoramento, status page, backup
- Uptime monitoring com alertas
- Status page pública em status.syncroflow.io
- Procedimento de backup e recovery documentado
- Sentry configurado para error tracking
```

---

## Módulo 10 — Marketplace de Templates
> **Deploy: último módulo. Cria network effect.**  
> **Duração estimada:** 1 semana

### 10.1 — Sistema de Templates Públicos 🔍

```sql
CREATE TABLE public_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id),
  workspace_id UUID REFERENCES workspaces(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  connectors_required TEXT[],         -- ['nuvemshop', 'whatsapp']
  workflow_config JSONB,              -- configuração exportável
  uses_count INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,  -- aprovação manual pela equipe
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Interface:
```
/templates
  - Grid de templates por categoria
  - Busca por nome ou conector
  - Filtro: "Gratuitos" | "Populares" | "Novos"
  - Card: preview, qtd de usos, conectores necessários
  - Botão "Usar template" → clona para o workspace e abre pré-configurado
```

**🔍 CHECKPOINT 10.1:** Testar clonagem de template. Verificar que credenciais do criador não vazam para o usuário que usa o template.

---

### 10.2 — Publicação de Templates 🔍

```
/templates/new
  - Usuário cria workflow
  - Clica "Publicar como template"
  - Preenche: título, descrição, categoria
  - Sistema anonimiza credenciais e variáveis sensíveis
  - Template vai para fila de aprovação
  - Após aprovação: disponível no marketplace
```

**🔍 CHECKPOINT 10.2:** Verificar que o processo de anonimização funciona corretamente. Nenhuma API key ou token do criador deve estar no template publicado.

---

### ✅ COMMIT MÓDULO 10
```
feat(marketplace): sistema de templates públicos
- Tabela e API de public_templates
- Interface de browse por categoria
- Clonagem de template para workspace
- Fluxo de publicação com anonimização
```

---

## Resumo do Plano

| Módulo | Entrega | Visível ao usuário | Prioridade |
|---|---|---|---|
| 1 — Infraestrutura | Semana 1 | Não | 🔴 Crítico |
| 2 — Connector Engine | Semana 2 | Parcial (UI integrations) | 🔴 Crítico |
| 3 — E-commerce + Marketplaces (11 plataformas) | Semana 3-6 | ✅ Sim — anunciar por bloco | 🔴 Alta |
| 4 — CRM & Vendas | Semana 5 | ✅ Sim — anunciar | 🔴 Alta |
| 5 — Financeiro | Semana 6 | ✅ Sim — anunciar | 🟠 Alta |
| 6 — Marketing | Semana 7 | ✅ Sim — anunciar | 🟠 Alta |
| 7 — IA PT-BR | Semana 8-9 | ✅ Feature flag | 🟠 Alta |
| 8 — RBAC Enterprise | Semana 10 | ✅ Sim | 🟡 Média |
| 9 — Confiabilidade | Paralelo | Parcial (status page) | 🟡 Média |
| 10 — Marketplace | Semana 11 | ✅ Sim | 🟢 Baixa |

**Total estimado: 14 semanas para v2.0 completa**  
**Primeiros resultados visíveis para clientes: semana 3 (Bloco 3.A — Nuvemshop + Shopify)**  
**Marketplaces sociais disponíveis: semana 6 (TikTok Shop + Shopee)**  
**Cobertura completa de e-commerce + marketplaces: semana 6 (todas as 11 plataformas)**

---

## Checklist Final por Módulo

Antes de cada commit de módulo, verificar:

```
□ Todas as migrações Supabase têm rollback (down migration)
□ Nenhuma credencial em plain text no banco
□ RLS ativo em todas as tabelas novas
□ Todas as rotas novas têm autenticação verificada
□ Tratamento de erro em todas as chamadas a APIs externas
□ Timeout configurado em todas as chamadas externas (máx 30s)
□ Logs sem dados sensíveis (tokens, CPF, cartão)
□ TypeScript sem erros e sem 'any' desnecessário
□ Testes dos casos de uso principais passando
□ Comportamento testado quando API externa está down
□ README do módulo atualizado com variáveis de ambiente necessárias
```

---

*Documento gerado em Junho 2026 — SyncroFlow v2.0 Development Plan*
