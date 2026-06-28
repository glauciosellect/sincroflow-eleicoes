import type { FastifyRequest, FastifyReply } from 'fastify'

// Protege operações de sistema que não pertencem a nenhum candidato específico —
// chave fixa guardada em .env, digitada uma vez por sessão no painel /admin
// (ver compliance.routes.ts e system-admin.routes.ts).
export function requireSystemAdminKey(req: FastifyRequest, reply: FastifyReply): boolean {
  const key = req.headers['x-system-admin-key']
  if (!process.env.SYSTEM_ADMIN_KEY || key !== process.env.SYSTEM_ADMIN_KEY) {
    reply.status(403).send({ error: 'Não autorizado' })
    return false
  }
  return true
}
