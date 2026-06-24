# NuClick Sistemas — Contexto Completo da Sessão
**Data:** 17/06/2026  
**Retomar em:** próxima sessão com Claude

---

## 1. DADOS DA EMPRESA

| Campo | Valor |
|---|---|
| Empresa | NuClick Sistemas |
| CNPJ | 37.815.890/0001-08 |
| Razão Social | GLAUCIO LUIZ PIMENTEL DE OLIVEIRA (MEI) |
| Nome Fantasia | NuClick Sistemas |
| Responsável | Glaucio |
| E-mail | contato@nuclick.com.br / glaucio.sellect@gmail.com |
| Site | https://nuclick.com.br |
| Cidade | Juiz de Fora, MG, CEP 36032-010 |

---

## 2. PRODUTOS SaaS

| Produto | Descrição |
|---|---|
| **SyncroLex** | Gestão jurídica |
| **SyncroFlow** | Atendimento omnichannel com IA |
| **SyncroMoney** | Controle financeiro para PMEs |

---

## 3. DECISÃO ESTRATÉGICA: MIGRAÇÃO WHATSAPP

**Situação atual:** SyncroFlow usa **UazAPI** (API não oficial do WhatsApp)  
**Decisão:** Migrar para **WhatsApp Cloud API oficial** (Meta)  
**Modelo:** NuClick registrada como **Meta Tech Provider**

### Por quê migrar:
- UazAPI = risco de ban a qualquer momento
- API oficial = estabilidade, suporte, acesso a Instagram Direct e Facebook Messenger
- Tech Provider = clientes conectam via Embedded Signup (popup simples), sem precisar criar conta na Meta

### Modelo comercial decidido:
- Cliente paga **somente o SyncroFlow** (nenhuma exposição ao portal da Meta)
- NuClick absorve os custos da Meta via sistema de créditos já existente
- Mensagem receptiva (cliente fala primeiro) = **0 créditos** (Meta não cobra na janela de 24h)
- Mensagem ativa/template = **2 créditos** (custo Meta ~R$0,04–0,08)
- Sem mudança na experiência do cliente final

### Tabela de créditos (planejada):
| Ação | Créditos |
|---|---|
| Mensagem receptiva WhatsApp | 0 |
| Mensagem ativa/template WhatsApp | 2 |
| Claude Haiku | 1 |
| Claude Sonnet | 3 |
| GPT-4o | 5 |
| Claude Opus | 10 |

---

## 4. META / FACEBOOK — STATUS DO CADASTRO

### App no Meta for Developers
- **App:** SyncroFlow
- **App ID:** 4505201496393876
- **Mode:** Ativo
- **Empresa:** NuClick
- **URL:** https://developers.facebook.com/apps/4505201496393876

### Casos de uso configurados no App:
- ✅ Messenger
- ✅ Instagram
- ✅ WhatsApp
- ✅ **Tech Provider** (registrado nesta sessão)

### Business Manager (business.facebook.com)
- **Portfolio usado:** NuClick
- **URL configurações:** https://business.facebook.com/settings

### Verificação da Empresa
- **Status:** ⏳ **EM ANÁLISE**
- **Prazo Meta:** ~2 dias úteis
- **Caso de uso selecionado:** "O app exige acesso a permissões no Meta for Developers"
- **Dados enviados:** CNPJ 37.815.890/0001-08 / Razão social: GLAUCIO LUIZ PIMENTEL DE OLIVEIRA / Nome fantasia: NuClick Sistemas

### Access Verification (Tech Provider)
- **Status:** ⏳ Aguardando aprovação da Business Verification
- **Prazo limite:** 16/08/2026
- **Próximo passo:** Após Business Verification aprovada, voltar à Central de Segurança → "Verificação de acesso" e completar

---

## 5. ARQUIVOS GERADOS NESTA SESSÃO

| Arquivo | Descrição |
|---|---|
| `NuClick_Termos_Completo.docx` | Termos Gerais + Anexos A (SyncroLex), B (SyncroFlow), C (SyncroMoney) |
| `SyncroFlow_Plano_Migracao_Meta_API.docx` | Plano completo de migração para WhatsApp Cloud API oficial |
| `generate_full.js` | Script Node.js que gerou o docx de termos |
| `plano_meta_api.js` | Script Node.js que gerou o plano de migração |

**Localização dos scripts:** `/tmp/nuclick_docx/` (ambiente Linux da sessão — recria se necessário)  
**Localização dos docx:** `outputs/` (pasta de trabalho do Claude)

---

## 6. PRÓXIMOS PASSOS (EM ORDEM)

### Imediato (aguardar)
1. ⏳ Aguardar Meta aprovar Business Verification (~2 dias úteis)
2. Quando aprovado: Voltar à Central de Segurança → completar **Access Verification**

### Desenvolvimento técnico (pode iniciar já)
3. Implementar **adapter WhatsApp Cloud API** no SyncroFlow (substitui UazAPI)
4. Implementar **Embedded Signup** (popup para clientes conectarem WhatsApp sem criar conta Meta)
5. Implementar **Webhook receiver** (receber mensagens da Meta)
6. Implementar **Template Manager** (gerenciar mensagens ativas)
7. Estender **sistema de créditos** para cobrir mensagens WhatsApp ativas
8. Migrar clientes em ondas (UazAPI continua ativo durante toda a migração)

### Timeline estimada do desenvolvimento
| Fase | Duração |
|---|---|
| Adapter + Webhook (core) | 2–3 semanas |
| Embedded Signup | 1–2 semanas |
| Template Manager | 1 semana |
| Sistema de créditos | 1 semana |
| Testes + migração piloto | 2–3 semanas |
| **Total** | **~10–12 semanas** |

---

## 7. OBSERVAÇÕES IMPORTANTES

- **Instagram Direct e Facebook Messenger:** o mesmo App registrado como Tech Provider desbloqueia essas integrações via mesmo webhook — resolve o problema que não conseguiu fazer funcionar antes
- **UazAPI:** manter ativo durante TODO o desenvolvimento; clientes migram um a um, sem interrupção
- **Clientes atuais:** a advogada (e todos os outros) continuam usando normalmente durante a migração
- **Embedded Signup:** é a chave do modelo — cliente conecta o WhatsApp num popup de 3 minutos, sem criar conta na Meta, sem cartão, sem portal
- **Central de Segurança alerts:** os alertas vermelhos (domínio, passkeys, email público) são recomendações de segurança de anúncios, **não afetam** a verificação de Tech Provider

---

## 8. COMO RETOMAR AMANHÃ

1. Abra o Claude e cole este contexto ou mencione "continuar projeto NuClick/SyncroFlow"
2. Verifique se a Meta aprovou a Business Verification em: https://business.facebook.com/settings → Central de Segurança
3. Se aprovado → completar Access Verification
4. Se ainda em análise → começar desenvolvimento técnico (adapter WhatsApp)

---

*Documento gerado automaticamente pela sessão Claude — 17/06/2026*
