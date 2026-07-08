import { prisma } from '../../lib/prisma'

// Roda periodicamente (ver campaign-payment.worker.ts): suspende quem pagou por
// Pix/boleto avulso (campaignPaidUntil) e não renovou a tempo. Sem tolerância —
// mesmo padrão simples do compliance.service.ts para datas do TSE. Não afeta quem
// paga por cartão/Subscription (campaignPaidUntil fica null para esses).
export async function enforceCampaignPaymentExpiry(): Promise<{ suspended: number }> {
  const expired = await prisma.candidate.findMany({
    where: { plan: 'CAMPAIGN', status: 'ACTIVE', campaignPaidUntil: { lt: new Date() } },
    select: { id: true },
  })

  if (expired.length === 0) return { suspended: 0 }

  const expiredIds = expired.map(c => c.id)
  const now = new Date()

  await prisma.$transaction([
    prisma.agentConfig.updateMany({
      where: { candidateId: { in: expiredIds }, isActive: true },
      data: { isActive: false, deactivatedAt: now, deactivationReason: 'CAMPAIGN_PAYMENT_EXPIRED' },
    }),
    prisma.candidate.updateMany({
      where: { id: { in: expiredIds } },
      data: { status: 'SUSPENDED' },
    }),
  ])

  return { suspended: expired.length }
}
