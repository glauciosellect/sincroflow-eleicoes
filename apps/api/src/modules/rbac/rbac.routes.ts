import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { getWorkspaceId } from '../../lib/workspace'
import { getUserRole, hasModuleAccess } from '../../lib/rbac'

export async function rbacRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // Minha role e módulos liberados — usado pelo frontend para montar o menu
  app.get('/candidate/my-role', async (req, reply) => {
    const { sub, wid } = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(sub, wid)
    const role = await getUserRole(sub, candidateId)
    const modules = role
      ? (['story', 'platform', 'chat', 'contacts', 'agenda', 'reports', 'settings', 'team'] as const)
          .filter(m => hasModuleAccess(role, m))
      : []
    return reply.send({ role, modules })
  })

  // Log de auditoria — apenas Administrador
  app.get<{ Querystring: { page?: string; limit?: string; eventType?: string } }>(
    '/candidate/audit-log',
    async (req, reply) => {
      const { sub, wid } = req.user as { sub: string; wid?: string }
      const candidateId = await getWorkspaceId(sub, wid)

      const requesterRole = await getUserRole(sub, candidateId)
      if (requesterRole !== 'ADMINISTRADOR') {
        return reply.status(403).send({ error: 'Apenas o Administrador pode ver o log de auditoria' })
      }

      const page = Number(req.query.page ?? 1)
      const limit = Math.min(Number(req.query.limit ?? 50), 100)
      const skip = (page - 1) * limit

      const where: any = { candidateId }
      if (req.query.eventType) where.eventType = { contains: req.query.eventType }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        prisma.auditLog.count({ where }),
      ])

      return reply.send({ logs, total, page, limit, totalPages: Math.ceil(total / limit) })
    }
  )
}
