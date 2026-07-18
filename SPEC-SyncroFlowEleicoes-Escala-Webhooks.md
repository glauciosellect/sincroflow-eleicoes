# SPEC — Preparar o SyncroFlowEleições para escala (1000+ candidatos simultâneos)

**Repositório:** `glauciosellect/sincroflow-eleicoes`
**Escopo desta spec:** SOMENTE o SyncroFlowEleições. Não tocar em nada do repositório `glauciosellect/syncroflow` (sistema comercial) — são produtos separados, mas o Módulo 1 abaixo se inspira numa correção que já existe lá, só como referência de como resolver o mesmo problema.

**Contexto de negócio:** o sistema vai abrir cadastro para um grande volume de candidatos ao mesmo tempo (planejamento para 1000+ candidatos simultâneos), cada um com atendimento por IA via WhatsApp, Instagram, Facebook, Telegram e E-mail. Esta spec documenta o que foi encontrado numa auditoria de código (leitura, sem alterações) e o que precisa ser corrigido/reforçado antes de abrir esse volume de cadastros.

**Confirmado com o dono do produto (importante para escopo):** SyncroFlow e SyncroFlowEleições usam **Apps diferentes no Meta for Developers**, ambos sob a mesma empresa/Business Manager. Ou seja, o problema descrito nesta spec é **interno ao SyncroFlowEleições** (vários candidatos competindo pela mesma URL de webhook do App do Eleições) — não é um problema entre os dois produtos. O número hoje registrado na Meta e ativo é usado pelo App do Eleições.

Também confirmado: os candidatos do Eleições vão poder conectar **dois tipos de número**, os dois precisando funcionar em escala:
1. **Número próprio do candidato**, vinculado via Meta Embedded Signup — modelo que **já funciona hoje no SyncroFlow** (sistema comercial), mas que no SyncroFlowEleições ainda está marcado como "fase futura" no código (`meta-cloud.provider.ts`, método `createInstance`). Ver Módulo 7 abaixo.
2. **Número virtual alugado da Salvy** — já tem integração parcial no código (`SALVY_API_KEY`, `SALVY_WEBHOOK_SECRET` no `.env.example`), registrando os números numa WABA de titularidade da SyncroFlow.

Os dois caminhos, uma vez conectados, viram um `Channel` do tipo `WHATSAPP` com seu próprio `phoneNumberId` — por isso o Módulo 1 (roteamento por `phone_number_id`) é necessário **independente de qual dos dois caminhos o candidato usou** para conectar o número.

---

## Módulo 1 — Corrigir roteamento do webhook do WhatsApp por `phone_number_id` (P0 — bloqueador)

### Objetivo
Garantir que, quando existir mais de um número de WhatsApp cadastrado na mesma conta Meta (WABA), cada mensagem recebida seja atribuída ao candidato/canal correto.

### Por que isso é urgente
A Meta só permite **uma única URL de webhook por App** — não uma por número de telefone. Isso significa que, com vários números de WhatsApp na mesma WABA (que é exatamente o modelo de negócio aqui: `Candidate.whatsappLineLimit` já existe no schema com planos Starter=1, Pro=3, Business=10, Enterprise=ilimitado), **todas as mensagens de todos os números chegam na mesma URL**.

Hoje, em `apps/api/src/modules/webhooks/webhooks.routes.ts`, a rota `POST /webhooks/whatsapp/:channelId` resolve o canal **só pelo `channelId` da URL**, ignorando de qual número a mensagem realmente veio. Com 1 candidato só (situação atual), funciona por acaso, porque só existe um `channelId` possível. No momento em que um segundo número for cadastrado na mesma WABA, mensagens de candidatos diferentes vão cair todas no mesmo canal — conversa, contato, histórico e resposta da IA do candidato errado.

O sistema irmão (`syncroflow`, repositório comercial) já resolveu exatamente esse problema: ele lê o campo `phone_number_id` de dentro do payload que a Meta envia (`entry[0].changes[0].value.metadata.phone_number_id`) e busca no banco qual canal tem esse `phoneNumberId` salvo em `channel.config`, usando o `channelId` da URL só como fallback para canais antigos sem esse dado.

### Escopo
**Dentro:** a lógica de resolução de canal dentro de `POST /webhooks/whatsapp/:channelId` no SyncroFlowEleições.
**Fora:** qualquer alteração no repositório `syncroflow` (só usar como referência de leitura); qualquer alteração na rota `/webhooks/meta` (Instagram/Facebook) — isso é o Módulo 2.

### Requisitos Funcionais
- Uma mensagem recebida de qualquer número de WhatsApp cadastrado deve sempre ser atribuída ao canal/candidato dono real daquele número, independentemente de qual `channelId` estiver na URL que a Meta chamou.

### Requisitos Técnicos
1. Em `webhooks.routes.ts`, na rota `POST /webhooks/whatsapp/:channelId`, extrair `phoneNumberId` de `req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id`.
2. Se `phoneNumberId` existir, buscar o canal por esse valor dentro de `channel.config` (`type: 'WHATSAPP'`) — ver Módulo 2 para a forma performática de fazer essa busca (não usar `findMany` + filtro em JS a esta escala).
3. Só cair para `prisma.channel.findUnique({ where: { id: urlChannelId } })` se `phoneNumberId` não vier no payload (compatibilidade com canais antigos).
4. Manter a validação de assinatura HMAC (`isValidMetaSignature`) exatamente como já está — não enfraquecer essa checagem.
5. Adaptar a rota de verificação (`GET /webhooks/whatsapp/:channelId`, usada pela Meta para confirmar a URL) se necessário — hoje ela já busca o canal pelo `channelId` da URL para pegar o `verifyToken`; isso pode continuar como está, já que a verificação inicial acontece uma vez por configuração, não por mensagem.

### Dependências
- Módulo 2 (índice dedicado), para a busca por `phoneNumberId` ser rápida em escala — pode ser implementado junto ou logo em seguida.
- Confirmar como o fluxo de provisionamento (Salvy + o que o código chama de "Embedded Signup", hoje marcado como "fase futura" em `meta-cloud.provider.ts`) registra `phoneNumberId` em `channel.config` — sem isso preenchido corretamente na criação do canal, a busca não encontra nada.

### Critérios de Aceite
- Com dois canais de WhatsApp de dois candidatos diferentes cadastrados na mesma WABA, uma mensagem recebida do número do candidato B deve gerar uma conversa no candidato B, mesmo que a URL de webhook configurada na Meta aponte com `channelId` do candidato A.
- Mensagem sem `phone_number_id` no payload (caso não deva ocorrer na prática, mas por segurança) ainda funciona via fallback pelo `channelId` da URL.
- Nenhuma regressão na validação de assinatura HMAC.

### Não-objetivos
- Não migrar o provisionamento de números (Salvy/Embedded Signup) nesta tarefa — só garantir que, uma vez que `phoneNumberId` esteja salvo em `channel.config`, o roteamento funcione.

---

## Módulo 2 — Índice dedicado para resolver canal em escala (WhatsApp + Instagram + Facebook)

### Objetivo
Eliminar a varredura completa da tabela `Channel` a cada mensagem recebida, substituindo por uma consulta indexada.

### Por que isso importa
Hoje, tanto a resolução por `phoneNumberId` (Módulo 1) quanto a rota `POST /webhooks/meta` (Instagram/Facebook) dependem de buscar **todos os canais de um tipo** (`prisma.channel.findMany({ where: { type: { in: ['INSTAGRAM', 'FACEBOOK'] } } })`) e depois filtrar em JavaScript comparando `pageId`/`igAccountId` dentro do JSON `config`. Com 1000+ candidatos (cada um podendo ter até `whatsappLineLimit` números de WhatsApp — até "ilimitado" no plano Enterprise — mais 1 Instagram e 1 Facebook), essa tabela cresce rápido, e essa varredura roda **a cada mensagem recebida de qualquer eleitor, de qualquer candidato**. Isso é: (a) lento, piorando conforme a base cresce; (b) uma fonte de degradação geral do sistema à medida que mais candidatos entram, exatamente o cenário que você quer suportar.

### Escopo
**Dentro:** schema do Prisma (`Channel`), migração, e as duas rotas de webhook que hoje fazem essa varredura.
**Fora:** qualquer mudança no modelo de negócio de quantos canais por tipo um candidato pode ter (isso já está definido em `whatsappLineLimit` e na regra "1 por tipo" para os demais).

### Requisitos Técnicos
1. Adicionar campo indexado ao model `Channel` no `schema.prisma`, por exemplo:
   ```prisma
   model Channel {
     // ...campos existentes...
     externalId String?   // phoneNumberId (WhatsApp) | pageId (Facebook) | igAccountId (Instagram) | botId (Telegram)
     // ...
     @@unique([type, externalId])
   }
   ```
2. Migration Prisma para adicionar a coluna (nullable, para não quebrar canais existentes) + backfill: um script único que lê `config` de cada canal existente e preenche `externalId` a partir do campo correspondente (`phoneNumberId`, `pageId` ou `igAccountId`), rodado uma vez em produção antes de ativar a nova lógica de leitura.
3. Atualizar `webhooks.routes.ts`:
   - WhatsApp: trocar a busca (Módulo 1) por `prisma.channel.findUnique({ where: { type_externalId: { type: 'WHATSAPP', externalId: phoneNumberId } } })`.
   - Meta genérico (`/webhooks/meta`): trocar `findMany` + filtro em JS por duas buscas indexadas (uma tentando `externalId = recipientId`, outra `externalId = entryId`), ou uma única query com `OR`.
4. Toda criação/atualização de canal (rotas de `channels.routes.ts`, fluxo de Embedded Signup/Salvy) passa a também gravar `externalId` junto com `config`, mantendo os dois em sincronia.

### Dependências
- Módulo 1 (usa o mesmo índice).
- Levantar com o time (ou o próprio CODE, ao implementar) todos os pontos do código que criam/atualizam canais, para garantir que `externalId` seja sempre preenchido — não só nas rotas manuais (`channels.routes.ts`), mas também no fluxo automatizado via Salvy.

### Critérios de Aceite
- Consulta de resolução de canal por identificador externo (`phoneNumberId`/`pageId`/`igAccountId`) usa `findUnique`/`findFirst` sobre índice único, não mais `findMany` seguido de filtro em memória.
- Tempo de resposta do webhook não degrada de forma perceptível conforme o número de candidatos cresce (validar com teste de carga simulando alguns milhares de canais).

### Não-objetivos
- Não migrar o WhatsApp/Instagram/Facebook para outro formato de armazenamento de config — `config` (JSON) continua guardando o restante dos dados (accessToken etc.); só o identificador de roteamento sai do JSON para uma coluna própria indexada.

---

## Módulo 3 — Concorrência do worker de mensagens

### Objetivo
Garantir que o processamento de mensagens (IA respondendo) não vire gargalo com muitos candidatos ativos ao mesmo tempo.

### Por que isso importa
Em `apps/api/src/modules/webhooks/message.worker.ts`, o worker é criado assim:
```ts
startMessageWorker() {
  return createWorker<...>('messages', async (job) => { ... }, 5)
}
```
O `5` no final é a concorrência (`createWorker` aceita um `concurrency` que por padrão é `20`, mas aqui está sendo explicitamente reduzido para `5`). Isso significa: no máximo 5 mensagens sendo processadas pela IA ao mesmo tempo, em todo o sistema, para todos os candidatos somados. Com 1000+ candidatos ativos, mesmo que só uma fração pequena esteja recebendo mensagens no mesmo minuto, 5 é pouco — o resultado prático é fila crescendo e demora na resposta ao eleitor, o que contradiz diretamente o argumento de venda do produto ("atendimento em segundos").

### Escopo
**Dentro:** configuração de concorrência do worker de mensagens e, se necessário, estratégia de múltiplas instâncias.
**Fora:** lógica de negócio dentro do processamento da mensagem em si (isso não muda).

### Requisitos Técnicos
1. Levantar com dados reais (ou uma estimativa conservadora) o volume esperado de mensagens simultâneas com 1000+ candidatos ativos, e ajustar a concorrência de acordo — não é só trocar `5` por um número maior "no chute": validar com teste de carga (Módulo 6) para achar o valor que o banco/Redis/APIs externas (Meta, OpenAI/Anthropic) aguentam sem erro.
2. Avaliar rodar múltiplas instâncias do worker (escala horizontal) no EasyPanel, em vez de só aumentar a concorrência de uma instância única — reduz o impacto de uma instância travar.
3. Adicionar monitoramento de profundidade de fila (BullMQ expõe isso) e tempo de espera médio por job, com alerta quando ultrapassar um limiar — para saber que está chegando perto do limite antes que os candidatos percebam lentidão.

### Dependências
- Nenhuma direta, mas o Módulo 4 (limites da Meta) interage com isso: aumentar concorrência não adianta se o gargalo real for o rate limit da Meta/OpenAI, não o processamento em si.

### Critérios de Aceite
- Teste de carga simulando N candidatos com mensagens simultâneas mantém tempo de resposta aceitável (definir o SLA desejado, ex: resposta processada em até X segundos no p95).
- Métrica de profundidade de fila disponível para acompanhamento contínuo.

### Não-objetivos
- Não otimizar o custo/latência da chamada de IA em si (isso é assunto de outro módulo, se necessário).

---

## Módulo 4 — Limites reais da Meta por número/WABA (operacional, não só código)

### Objetivo
Evitar que o crescimento de candidatos esbarre em limites da própria Meta que não se resolvem só com código.

### Contexto
A Meta impõe, por política (não por bug seu): (a) limite de quantos números de telefone podem estar numa mesma WABA, que cresce conforme o nível de verificação da Business Manager; (b) um "tier" de mensagens por número (começa em 250 conversas únicas/24h e sobe automaticamente conforme qualidade e uso, podendo chegar a "ilimitado" só para contas com verificação completa). O código já tem uma boa base para isso — existe `quality-rating.service.ts` e `quality-rating.worker.ts` monitorando a qualidade dos números.

### Requisitos Funcionais
- Visibilidade de quantos números já estão provisionados vs. o limite atual da WABA, e de qual tier de mensagens cada número está, para agir (pedir aumento de limite à Meta, redistribuir candidatos entre WABAs diferentes se necessário) antes de travar novos cadastros.

### Requisitos Técnicos
1. Estender `quality-rating.service.ts`/`quality-rating.worker.ts` (ou criar um serviço irmão) para também consultar e registrar o tier de mensagens por número (a Graph API expõe isso no endpoint do próprio `phone_number_id`).
2. Um alerta (painel administrativo ou notificação) quando o número de canais WhatsApp ativos se aproximar do limite conhecido da WABA atual.
3. Documentar (fora do código, num runbook interno) o processo de solicitar aumento de limite à Meta ou de criar uma segunda WABA/App se necessário at scale — isso não se resolve só programando.

### Dependências
- Módulo 1 e 2 (esse monitoramento só faz sentido depois que o roteamento por número estiver correto).

### Critérios de Aceite
- Existe um lugar (painel ou log estruturado) onde dá pra ver, a qualquer momento, quantos números estão ativos e qual o tier/limite de cada um.

### Não-objetivos
- Esta spec não cobre o processo comercial/jurídico de verificação de negócio junto à Meta — só a parte de instrumentação/visibilidade no sistema.

---

## Módulo 5 — Confirmar isolamento e escala de Telegram e E-mail

### Objetivo
Confirmar que os outros dois canais não têm o mesmo tipo de problema do WhatsApp/Meta, e identificar gargalos próprios deles.

### Telegram
Cada candidato tem seu próprio bot/token, e a URL de webhook já é registrada por `channelId` de forma exclusiva (`/webhooks/telegram/:channelId`, chamado de `setWebhook` direto pro Telegram com essa URL específica) — isso não sofre da limitação de "uma URL só" da Meta, então não há o mesmo bug aqui. Ainda assim, validar:
1. Limite de requisições por bot da API do Telegram (30 msg/s por bot, geralmente suficiente por candidato) não é um problema a esta escala, já que cada candidato tem seu bot isolado.

### E-mail
Usa OAuth do Gmail (`getValidGmailToken`, fila `email-poll`) — mecanismo diferente (parece ser *polling*, não webhook em tempo real). Validar:
1. Confirmar se `email-poll` é de fato polling periódico ou se já usa Gmail Pub/Sub (push) — polling em 1000+ caixas de e-mail tem custo de quota da API do Gmail que cresce proporcionalmente; push é mais escalável.
2. Se for polling, calcular se a frequência atual aguenta 1000+ candidatos sem estourar quota (250 unidades/usuário/segundo é o limite padrão do Gmail API) ou se precisa de ajuste/migração para push.

### Critérios de Aceite
- Relatório curto confirmando: Telegram ok como está / E-mail ok como está, ou lista do que precisa mudar em cada um.

### Não-objetivos
- Não implementar mudanças aqui a menos que a investigação encontre um problema real — este módulo é primeiro de diagnóstico.

---

## Módulo 6 — Validação end-to-end antes de abrir cadastro em massa

### Objetivo
Ter uma confirmação prática, não só teórica, de que o sistema aguenta o volume planejado.

### Requisitos
1. Teste manual mínimo: dois candidatos de teste, dois números de WhatsApp reais na mesma WABA, confirmar que mensagens de cada um vão para a conversa certa (valida Módulo 1 na prática, não só no código).
2. Teste de carga sintético: simular volume de mensagens equivalente a uma fração razoável de 1000 candidatos ativos ao mesmo tempo (definir um número realista, ex: 5-10% ativos simultaneamente) e observar tempo de resposta, profundidade de fila, erros de rate limit.
3. Checklist final antes de abrir cadastro em massa: Módulos 1-4 implementados e validados, aprovação do Instagram confirmada no Meta Business Suite, `.env` de produção conferido (sem referências erradas de domínio, ver observação já levantada sobre `.env.example` apontando para `syncroflow.io`).

### Critérios de Aceite
- Checklist acima completo e assinado antes de qualquer campanha de divulgação em massa.

---

## Módulo 7 — Implementar Embedded Signup no SyncroFlowEleições (candidato conecta o próprio número)

### Objetivo
Permitir que um candidato conecte seu **próprio** número de WhatsApp Business (sem depender de alugar número virtual da Salvy), da mesma forma que já funciona hoje no SyncroFlow comercial.

### Por que isso importa
Hoje, em `meta-cloud.provider.ts`, o método `createInstance` só valida que a configuração já existe — o comentário no código diz explicitamente: *"Embedded Signup (fase futura) é quem popula phoneNumberId/accessToken em channel.config"*. Ou seja, o fluxo de OAuth que permite o candidato logar com a própria conta Meta e vincular o número dele **ainda não está implementado no Eleições**. Sem isso, todo candidato é obrigado a usar número virtual da Salvy — o que pode não ser o que todo candidato quer (muitos já têm um número de WhatsApp Business próprio e ativo, com histórico e contatos).

### Escopo
**Dentro:** implementar o fluxo de Embedded Signup no SyncroFlowEleições, usando como referência de leitura o que já existe e funciona no repositório `syncroflow` (comercial) — **sem copiar/colar código entre os repositórios**, já que são produtos diferentes (podem ter regras de negócio distintas, ex: disclaimer obrigatório do TSE que só existe no Eleições). Reimplementar adaptado ao modelo de dados e regras do Eleições.
**Fora:** mudar o fluxo já existente da Salvy, que continua sendo a segunda opção.

### Requisitos Funcionais
- Candidato consegue, pelo painel, iniciar o processo de conexão de número próprio (popup/redirect OAuth da Meta), escolher o número da própria WABA (ou criar uma nova), e o sistema salva `phoneNumberId`, `accessToken` (de longa duração) e `wabaId` em `channel.config`, criando um `Channel` do tipo `WHATSAPP` normalmente.
- Depois de conectado, o número funciona de forma idêntica a um número Salvy — mesma IA, mesmo roteamento, mesmo disclaimer TSE.

### Requisitos Técnicos
1. Estudar a implementação de Embedded Signup já ativa no `syncroflow` (fluxo OAuth, troca de token de curto por longo prazo, assinatura do App aos eventos do WABA do cliente) como referência de arquitetura — sem importar/copiar arquivos entre os repositórios.
2. Implementar endpoint(s) equivalentes no Eleições (provavelmente em `channels.routes.ts` ou um módulo próprio), respeitando o `whatsappLineLimit` do plano do candidato antes de permitir conectar mais um número.
3. Garantir que, seja qual for a origem do número (Embedded Signup ou Salvy), o `externalId`/`phoneNumberId` (Módulo 2) seja preenchido do mesmo jeito, para o roteamento do Módulo 1 funcionar igual nos dois casos.
4. Tratar corretamente o caso de assinatura do webhook: como o candidato traz sua própria WABA, é preciso assinar (subscribe) o App do Eleições a essa WABA especificamente via API, não só salvar o token.

### Dependências
- Módulo 1 e 2 (o roteamento por `phoneNumberId` precisa estar pronto antes de haver múltiplos números de origens diferentes).

### Critérios de Aceite
- Um candidato de teste consegue conectar um número de WhatsApp Business próprio (não-Salvy) pelo painel do Eleições, e o atendimento por IA funciona normalmente nesse número.
- `whatsappLineLimit` do plano é respeitado também neste fluxo (não só no da Salvy).

### Não-objetivos
- Não alterar nada no repositório `syncroflow` — usá-lo só como referência de leitura.

---

## Módulo 8 — Novo fluxo de entrada: acesso parcial imediato no cadastro, pagamento movido para "Ativação da Campanha"

### Objetivo
Mudar o fluxo de onboarding: hoje o candidato só existe no sistema (conta criada) depois que o pagamento é confirmado. O pedido é inverter isso — criar a conta e liberar parte do sistema **imediatamente no cadastro**, deixando o pagamento (e o restante dos módulos) para um passo posterior, feito quando o candidato quiser dentro de Configurações → Financeiro.

### Contexto encontrado no código (importante para o CODE entender o tamanho da mudança)
Hoje o fluxo é, literalmente, "paga primeiro, existe depois":
- `POST /auth/register` (`auth.routes.ts` → `createPendingRegistration`) **não cria `Candidate` nem `User`** — só grava um `PendingRegistration` (dados pessoais + plano escolhido).
- A conta real (`Candidate` com `status: 'ACTIVE'`, `User`, `TeamMember` Administrador, `AgentConfig` com o disclaimer) só é criada dentro de `activatePendingRegistration` (`auth.service.ts`), chamada em dois lugares: pelo webhook do Stripe (`checkout.session.completed`) e pelo webhook da Asaas (`PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`, quando `externalReference` começa com `pending:`).
- Ou seja, **não existe hoje nenhum candidato "cadastrado mas não pago"** — ele simplesmente não existe até o pagamento cair.
- Além disso, `message.worker.ts` (o worker que processa toda mensagem recebida e gera resposta da IA) tem esta checagem logo no início: `if (!candidate || candidate.status !== 'ACTIVE') return`. Ou seja, mesmo que a conta existisse antes do pagamento, hoje ela precisaria ficar com `status: 'ACTIVE'` para o atendimento por IA funcionar — o que colide com a ideia de "status" representar também "pagou/não pagou".
- Boa notícia: o lado da Asaas já está bem mais pronto do que parece à primeira vista. `POST /billing/asaas/checkout` (`billing/asaas.routes.ts`) já funciona **para um candidato existente autenticado** — cria/reaproveita cliente na Asaas, gera cobrança (Pix ou cartão parcelado), salva `asaasPaymentId`/`asaasPlano` no `Candidate` e cria um `Invoice`. E o webhook (`asaasWebhookRoutes`) já sabe diferenciar dois casos pelo `externalReference`: `pending:<id>` (ativação de conta nova, fluxo atual) vs. um `candidateId` puro (hoje tratado como **renovação** de candidato já ativo — seta `status: 'ACTIVE'`, `campaignPaymentMethod`, `campaignPaidUntil` = +365 dias). Esse segundo caminho é essencialmente o que a "Ativação da Campanha" precisa — já existe, só precisa ser reaproveitado/ajustado, não construído do zero.

**Atualização importante confirmada pelo dono do produto:** o SyncroFlowEleições **não usa mais Stripe — o banco de pagamento em uso hoje é só a Asaas**. Isso muda a leitura do que encontrei no código: o arquivo `stripe.routes.ts` (rotas `/auth/register/checkout`, `/billing/whatsapp-lines`, `/billing/portal`, webhook do Stripe) e os campos `stripeCustomerId`/`stripeSubscriptionId` no `Candidate` são, pelo visto, **resquício de uma fase anterior** (antes da migração para Asaas) e não deveriam mais estar em uso — mas o código ainda está lá, ativo, registrado nas rotas. Antes de implementar qualquer parte deste módulo, o CODE precisa:
1. Confirmar no frontend (`apps/web`) se ainda existe algum botão/tela que chama `/auth/register/checkout` ou `/billing/whatsapp-lines` (Stripe) — se não existir mais nenhuma chamada, essas rotas são código morto.
2. Se forem código morto, **não apagar às cegas** (evitar surpresa se algo ainda depender indiretamente) — primeiro confirmar em produção que nenhum candidato tem `stripeSubscriptionId` preenchido recentemente (ou seja, ninguém está passando por ali), documentar como legado e então decidir entre remover ou deixar desativado/comentado.
3. Tratar a Asaas como **única fonte de verdade** de preço e de pagamento em todo este módulo — o item 6 abaixo (preço) e o item 7 (compra de linha extra) partem dessa premissa.

### Escopo
**Dentro:** fluxo de registro (`auth.routes.ts`/`auth.service.ts`), schema do `Candidate` (novo campo de ativação), RBAC (`lib/rbac.ts`), nova seção "Ativação da Campanha" em Configurações → Financeiro (reaproveitando `/billing/asaas/checkout`), e as duas alterações de texto na seção "Comprar linhas de WhatsApp".
**Fora:** decisão final de remover fisicamente o código legado do Stripe (isso pode ser um item à parte, de limpeza técnica) — aqui o objetivo é só confirmar que ele não está em uso e garantir que a Asaas seja o único caminho real de pagamento no Eleições.

### Requisitos Funcionais
1. No cadastro inicial (passo 1, dados pessoais + escolha do plano/cargo), a conta já é criada de verdade — não fica mais "pendente" esperando pagamento. O candidato consegue logar imediatamente após se cadastrar.
2. Com a conta recém-criada e **sem pagamento ainda**, o candidato tem acesso liberado a: Minha História e Propostas, Portal do Eleitor, Atendimento (todo — WhatsApp/Instagram/Facebook/Telegram/E-mail), Campo & Pesquisa, Inteligência, Financeiro da campanha (o módulo de prestação de contas/lançamentos do próprio candidato, `LancamentoFinanceiro` — diferente da cobrança da assinatura) e Configurações.
3. Os demais módulos aparecem no menu (não somem), mas ficam bloqueados/com aviso de que precisam da "Ativação da Campanha" até o pagamento ser confirmado.
4. Dentro de Configurações → Financeiro, uma nova seção "Ativação da Campanha" mostra o plano/cargo escolhido no cadastro (dep. estadual, dep. federal, senador/governador etc.) e um botão de pagamento via Asaas.
5. Ao confirmar o pagamento, os módulos bloqueados são liberados automaticamente (via webhook da Asaas), sem precisar de ação manual de suporte.

### Requisitos Técnicos
1. **Criação de conta imediata:** adaptar `createPendingRegistration`/`POST /auth/register` para, em vez de só gravar `PendingRegistration`, executar (adaptado) o que hoje só roda em `activatePendingRegistration`: criar `Candidate` + `User` + `TeamMember` (Administrador) + `AgentConfig` na hora. Recomendo manter `PendingRegistration` só para os dados do passo 1 até o passo 2 (escolha de plano/forma de pagamento) ser preenchido, e criar a conta real ao final do passo 2 — mas **antes** do pagamento, não depois.
2. **Novo campo no `Candidate` para separar "conta existe/ativa" de "campanha paga/ativada"**, para não sobrecarregar o `status` (`ACTIVE/SUSPENDED/CANCELLED`) com dois significados. Sugestão:
   ```prisma
   model Candidate {
     // ...campos existentes...
     campaignActivated   Boolean   @default(false) // true quando o pagamento da campanha é confirmado
     // campaignPaidUntil já existe e pode continuar sendo a fonte de verdade de "até quando está pago";
     // campaignActivated pode ser calculado a partir dele (campaignPaidUntil != null && campaignPaidUntil > now)
     // ou mantido como flag simples — decisão de implementação, mas precisa existir uma forma clara de checar isso.
   }
   ```
   Manter `status: 'ACTIVE'` desde a criação (para o `message.worker.ts` não precisar mudar sua checagem de status e o atendimento por IA já funcionar desde o cadastro, conforme pedido).
3. **RBAC:** hoje `lib/rbac.ts` só controla **quem dentro da equipe** vê o quê (papel), não se **a conta como um todo** já pagou. É um eixo diferente e precisa ser somado, não substituído. Adicionar uma checagem adicional (`requireCampaignActivated` ou dentro do próprio `requireModule`) para os módulos bloqueados, verificando `candidate.campaignActivated` (ou `campaignPaidUntil`) além do papel do usuário.
   - Mapeamento dos módulos citados para o `Module` enum existente: `story` (Minha História e Propostas), `portal` (Portal do Eleitor), `chat`/`contacts`/`agenda` (Atendimento), `field_agent` (Campo & Pesquisa), `financeiro` (Financeiro da campanha), `settings` (Configurações) — todos **liberados desde o cadastro**, sem checagem de `campaignActivated`.
   - **"Inteligência" não corresponde a nenhum valor existente no enum `Module`** — pelas features do schema (`RadarMonitorado`/`ResumoRadar`, `ConteudoIA`, `FactCheck`), é provável que "Inteligência" seja essa área e ainda não esteja mapeada no RBAC. Precisa de uma decisão: criar um novo valor de `Module` (`'inteligencia'`) e liberá-lo por padrão, ou confirmar a qual módulo existente isso já pertence.
   - Módulos que ficam **bloqueados até a ativação** (`platform`, `reports`, `team`, `gabinete`, `equipe`, `prestacao` no enum atual) — **isto é inferência minha, não foi confirmado pelo usuário**: ele disse só "o restante" sem listar. Antes de implementar o bloqueio, vale confirmar essa lista com o dono do produto para não travar (ou liberar) o módulo errado.
4. **Nova seção "Ativação da Campanha"** (frontend, dentro da página de Configurações → Financeiro, ao lado/abaixo do "Resumo do plano" já existente): mostra `candidate.position`/plano escolhido e um botão que chama o endpoint já existente `POST /billing/asaas/checkout`. Esse endpoint hoje é `admin-only` (ok, é o mesmo público que já acessa Configurações → Financeiro) e já cria a cobrança Asaas; só precisa de UI nova, não de endpoint novo.
5. **Ajustar o webhook da Asaas** (`asaasWebhookRoutes`, branch onde `externalReference` é um `candidateId` puro) para, além do que já faz (`status: 'ACTIVE'`, `campaignPaymentMethod`, `campaignPaidUntil`), também setar `campaignActivated: true` — esse é o gatilho que libera os módulos bloqueados no painel.
6. **Preço por cargo — fonte de verdade é a Asaas/site, Stripe está desatualizado e não deve mais ser usado:**
   - Asaas (`PLANOS_CAMPANHA`, `lib/asaas.ts`): `deputado_estadual` = R$5.990, `deputado_federal` = R$7.490, `senador_governador` = R$10.990 — **estes são os valores corretos, iguais aos exibidos hoje no site** (Pix ou cartão de débito). Esta é a única tabela de preço que deve estar em uso no Eleições.
   - Stripe (`CARGO_PRICES`, `stripe.routes.ts`): `DEP_ESTADUAL` = R$4.790, `DEP_FEDERAL` = R$7.200, `SENADOR_GOV` = R$10.800 — **valores antigos, de uma tabela que não deveria mais estar ativa**, já que o Eleições não usa Stripe. Não faz sentido "sincronizar" os dois; o correto é garantir que nenhuma tela chegue a usar `CARGO_PRICES` na prática (ver item de legado do Stripe acima).
   - Revisar se o preço por cargo está hardcoded em mais algum lugar do sistema (tela de escolha de plano no cadastro, e-mails de confirmação, qualquer PDF/recibo) e apontar tudo para os valores da Asaas.
7. **Compra de linha extra de WhatsApp está quebrada hoje, não é só um caso de borda:** `POST /billing/whatsapp-lines` exige `candidate.stripeSubscriptionId` (`if (!candidate?.stripeSubscriptionId) return reply.status(400)...`). Como o Eleições não usa mais Stripe, **nenhum candidato tem esse campo preenchido** — ou seja, esse botão hoje falha para todo mundo, não só para quem ativou via Asaas. Precisa de uma versão equivalente usando Asaas (cobrança avulsa ou recorrente por linha extra, mesmo modelo de `criarCobrancaAsaas` já usado em `/billing/asaas/checkout`) antes de expor a seção renomeada "Comprar Créditos de IA com linha Virtual para Whatsapp" — do jeito que está, o botão renomeado continuaria quebrado.

### Alterações de texto (seção "Comprar linhas de WhatsApp", Configurações → Financeiro)
Localizar no frontend (`apps/web`) o componente que renderiza essa seção — buscar pelo texto atual exato para achar o arquivo certo:
1. Título atual → novo: **"Comprar Créditos de IA com linha Virtual para Whatsapp"**
2. Texto atual: *"Cada linha extra custa R$ 497,00/mês."* → novo texto: **"Cada pacote de créditos de IA com linha virtual para Whatsapp custa: R$ 497,00 até o dia 30/09/26. Escolha a quantidade de pacote que desejar."**
   - Observação: o novo texto tem uma data-limite (30/09/26) embutida — se possível, deixar esse valor como uma constante/config fácil de achar e atualizar depois (em vez de string solta só no frontend), já que provavelmente vai mudar após essa data.
3. O botão de ação ("+ Adicionar 1 linha — R$497/mês") pode manter o valor, mas revisar se o rótulo ainda faz sentido com a mudança de nome da seção (de "linha" para "pacote de créditos de IA com linha").

### Dependências
- Módulo 1 e 2 (o roteamento por `phoneNumberId` precisa estar correto antes de abrir cadastro imediato para muito mais candidatos de uma vez, já que a barreira do pagamento — que hoje limitava naturalmente o ritmo de entrada — deixa de existir).
- Depende de confirmação do dono do produto sobre: lista exata de módulos bloqueados ("o restante"), e o que é "Inteligência" no RBAC.

### Critérios de Aceite
- Um novo cadastro consegue logar e usar Atendimento/Portal do Eleitor/Campo & Pesquisa/Financeiro da campanha/Configurações **sem ter pago nada ainda**.
- Módulos fora dessa lista aparecem no menu, mas bloqueados, com indicação clara de que dependem da "Ativação da Campanha".
- Botão "Ativação da Campanha" em Configurações → Financeiro gera cobrança Asaas real e, após confirmação de pagamento, libera automaticamente os módulos bloqueados (sem intervenção manual).
- Textos da seção "Comprar linhas de WhatsApp" atualizados exatamente conforme especificado acima.
- Preço de cada cargo (dep. estadual R$5.990 / dep. federal R$7.490 / senador-governador R$10.990) é o mesmo em todos os pontos do sistema — site, tela de cadastro, Stripe e Asaas — sem nenhum lugar mostrando o valor antigo.

### Não-objetivos
- Não remover fisicamente o código do Stripe nesta tarefa — só confirmar que está inativo/legado e garantir que a Asaas seja o único caminho real de pagamento usado.
- Não construir a versão Asaas de compra de linha extra fora do escopo mínimo necessário para a seção renomeada funcionar (item 7 acima é obrigatório, não opcional, dado que a rota atual está quebrada para todo candidato).

### Perguntas em aberto (responder antes de implementar, para não travar/liberar módulo errado)
1. Lista exata de módulos que ficam bloqueados até a ativação — o pedido só disse "o restante"; minha inferência (Relatórios, Equipe, Gabinete/Gabinete 360, Prestação de Contas) precisa de confirmação.
2. "Inteligência" corresponde a qual funcionalidade concreta no sistema (Radar? Conteúdo IA? Fact-check?) — hoje não existe esse valor no enum de módulos do RBAC.
3. Se um candidato nunca ativar a campanha (fica só no acesso parcial indefinidamente), há algum limite de tempo/mensagens para o acesso gratuito, ou ele pode usar o Atendimento sem custo por tempo indeterminado?
4. Confirmar se existe algum candidato real hoje com `stripeSubscriptionId`/`stripeCustomerId` preenchido (resquício de antes da migração para Asaas) — se existir, esses casos precisam de um plano de migração para o modelo Asaas antes de qualquer código Stripe ser desativado.

---

## Resumo de prioridade

1. **Módulo 1 (P0)** — sem isso, o segundo número (seja Salvy ou próprio do candidato) já quebra o sistema para os dois.
2. **Módulo 2 (P0/P1)** — necessário para o Módulo 1 funcionar bem em escala, não só com 2 candidatos de teste.
3. **Módulo 8 (P0/P1, negócio)** — muda o modelo de entrada de clientes; decisão de produto que precisa estar definida antes da divulgação em massa, já que afeta diretamente como todo novo candidato vai experimentar o sistema.
4. **Módulo 3 (P1)** — worker vai sufocar antes dos 1000 candidatos se não for ajustado.
5. **Módulo 4 (P1, operacional)** — sem isso, o sistema pode estar tecnicamente pronto e ainda assim travar por limite da própria Meta.
6. **Módulo 7 (P1)** — sem isso, todo candidato é forçado a usar Salvy; bloqueia quem quer usar número próprio.
7. **Módulo 5 (P2, diagnóstico)** — provavelmente menor risco, mas precisa de confirmação.
8. **Módulo 6** — portão de saída antes de abrir cadastro em massa.
