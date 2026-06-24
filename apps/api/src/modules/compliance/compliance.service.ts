import { prisma } from '../../lib/prisma'

const DEACTIVATION_LEAD_MS = 72 * 60 * 60 * 1000 // 72h antes do turno (Resolução TSE nº 23.755/2026)

export async function getSystemConfig() {
  return prisma.systemConfig.upsert({
    where: { id: 'global' },
    update: {},
    create: { id: 'global' },
  })
}

export async function updateElectionDates(opts: { electionRound1Date?: Date | null; electionRound2Date?: Date | null }) {
  return prisma.systemConfig.upsert({
    where: { id: 'global' },
    update: opts,
    create: { id: 'global', ...opts },
  })
}

// Para cada turno configurado, o agente deve estar DESATIVADO entre [deactivateAt, turno].
// Retorna o próximo turno relevante (o mais próximo no futuro, ou o que está em janela de
// desativação agora) — null se nenhum turno estiver configurado ou todos já passaram.
export function getNextRelevantRound(config: { electionRound1Date: Date | null; electionRound2Date: Date | null }, now = new Date()) {
  const rounds = [config.electionRound1Date, config.electionRound2Date]
    .filter((d): d is Date => !!d && d.getTime() > now.getTime() - 24 * 60 * 60 * 1000) // ainda não passou (com folga de 1 dia)
    .sort((a, b) => a.getTime() - b.getTime())

  if (rounds.length === 0) return null
  const electionDate = rounds[0]
  const deactivateAt = new Date(electionDate.getTime() - DEACTIVATION_LEAD_MS)
  return { electionDate, deactivateAt }
}

// Status de compliance para um candidato — usado pelo dashboard e pela aba Compliance TSE.
export async function getComplianceStatus(candidateId: string) {
  const config = await getSystemConfig()
  const round = getNextRelevantRound(config)
  const now = new Date()

  if (!round) {
    return { round: null, mustBeDeactivated: false, daysUntilDeactivation: null, daysUntilElection: null }
  }

  const mustBeDeactivated = now >= round.deactivateAt && now < round.electionDate
  const daysUntilDeactivation = Math.ceil((round.deactivateAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  const daysUntilElection = Math.ceil((round.electionDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

  return {
    round: { electionDate: round.electionDate, deactivateAt: round.deactivateAt },
    mustBeDeactivated,
    daysUntilDeactivation: daysUntilDeactivation > 0 ? daysUntilDeactivation : 0,
    daysUntilElection: daysUntilElection > 0 ? daysUntilElection : 0,
  }
}

// Roda periodicamente (ver compliance.worker.ts): desativa todo agente que deveria estar
// desativado e ainda não está; reativa quem passou da data do pleito e foi desativado por TSE.
export async function enforceComplianceForAllCandidates(): Promise<{ deactivated: number; reactivated: number }> {
  const config = await getSystemConfig()
  const round = getNextRelevantRound(config)
  const now = new Date()

  let deactivated = 0
  let reactivated = 0

  if (round && now >= round.deactivateAt && now < round.electionDate) {
    const result = await prisma.agentConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false, deactivatedAt: now, deactivationReason: 'TSE_AUTO_DEACTIVATION' },
    })
    deactivated = result.count
  }

  // Reativação: somente agentes desativados automaticamente por TSE, e somente após o pleito
  // (o candidato precisa reativar manualmente depois — aqui só liberamos o flag para permitir).
  const pastElection = !round || now >= round.electionDate
  if (pastElection) {
    const result = await prisma.agentConfig.updateMany({
      where: { isActive: false, deactivationReason: 'TSE_AUTO_DEACTIVATION' },
      data: { deactivationReason: null },
    })
    reactivated = result.count
  }

  return { deactivated, reactivated }
}
