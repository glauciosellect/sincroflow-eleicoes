# SyncroFlow — Memória do Projeto

> Arquivo de decisões, contexto acumulado e registro de roadmap.  
> Atualizar sempre que uma decisão estratégica for tomada.  
> Última atualização: Junho 2026

---

## 🏗️ Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend / API Routes | Next.js (Vercel) |
| Banco de dados | Supabase (Postgres + Realtime + Storage + Edge Functions) |
| Workers / Background jobs | EasyPanel na VPS Hostinger |
| Fila de jobs | BullMQ + Redis (EasyPanel) |
| Hospedagem principal | Vercel (frontend) + EasyPanel/Hostinger (workers) |

---

## 📍 Posicionamento de Mercado

- **Público-alvo atual (ICP):** PMEs brasileiras de 10–200 funcionários que usam WhatsApp no processo comercial, têm NF-e e precisam conectar 5+ ferramentas
- **Anti-target atual:** Grandes enterprises com ERP SAP/Oracle e devs que querem controle total (território do n8n)
- **Posicionamento:** "O poder do Zapier, o visual do Make — feito para o Brasil, cobrado em reais, com suporte que fala a sua língua"
- **Maior diferencial:** Único player com integrações nativas de WhatsApp Business + PIX + NF-e + marketplaces brasileiros em plataforma no-code

---

## 🗺️ Roadmap de Versões

### ✅ Versão 1.0 — Em produção
- Sistema de automação e workflows funcionando
- Clientes ativos utilizando
- Instagram DM + Gmail/Google Workspace integrados
- CRM próprio com pipeline Kanban + agenda calendar integrada
- WhatsApp Business nativo

---

### 🚧 Versão 2.0 — Em desenvolvimento
> Plano detalhado em: `syncroflow-v2-plano-desenvolvimento.md`

**Objetivo:** Fechar gap de integrações, lançar IA em PT-BR, amadurecer a plataforma

**Módulos:**
| # | Módulo | Status | Deploy |
|---|---|---|---|
| 1 | Infraestrutura & Fundação v2.0 | 🔲 Pendente | Silencioso |
| 2 | Motor de Integrações (Connector Engine) | 🔲 Pendente | Silencioso |
| 3 | E-commerce + Marketplaces (11 plataformas) | 🔲 Pendente | Anunciar por bloco |
| 4 | CRM & Vendas (HubSpot, Pipedrive, RD Station CRM) | 🔲 Pendente | Anunciar |
| 5 | Financeiro (Asaas, Pagar.me) | 🔲 Pendente | Anunciar |
| 6 | Marketing (RD Station Mkt, ActiveCampaign) | 🔲 Pendente | Anunciar |
| 7 | Motor de IA em PT-BR (Multi-LLM + Agentes) | 🔲 Pendente | Feature flag |
| 8 | RBAC & Controles Enterprise | 🔲 Pendente | Anunciar |
| 9 | Confiabilidade & SLA 99.9% | 🔲 Pendente | Paralelo |
| 10 | Marketplace de Templates | 🔲 Pendente | Anunciar |

**Integrações planejadas v2.0 — E-commerce (Módulo 3):**
- Nuvemshop, Shopify, Tray Commerce, Loja Integrada, Bagy
- Mercado Livre, TikTok Shop, Shopee, Shein (beta)
- Bling ERP, Tiny ERP
- Hub de sincronização multi-canal em tempo real

**Prazo estimado:** 14 semanas

---

### 📋 Versão 3.0 — Roadmap Futuro

#### 🟣 TOTVS Integration — DECISÃO: aguardar v3.0
**Registrado em:** Junho 2026  
**Decisão tomada por:** Glaucio  
**Motivo:** TOTVS é território enterprise. Requer maturidade de produto que o SyncroFlow ainda está construindo no v2.0 (RBAC completo, SLA 99.9%, audit log, SSO). Atacar antes disso seria ciclo de venda longo sem produto maduro para sustentar.

**Contexto registrado:**
- TOTVS tem **65% de market share de ERPs no Brasil** — Protheus, Datasul, RM, Logix, Fluig
- Protheus tem **10.000+ clientes** e API REST nativa documentada em `api.totvs.com.br`
- Fluig (BPM da TOTVS) tem API REST em `api.fluig.com` — produto mais similar ao SyncroFlow mas pesado e caro
- A dor dos clientes TOTVS: o ERP resolve o back-office mas **não conecta com WhatsApp, marketplaces e CRMs modernos** sem programador ADVPL
- Integração hoje exige programador especializado em ADVPL (linguagem proprietária da TOTVS) — escassa e cara

**Casos de uso prioritários quando chegar a hora:**
1. Protheus → WhatsApp: pedido confirmado, NF-e emitida, boleto vencendo, rastreio despachado
2. Protheus → CRM moderno (HubSpot/Pipedrive): sincronização de clientes e pedidos sem código
3. Protheus → Alertas internos operacionais: estoque crítico, aprovação pendente, pedido atrasado
4. Fluig → Gatilhos externos: quando processo BPM avança, disparar ações em sistemas externos

**Pré-requisitos antes de atacar:**
- [ ] RBAC completo (Módulo 8 v2.0)
- [ ] SLA 99.9% publicado (Módulo 9 v2.0)
- [ ] Audit log completo (Módulo 8 v2.0)
- [ ] SSO/SAML implementado
- [ ] Pelo menos 1 caso de uso enterprise documentado com ROI claro
- [ ] Solicitar acesso ao programa de parceiros TOTVS: https://www.totvs.com/seja-um-parceiro/

---

## 💡 Decisões Estratégicas Registradas

| Data | Decisão | Motivo |
|---|---|---|
| Jun/2026 | Deploy modular (módulo a módulo), não big-bang | Feedback real dos clientes, risco isolado, clientes atuais não afetados |
| Jun/2026 | TOTVS adiado para v3.0 | Produto precisa de maturidade enterprise antes de atacar esse segmento |
| Jun/2026 | TikTok Shop e Shopee = prioridade máxima no Módulo 3 | Crescimento de 102x no TikTok Shop BR; dor imediata de sincronização multi-canal |
| Jun/2026 | Shein entra como beta | API requer parceria oficial — lançar como beta com aviso claro na UI |
| Jun/2026 | Hub multi-canal incluído no Módulo 3 | Sincronização de estoque em tempo real entre todos os canais é o diferencial único |

---

## 🔌 Integrações — Mapa Completo

### Já existem (v1.0)
- WhatsApp Business (nativo)
- Instagram DM (Meta Business)
- Gmail / Google Workspace
- CRM próprio (pipeline Kanban + agenda)

### Planejadas v2.0
**E-commerce/Marketplaces:** Nuvemshop · Shopify · Tray · Loja Integrada · Bagy · Mercado Livre · TikTok Shop · Shopee · Shein (beta) · Bling · Tiny  
**CRM:** HubSpot · Pipedrive · RD Station CRM · Agendor  
**Marketing:** RD Station Marketing · ActiveCampaign · LeadLovers  
**Financeiro:** Asaas · Pagar.me  
**Produtividade:** Google Sheets · Notion · Typeform  
**Comunicação:** Slack · Microsoft Outlook/Teams  

### Planejadas v3.0
**Enterprise/ERP:** TOTVS Protheus · TOTVS Datasul · TOTVS RM · TOTVS Fluig  
**Enterprise/CRM:** Salesforce  
**Enterprise/Infra:** SSO/SAML genérico · Active Directory / Azure AD  

---

## 📊 Contexto Competitivo (resumo)

| Player | Tipo | Ameaça | Nossa vantagem |
|---|---|---|---|
| Zapier | Global | Alta (brand) | Preço BRL + integrações BR |
| Make | Global | Média | Simplicidade + preço BRL |
| n8n | Global/Open | Baixa (outro público) | Não-técnicos, suporte PT-BR |
| Pipefy | BR Enterprise | Média | Preço + foco em PME |
| Jestor | BR No-code | Alta (mesmo público) | Mais poder + IA + marketplaces |
| Pluga | BR Simples | Média | Mais complexidade suportada |

**Score atual SyncroFlow por dimensão:**
- Preço/BRL: 8/10 ✅
- Integrações BR: 9/10 ✅
- Volume integrações: 3/10 ❌ (principal gap)
- IA/Agentes: 6/10 🟡
- UX/Facilidade: 7/10 ✅
- Maturidade Enterprise: 3/10 ❌ (gap secundário)

---

*Documento vivo — atualizar a cada decisão estratégica tomada.*
