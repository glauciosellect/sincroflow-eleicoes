import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from './prisma'
import { getWorkspaceId } from './workspace'
import { shouldBlockForNonActivation } from './campaign-activation'

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
  | 'portal' // Portal do Eleitor
  | 'financeiro' // Controle Financeiro
  | 'gabinete' // Gabinete 360
  | 'equipe' // Equipe de Campanha / Coordenadores
  | 'prestacao' // Prestação de Contas
  | 'inteligencia' // Radar Monitorado + Conteúdo IA + Fact-Check

// Módulos que continuam liberados mesmo após a data-limite de ativação da campanha
// (Módulo 8 da SPEC-Escala-Webhooks) para quem ainda não pagou — só Configurações
// (onde fica a seção "Ativação da Campanha") permanece acessível; todo o resto
// bloqueia até o pagamento ser confirmado via Asaas.
const MODULES_EXEMPT_FROM_ACTIVATION_DEADLINE: Module[] = ['settings']

// Tabela fixa de acesso por role (seção 4.10 da spec) — Administrador tem acesso
// total; os demais roles têm um conjunto fixo e não-configurável de módulos.
// AGENTE_CAMPO só acessa a própria tela de desempenho — não atende chat, não vê
// contatos completos, não configura nada.
const ROLE_MODULES: Record<string, Module[]> = {
  ADMINISTRADOR: ['story', 'platform', 'chat', 'contacts', 'agenda', 'reports', 'settings', 'team', 'field_agent', 'portal', 'financeiro', 'gabinete', 'inteligencia'],
  COORDENADOR: ['chat', 'contacts', 'agenda', 'reports', 'field_agent'],
  ATENDIMENTO: ['chat', 'contacts', 'agenda'],
  CONTEUDO: ['story', 'platform', 'agenda', 'inteligencia'],
  RELATORIOS: ['contacts', 'reports'],
  AGENTE_CAMPO: ['field_agent'],
}

export function hasModuleAccess(role: string, module: Module): boolean {
  return ROLE_MODULES[role]?.includes(module) ?? false
}

// Módulo 8: além do papel, verifica se a campanha ainda pode operar sem ter pago —
// depois da data-limite, só os módulos isentos (Configurações) continuam liberados
// para quem não confirmou a "Ativação da Campanha".
export function hasCampaignAccess(module: Module, campaignActivated: boolean): boolean {
  if (MODULES_EXEMPT_FROM_ACTIVATION_DEADLINE.includes(module)) return true
  return !shouldBlockForNonActivation(campaignActivated)
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

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId }, select: { campaignActivated: true } })
    if (!candidate || !hasCampaignAccess(module, candidate.campaignActivated)) {
      return reply.status(403).send({ error: 'Ative a campanha em Configurações → Financeiro para continuar usando este módulo', code: 'CAMPAIGN_NOT_ACTIVATED' })
    }
  }
}

// Restringe uma rota só ao Administrador — usado em ações sensíveis demais para
// qualquer outro role (faturamento, credenciais, integrações).
export function requireAdmin() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(user.sub, user.wid)
    const role = await getUserRole(user.sub, candidateId)

    if (role !== 'ADMINISTRADOR') {
      return reply.status(403).send({ error: 'Apenas o Administrador pode realizar esta ação' })
    }
  }
}

// Bloqueia roles específicos de uma rota que, de outra forma, seria acessível a
// qualquer membro autenticado — usado pelo Dashboard geral, que todos os roles
// acessam exceto Agente de Campo (que só vê o próprio desempenho).
export function requireNotRole(...blockedRoles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user as { sub: string; wid?: string }
    const candidateId = await getWorkspaceId(user.sub, user.wid)
    const role = await getUserRole(user.sub, candidateId)

    if (role && blockedRoles.includes(role)) {
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
