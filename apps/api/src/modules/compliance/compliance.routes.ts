import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getWorkspaceId } from '../../lib/workspace'
import { requireSystemAdminKey } from '../../lib/system-admin'
import { getSystemConfig, updateElectionDates, getComplianceStatus } from './compliance.service'

export async function complianceRoutes(app: FastifyInstance) {

  // Configuração global das datas dos turnos — somente admin do sistema
  app.get('/system/election-dates', async (req, reply) => {
    if (!requireSystemAdminKey(req, reply)) return
    const config = await getSystemConfig()
    return reply.send(config)
  })

  app.patch('/system/election-dates', async (req, reply) => {
    if (!requireSystemAdminKey(req, reply)) return
    const data = z.object({
      electionRound1Date: z.string().datetime().nullable().optional(),
      electionRound2Date: z.string().datetime().nullable().optional(),
    }).parse(req.body)

    const updated = await updateElectionDates({
      electionRound1Date: data.electionRound1Date !== undefined ? (data.electionRound1Date ? new Date(data.electionRound1Date) : null) : undefined,
      electionRound2Date: data.electionRound2Date !== undefined ? (data.electionRound2Date ? new Date(data.electionRound2Date) : null) : undefined,
    })
    return reply.send(updated)
  })

  // Status de compliance do candidato logado — usado pelo dashboard e pela aba Compliance TSE
  app.get('/agent/compliance', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const status = await getComplianceStatus(candidateId)
    return reply.send(status)
  })
}
