import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from './prisma'
import { getWorkspaceId } from './workspace'

// Módulos do produto, conforme docs/spec-eleicoes/04-modulos/4.10-equipe.md
export type Module =
  | 'story' // Minha História
  | 'platform' // Plataforma Eleitoral
  | 'chat' // Chat
  | 'contacts' // Contatos
  | 'agenda' // Agenda
  | 'reports' // Relatórios
  | 'settings' // Configurações
  | 'team' // Equipe
  | 'field_agent' // Meu Desempenho (Agente de Campo)

// Tabela fixa de acesso por role (seção 4.10 da spec) — Administrador tem acesso
// total; os demais roles têm um conjunto fixo e não-configurável de módulos.
// AGENTE_CAMPO só acessa a própria tela de desempenho — não atende chat, não vê
// contatos completos, não configura nada.
const ROLE_MODULES: Record<string, Module[]> = {
  ADMINISTRADOR: ['story', 'platform', 'chat', 'contacts', 'agenda', 'reports', 'settings', 'team', 'field_agent'],
  ATENDIMENTO: ['chat', 'contacts', 'agenda'],
  CONTEUDO: ['story', 'platform', 'agenda'],
  RELATORIOS: ['contacts', 'reports'],
  AGENTE_CAMPO: ['field_agent'],
}

export function hasModuleAccess(role: string, module: Module): boolean {
  return ROLE_MODULES[role]?.includes(module) ?? false
}

export async function getUserRole(userId: string, candidateId: string): Promise<string | null> {
  const member = await prisma.teamMember.findFirst({
    where: { userId, candidateId, status: 'ACTIVE' },
    select: { role: true },
  })
  return member?.role ?? null
}

export function requireModule(module: Module) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(user.sub, user.wid)
    const role = await getUserRole(user.sub, candidateId)

    if (!role || !hasModuleAccess(role, module)) {
      return reply.status(403).send({ error: 'Sem permissão para acessar este módulo' })
    }
  }
}

// Registra uma entrada no audit log
export async function auditLog(opts: {
  candidateId: string
  conversationId?: string
  messageId?: string
  eventType: string
  content?: string
  metadata?: Record<string, any>
}) {
  try {
    await prisma.auditLog.create({ data: opts })
  } catch {
    // Audit log nunca pode quebrar a operação principal
  }
}
