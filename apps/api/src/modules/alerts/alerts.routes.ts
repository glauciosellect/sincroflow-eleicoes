import type { FastifyInstance } from 'fastify'
import { getWorkspaceId } from '../../lib/workspace'
import { getAlertsForCandidate } from './alerts.service'

export async function alertRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  app.get('/alerts', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const alerts = await getAlertsForCandidate(candidateId)
    return reply.send(alerts)
  })
}
