# SyncroFlow — Plano de Integrações E-commerce
> Módulos incrementais. Sistema sempre em produção. Clientes não percebem — o produto só cresce.
> Atualizado: Junho 2026

---

## Visão Geral

O cliente conecta sua loja/marketplace uma vez. O SyncroFlow passa a receber eventos
em tempo real (novo pedido, mensagem, estoque baixo) e executa ações automáticas
(enviar WhatsApp, notificar equipe, atualizar dados).

**Onde aparece no painel:** Menu lateral → Integrações (nova seção) + Automações (nova aba)

**Modelo técnico:**
- Cliente faz OAuth (ou cola API Key) uma única vez
- SyncroFlow registra webhook na plataforma automaticamente
- Eventos chegam em tempo real via POST no endpoint do SyncroFlow
- Worker BullMQ processa e executa as ações configuradas

---

## Ordem de implementação

| Módulo | Plataforma | Motivo da prioridade |
|---|---|---|
| M1 | Nuvemshop | Maior base de lojistas BR, OAuth simples, token não expira |
| M2 | Mercado Livre | Marketplace dominante BR, cadastro fácil, sem aprovação especial |
| M3 | Shopify | Crescimento acelerado no BR, documentação excelente |
| M4 | TikTok Shop | Crescimento 102x no BR, aprovação rápida (2-3 dias) |
| M5 | Shopee | Base enorme, requer aprovação formal com CNPJ |

Cada módulo é independente. M2 não depende de M1 estar pronto.

---

## Infraestrutura Compartilhada (fazer uma vez antes de M1)

### Schema Prisma — tabelas novas

```prisma
model Integration {
  id           String   @id @default(cuid())
  workspaceId  String
  platform     String   // 'nuvemshop' | 'mercadolivre' | 'shopify' | 'tiktokshop' | 'shopee'
  status       String   @default("active") // 'active' | 'error' | 'expired' | 'disconnected'
  accessToken  String?  // encriptado
  refreshToken String?  // encriptado
  tokenExpiresAt DateTime?
  shopId       String?  // ID da loja na plataforma
  shopName     String?  // nome da loja (exibição)
  shopUrl      String?  // URL da loja
  metadata     Json?    // dados extras por plataforma
  createdAt    DateTime @default(now())
  updatedAt    DateTime @default(now()) @updatedAt
  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  automations  Automation[]

  @@unique([workspaceId, platform])
}

model Automation {
  id             String      @id @default(cuid())
  workspaceId    String
  integrationId  String
  name           String
  trigger        String      // 'new_order' | 'order_paid' | 'new_message' | 'low_stock' etc
  actions        Json        // array de ações a executar
  isActive       Boolean     @default(true)
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @default(now()) @updatedAt
  workspace      Workspace   @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  integration    Integration @relation(fields: [integrationId], references: [id], onDelete: Cascade)
  executions     AutomationExecution[]
}

model AutomationExecution {
  id           String    @id @default(cuid())
  automationId String
  status       String    // 'success' | 'error' | 'running'
  triggerData  Json      // payload que ativou
  result       Json?     // resultado das ações
  errorMsg     String?
  createdAt    DateTime  @default(now())
  automation   Automation @relation(fields: [automationId], references: [id], onDelete: Cascade)
}
```

### Webhook receiver universal

```
POST /webhooks/integration/:workspaceId/:platform
  → valida assinatura (por plataforma)
  → retorna 200 imediatamente
  → enfileira no BullMQ para processamento
  → worker executa automações configuradas
```

### Encryption de tokens

Tokens OAuth nunca em plain text. Usar `crypto.createCipheriv` com chave do env:
```
INTEGRATION_ENCRYPTION_KEY=... (32 bytes hex, no EasyPanel)
```

---

## Módulo 1 — Nuvemshop

**Auth:** OAuth2 (token não expira — simplifica muito)
**Parceiro:** Portal de Parceiros Nuvemshop (app privado para começar, sem aprovação)
**Sandbox:** Loja demo gratuita no portal

### Triggers disponíveis
```
orders/created       → Novo pedido criado
orders/paid          → Pedido pago
orders/fulfilled     → Pedido enviado
orders/cancelled     → Pedido cancelado
products/updated     → Produto atualizado
customers/created    → Novo cliente cadastrado
```

### Actions disponíveis
```
Buscar dados do pedido
Atualizar status do pedido
Buscar dados do produto
Atualizar estoque
Buscar dados do cliente
```

### Automações prontas (templates)
```
"Pedido confirmado → WhatsApp para o cliente"
  Trigger: orders/created
  Ação: WhatsApp com número do pedido + valor + previsão

"Pedido pago → WhatsApp para o gestor"
  Trigger: orders/paid
  Ação: WhatsApp para o dono com resumo do pedido

"Carrinho abandonado → recuperação"
  Trigger: checkouts/delete (sem pagamento)
  Ação: WhatsApp D+1 com link do carrinho
```

### Variáveis de ambiente necessárias
```
NUVEMSHOP_CLIENT_ID=
NUVEMSHOP_CLIENT_SECRET=
```

---

## Módulo 2 — Mercado Livre

**Auth:** OAuth2 (token de curta duração + refresh token com offline_access)
**Parceiro:** Cadastro simples em developers.mercadolivre.com.br — sem aprovação
**Sandbox:** Ambiente stage disponível
**Atenção:** Webhook entrega apenas o ID — precisa fazer GET para buscar payload completo

### Triggers disponíveis
```
orders_v2            → Nova venda / atualização de pedido
payments             → Pagamento confirmado
questions            → Comprador fez pergunta
messages             → Nova mensagem pós-venda
shipments            → Atualização de rastreamento
items                → Anúncio atualizado
```

### Actions disponíveis
```
Buscar dados do pedido
Responder pergunta de comprador
Enviar mensagem ao comprador
Atualizar estoque do anúncio
Pausar/reativar anúncio
```

### Automações prontas (templates)
```
"Nova pergunta → resposta automática com IA"
  Trigger: questions
  Ação: IA analisa catálogo → responde automaticamente

"Pedido pago → WhatsApp para gestor"
  Trigger: orders_v2 (status=paid)
  Ação: WhatsApp com resumo da venda

"Estoque crítico → alerta"
  Trigger: items (estoque ≤ mínimo)
  Ação: WhatsApp para o responsável
```

### Variáveis de ambiente necessárias
```
MERCADOLIVRE_APP_ID=
MERCADOLIVRE_CLIENT_SECRET=
```

---

## Módulo 3 — Shopify

**Auth:** OAuth2 + validação HMAC-SHA256 nos webhooks
**Parceiro:** partners.shopify.com (gratuito, sem aprovação para desenvolvimento)
**Sandbox:** Development Stores ilimitadas
**Atenção:** Webhooks registrados automaticamente via API quando loja conecta

### Triggers disponíveis
```
orders/created       → Novo pedido
orders/paid          → Pedido pago
orders/fulfilled     → Pedido enviado
orders/cancelled     → Cancelamento
customers/create     → Novo cliente
inventory/update     → Estoque atualizado
checkouts/delete     → Carrinho abandonado
```

### Actions disponíveis
```
Buscar dados do pedido
Buscar dados do cliente
Atualizar estoque
Criar código de desconto
Cancelar pedido
```

### Variáveis de ambiente necessárias
```
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_SCOPES=read_orders,write_orders,read_inventory,write_inventory
```

---

## Módulo 4 — TikTok Shop

**Auth:** OAuth2 (access_token + refresh_token, vida curta)
**Parceiro:** Partner Center TikTok Shop (aprovação 2-3 dias úteis)
**Sandbox:** API testing tool no Partner Center
**Atenção:** Escolha de região no Partner Center é IRREVERSÍVEL — escolher Brazil/Global com cuidado

### Triggers disponíveis
```
order/created        → Novo pedido
order/status_update  → Status atualizado
product/listing_change → Produto aprovado/rejeitado
inventory/update     → Estoque atualizado
return/created       → Devolução solicitada
```

### Actions disponíveis
```
Confirmar pedido (obrigatório em 2 dias)
Atualizar código de rastreio
Atualizar estoque
Buscar dados do pedido
Cancelar pedido
```

### Automação crítica
```
"Novo pedido → confirmar + WhatsApp"
  IMPORTANTE: TikTok Shop cancela pedido automaticamente se não confirmado em 2 dias
  Trigger: order/created
  Ação 1: Confirmar pedido via API
  Ação 2: WhatsApp para gestor com alerta de prazo
```

### Variáveis de ambiente necessárias
```
TIKTOKSHOP_APP_KEY=
TIKTOKSHOP_APP_SECRET=
TIKTOKSHOP_SERVICE_ID=
```

---

## Módulo 5 — Shopee

**Auth:** HMAC-SHA256 próprio (Partner ID + Partner Key + token por loja, expira em 4h)
**Parceiro:** Aprovação formal com CNPJ — processo mais rigoroso
**Sandbox:** Partner Center com ferramentas de teste
**Atenção:** Token expira em 4h — sistema deve renovar automaticamente via refresh token

### Triggers disponíveis
```
ORDER_STATUS_UPDATE          → Status do pedido atualizado
order_trackingno_push        → Código de rastreio disponível
package_fulfillment_status   → Fulfillment atualizado
reserved_stock_change        → Estoque reservado alterado
```

### Actions disponíveis
```
Confirmar pedido (marcar como enviado + rastreio)
Cancelar pedido
Atualizar estoque
Responder mensagem do comprador
Buscar performance da loja (avaliação, penalidades)
```

### Automação crítica
```
"Nova mensagem → resposta rápida"
  IMPORTANTE: Shopee penaliza vendedor se não responde em 12h (rebaixa ranking)
  Trigger: new_message (via polling ou push)
  Ação: IA analisa e responde automaticamente ou notifica gestor em < 1 min
```

### Variáveis de ambiente necessárias
```
SHOPEE_PARTNER_ID=
SHOPEE_PARTNER_KEY=
```

---

## UI no painel — o que o cliente vai ver

### Menu lateral — nova entrada
```
Integrações
  └── Minhas integrações (lista de conectadas)
  └── Disponíveis (catálogo com botão Conectar)
```

### Tela de cada integração
```
[Logo] Nuvemshop                          [Conectado ✓] [Desconectar]
Loja: Minha Loja Fashion
Última sincronização: há 2 minutos

Automações ativas: 3
[+ Nova Automação]

Lista de automações:
  • Pedido confirmado → WhatsApp     [Ativo] [Editar] [Pausar]
  • Pedido pago → Notificar gestor   [Ativo] [Editar] [Pausar]
  • Carrinho abandonado → Recuperar  [Pausado] [Editar] [Ativar]

Últimas execuções:
  14:32 - Pedido #1234 → WhatsApp enviado ✓
  14:18 - Pedido #1233 → WhatsApp enviado ✓
  13:55 - Erro: créditos insuficientes ✗
```

### Formulário de nova automação
```
Nome: [____________________]

Quando isso acontecer:
  [Selecione o evento ▼]
  → Novo pedido criado
  → Pedido pago
  → ...

Fazer isso:
  [+ Adicionar ação]
  → Enviar WhatsApp para [campo: número ou variável {cliente.phone}]
  → Mensagem: [campo de texto com variáveis disponíveis]
    Ex: "Olá {cliente.nome}! Seu pedido #{pedido.numero} foi confirmado!"
```

---

## Checklist antes de cada módulo entrar em produção

```
□ OAuth flow testado de ponta a ponta (conectar → desconectar → reconectar)
□ Webhook recebendo e processando eventos corretamente
□ Assinatura do webhook validada (rejeitar payloads inválidos)
□ Token refresh automático funcionando (para plataformas com expiração)
□ Pelo menos 2 templates de automação testados end-to-end
□ Variáveis de ambiente documentadas para o EasyPanel
□ UI de conexão e listagem funcionando
□ Erro tratado: o que acontece se a API externa estiver fora do ar
□ Migration do banco rodada no Supabase
```

---

## Próximos passos imediatos

1. Criar conta de parceiro na Nuvemshop (app privado — sem aprovação)
2. Criar conta de parceiro no Mercado Livre Developers
3. Criar conta de parceiro no Shopify Partners
4. Submeter aprovação no TikTok Shop Partner Center (pode levar 2-3 dias)
5. Submeter aprovação na Shopee Open Platform (processo mais longo — iniciar já)

**Enquanto as aprovações chegam:** implementar M1 (Nuvemshop) e M2 (Mercado Livre) que não precisam de aprovação especial.

---

*Documento vivo — atualizar conforme cada módulo for implementado*
