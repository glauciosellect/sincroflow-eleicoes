import type { FastifyInstance } from 'fastify'
import { getWorkspaceId } from '../../lib/workspace'
import { getAlertsForCandidate } from './alerts.service'
import { requireNotRole } from '../../lib/rbac'

export async function alertRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // Mesma regra do Dashboard geral — Agente de Campo não vê alertas da campanha,
  // só o próprio desempenho.
  app.get('/alerts', { onRequest: [requireNotRole('AGENTE_CAMPO')] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const alerts = await getAlertsForCandidate(candidateId)
    return reply.send(alerts)
  })
}
