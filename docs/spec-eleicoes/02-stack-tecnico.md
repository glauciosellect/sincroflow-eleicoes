# 2. Stack Técnico

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

> Nota de implementação: o repositório atual usa Fastify (apps/api) em vez de API Routes
> Next.js puro, e Prisma como ORM sobre o Postgres do Supabase. Isso é equivalente em
> espírito à spec (Node.js + Postgres) — não é necessário migrar para API Routes.

---
Anterior: [01-visao-geral.md](01-visao-geral.md) · Próximo: [03-remover-do-original.md](03-remover-do-original.md)
