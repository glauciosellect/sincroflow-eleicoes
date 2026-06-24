import { prisma } from './prisma'

/**
 * Retorna o candidateId do usuário autenticado.
 * Prioriza o campo `wid` do JWT (emitido no login/register).
 * Fallback: busca no banco o candidato mais antigo (membro ativo) do usuário.
 */
export async function getWorkspaceId(userId: string, widFromToken?: string): Promise<string> {
  if (widFromToken) return widFromToken

  const member = await prisma.teamMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { acceptedAt: 'asc' },
  })
  if (!member) throw new Error('Candidato não encontrado')
  return member.candidateId
}
