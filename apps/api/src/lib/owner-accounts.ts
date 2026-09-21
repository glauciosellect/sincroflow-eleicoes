// Contas do dono do sistema (NuClick) — usadas para testes e atendimento real.
// Isentas de qualquer trava de pagamento/ativação de campanha (status SUSPENDED
// por Pix/boleto vencido, prazo de "Ativação da Campanha" do Módulo 8, etc.).
// Referenciado por campaign-payment.service.ts e rbac.ts — mantenha só aqui.
export const OWNER_EMAILS = [
  'nuclick10@gmail.com',
  'glaucio.sellect@gmail.com',
  'glaucio@syncroflow.com',
  'glaucio2@syncroflow.com',
]

export function isOwnerAccount(email: string | null | undefined): boolean {
  return !!email && OWNER_EMAILS.includes(email)
}
