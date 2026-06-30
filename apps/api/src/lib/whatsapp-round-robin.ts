import { prisma } from './prisma'

// Distribui carga de disparo entre múltiplos números WABA do mesmo candidato
// (seção "Round-robin" da spec) — evita concentrar todo o volume numa única
// linha, o que aumenta risco de degradação de Quality Rating / banimento.
// Exclui canais cuja Quality Rating esteja YELLOW/RED (ver quality-rating.service.ts).
export async function getEligibleWhatsAppChannels(candidateId: string) {
  const channels = await prisma.channel.findMany({
    where: { candidateId, type: 'WHATSAPP', isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  return channels.filter((c) => {
    const rating = (c.config as any)?.qualityRating
    return rating !== 'YELLOW' && rating !== 'RED'
  })
}

// Divide a lista de alvos em partes ~iguais, uma por canal elegível, na ordem
// dos canais — round-robin por posição (alvo[0]→canal[0], alvo[1]→canal[1]...).
// Retorna um par [channel, targets[]] por canal que recebeu pelo menos 1 alvo.
export function splitTargetsRoundRobin<T>(targets: T[], channels: { id: string }[]): Array<{ channel: { id: string }; targets: T[] }> {
  const buckets = channels.map((channel) => ({ channel, targets: [] as T[] }))
  targets.forEach((target, index) => {
    buckets[index % buckets.length].targets.push(target)
  })
  return buckets.filter((b) => b.targets.length > 0)
}
