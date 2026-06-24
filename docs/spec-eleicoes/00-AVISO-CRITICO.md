# ⚠️ AVISO CRÍTICO — LEIA ANTES DE TOCAR EM QUALQUER ARQUIVO

Este projeto é uma **cópia** da pasta do SyncroFlow original. Isso significa que
**todos os arquivos que você vai abrir contêm referências ao sistema mãe (SyncroFlow)**.
Essas referências estão erradas para este projeto e precisam ser substituídas.

## O risco que você DEVE evitar

O sistema mãe (SyncroFlow) está em produção com usuários reais.
**Se você deixar qualquer referência antiga apontando para os serviços do SyncroFlow,
você vai contaminar o sistema mãe** — apagar dados, sobrescrever configurações,
misturar usuários eleitorais com usuários comerciais. Isso é inaceitável.

**Regra absoluta:** Nunca aponte para nenhum serviço, URL, chave ou projeto
do SyncroFlow original. Cada serviço abaixo tem um substituto novo e exclusivo.

## Mapa de substituição obrigatória

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

## Como proceder ao encontrar uma referência antiga

1. **Não delete** — substitua pelo novo valor correspondente
2. **Não assuma** que uma variável já está certa — verifique sempre
3. **Se não souber o novo valor** — deixe um comentário `// TODO: substituir pelo valor do SyncroFlowEleições` e continue. Não use o valor do SyncroFlow como temporário.
4. **Nunca faça commit** com valores do SyncroFlow original neste repositório

## Ordem de configuração recomendada

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

## Status verificado no repositório (2026-06-24)

- `apps/api/.env` ainda contém `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` e price IDs **do SyncroFlow original**.
- `apps/web/.env.local` ainda contém `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` do ambiente original.
- **Não rodar `npm run dev`, `npm run build`, migrations Prisma ou seeds até substituir essas variáveis.**
