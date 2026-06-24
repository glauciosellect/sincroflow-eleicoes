import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendEmail(to: string, subject: string, html: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'TODO: substituir pelo valor do SyncroFlowEleições',
    to,
    subject,
    html,
  })
}

const TEAM_ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  ATENDIMENTO: 'Atendimento',
  CONTEUDO: 'Conteúdo',
  RELATORIOS: 'Relatórios',
}

export function teamInviteEmail(inviterName: string, candidateName: string, role: string, acceptUrl: string): string {
  const roleLabel = TEAM_ROLE_LABELS[role] || role
  return `
    <h2>Você foi convidado!</h2>
    <p><strong>${inviterName}</strong> convidou você para participar da campanha de <strong>${candidateName}</strong> como <strong>${roleLabel}</strong>.</p>
    <p>Clique no botão abaixo para aceitar o convite:</p>
    <a href="${acceptUrl}" style="background:#009C3B;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">
      Aceitar Convite
    </a>
    <p>Este convite expira em 48 horas. Se você não esperava este convite, pode ignorar este email.</p>
  `
}

export function passwordResetEmail(name: string, resetUrl: string): string {
  return `
    <h2>Olá, ${name}!</h2>
    <p>Você solicitou a redefinição de senha. Clique no link abaixo para criar uma nova senha:</p>
    <a href="${resetUrl}" style="background:#6366f1;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">
      Redefinir Senha
    </a>
    <p>Este link expira em 1 hora. Se você não solicitou, ignore este email.</p>
  `
}
