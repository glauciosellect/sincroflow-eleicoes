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

  for (const candidate of expired) {
    await prisma.agentConfig.updateMany({
      where: { candidateId: candidate.id, isActive: true },
      data: { isActive: false, deactivatedAt: new Date(), deactivationReason: 'CAMPAIGN_PAYMENT_EXPIRED' },
    })
    await prisma.candidate.update({ where: { id: candidate.id }, data: { status: 'SUSPENDED' } })
  }

  return { suspended: expired.length }
}
