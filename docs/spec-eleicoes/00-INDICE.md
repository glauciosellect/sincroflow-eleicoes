# Índice — Spec SyncroFlowEleições (dividida por capítulo)

> Documento original: [`CLAUDE_SyncroFlowEleicoes.md`](../../CLAUDE_SyncroFlowEleicoes.md)
> Esta pasta divide a spec em arquivos menores para facilitar o desenvolvimento por etapas.
> **Antes de tocar em código:** leia [`00-AVISO-CRITICO.md`](00-AVISO-CRITICO.md).

| # | Arquivo | Conteúdo |
|---|---|---|
| 0 | [00-AVISO-CRITICO.md](00-AVISO-CRITICO.md) | Aviso crítico + mapa de substituição de credenciais |
| 1 | [01-visao-geral.md](01-visao-geral.md) | Visão geral do produto |
| 2 | [02-stack-tecnico.md](02-stack-tecnico.md) | Stack técnico |
| 3 | [03-remover-do-original.md](03-remover-do-original.md) | O que remover do SyncroFlow original |
| 4 | [04-modulos/](04-modulos/) | Módulos e especificações (4.1 a 4.13, um arquivo cada) |
| 5 | [05-landing-page.md](05-landing-page.md) | Landing page |
| 6 | [06-tutorial.md](06-tutorial.md) | Tutorial completo do sistema |
| 7 | [07-compliance-tse.md](07-compliance-tse.md) | Regras de negócio — Compliance TSE |
| 8 | [08-banco-de-dados.md](08-banco-de-dados.md) | Banco de dados — tabelas principais |
| 9 | [09-variaveis-ambiente.md](09-variaveis-ambiente.md) | Variáveis de ambiente |
| 10 | [10-cronograma.md](10-cronograma.md) | Prioridade de desenvolvimento (10 dias) |
| 11 | [11-notas-finais.md](11-notas-finais.md) | Notas finais para o desenvolvedor |

## Status do projeto (verificado em 2026-06-24)

- Código em `apps/` e `packages/` é o **monorepo do SyncroFlow original**, ainda não adaptado para o produto eleitoral (sem rotas/telas eleitorais).
- `apps/api/.env` e `apps/web/.env.local` **ainda apontam para os serviços do SyncroFlow original** (Supabase, Stripe, banco). **Não rodar build, dev, migrations ou seeds até as credenciais novas serem configuradas.**
- Pasta `Versão 2.0/` contém planejamento estratégico do SyncroFlow comercial — não é rascunho, mas também não é a spec eleitoral.
