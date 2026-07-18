// Módulo 8 (SPEC-SyncroFlowEleicoes-Escala-Webhooks): data-limite para uso gratuito do
// sistema sem pagamento. Até esta data, quase tudo funciona normalmente mesmo sem
// "Ativação da Campanha" confirmada; a partir dela, só Configurações → Financeiro
// (para o candidato pagar) fica acessível a quem não ativou.
// Horário de Brasília (UTC-3): 20/08/2026 18:00 = 21:00 UTC.
export const CAMPAIGN_ACTIVATION_DEADLINE = new Date('2026-08-20T21:00:00.000Z')

export function isPastActivationDeadline(now: Date = new Date()): boolean {
  return now.getTime() >= CAMPAIGN_ACTIVATION_DEADLINE.getTime()
}

export function daysUntilActivationDeadline(now: Date = new Date()): number {
  const diffMs = CAMPAIGN_ACTIVATION_DEADLINE.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))
}

// Um candidato só precisa ser bloqueado se: (a) já passou a data-limite, e
// (b) ainda não confirmou o pagamento da campanha.
export function shouldBlockForNonActivation(campaignActivated: boolean, now: Date = new Date()): boolean {
  return !campaignActivated && isPastActivationDeadline(now)
}
