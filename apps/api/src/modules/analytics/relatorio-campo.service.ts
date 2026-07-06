import { prisma } from '../../lib/prisma'
import { sendEmail } from '../../lib/mailer'
import { subDays, startOfWeek, endOfWeek, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function previousWeekRange() {
  const now = new Date()
  const lastWeekDay = subDays(now, 7)
  return {
    gte: startOfWeek(lastWeekDay, { weekStartsOn: 1 }),
    lte: endOfWeek(lastWeekDay, { weekStartsOn: 1 }),
  }
}

function fmt(d: Date) {
  return format(d, "dd/MM/yyyy", { locale: ptBR })
}

// ── Email para o Coordenador ──────────────────────────────────────────────────

function emailCoordHtml(params: {
  nomeCoord: string
  semana: { gte: Date; lte: Date }
  totalSubordinados: number
  ativos: number
  inativos: number
  cadastrosSemana: number
  pesquisasSemana: number
  checkInsSemana: number
  topEquipe: { nome: string; score: number; votos: number }[]
  alertas: string[]
}): string {
  const { nomeCoord, semana, totalSubordinados, ativos, inativos, cadastrosSemana,
    pesquisasSemana, checkInsSemana, topEquipe, alertas } = params

  const topHtml = topEquipe.length
    ? topEquipe.map((m, i) => `<li>#${i + 1} ${m.nome} — Score: ${m.score} | Votos comprometidos: ${m.votos}</li>`).join('')
    : '<li>Nenhuma atividade registrada na semana.</li>'

  const alertasHtml = alertas.length
    ? `<ul style="color:#c0392b">${alertas.map(a => `<li>${a}</li>`).join('')}</ul>`
    : '<p style="color:#27ae60">Nenhum alerta. Equipe ativa!</p>'

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:linear-gradient(135deg,#002776,#009C3B);padding:24px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:22px">📊 Relatório Semanal — Equipe de Campo</h1>
        <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px">
          ${fmt(semana.gte)} a ${fmt(semana.lte)}
        </p>
      </div>

      <div style="padding:24px;background:#f9f9f9;border-radius:0 0 8px 8px">
        <p>Olá, <strong>${nomeCoord}</strong>! Aqui está o resumo da sua equipe na semana passada.</p>

        <h3 style="color:#002776;border-bottom:2px solid #009C3B;padding-bottom:6px">👥 Visão da Equipe</h3>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:8px;background:#fff;border-radius:4px;text-align:center">
              <div style="font-size:28px;font-weight:bold;color:#002776">${totalSubordinados}</div>
              <div style="font-size:12px;color:#666">Total na equipe</div>
            </td>
            <td style="width:10px"></td>
            <td style="padding:8px;background:#fff;border-radius:4px;text-align:center">
              <div style="font-size:28px;font-weight:bold;color:#27ae60">${ativos}</div>
              <div style="font-size:12px;color:#666">Ativos na semana</div>
            </td>
            <td style="width:10px"></td>
            <td style="padding:8px;background:#fff;border-radius:4px;text-align:center">
              <div style="font-size:28px;font-weight:bold;color:#e74c3c">${inativos}</div>
              <div style="font-size:12px;color:#666">Sem atividade</div>
            </td>
          </tr>
        </table>

        <h3 style="color:#002776;border-bottom:2px solid #009C3B;padding-bottom:6px;margin-top:20px">📋 Atividades da Semana</h3>
        <ul>
          <li>Cadastros de eleitores: <strong>${cadastrosSemana}</strong></li>
          <li>Pesquisas de voto: <strong>${pesquisasSemana}</strong></li>
          <li>Check-ins registrados: <strong>${checkInsSemana}</strong></li>
        </ul>

        <h3 style="color:#002776;border-bottom:2px solid #009C3B;padding-bottom:6px;margin-top:20px">🏆 Top da Equipe</h3>
        <ul>${topHtml}</ul>

        <h3 style="color:#c0392b;border-bottom:2px solid #e74c3c;padding-bottom:6px;margin-top:20px">⚠️ Alertas</h3>
        ${alertasHtml}

        <p style="margin-top:24px;font-size:12px;color:#999">
          Acesse o painel completo em <a href="https://app.syncrofloweleicoes.com.br/coordenador">app.syncrofloweleicoes.com.br/coordenador</a>
        </p>
      </div>
    </div>
  `
}

// ── Email para o Líder (ColaboradorCampanha) ──────────────────────────────────

function emailLiderHtml(params: {
  nomeLider: string
  semana: { gte: Date; lte: Date }
  atividades: number
  pesquisas: number
  votosComprometidos: number
  scoreAtual: number
  metaVotos: number | null
  posicaoRanking: number
  totalEquipe: number
}): string {
  const { nomeLider, semana, atividades, pesquisas, votosComprometidos,
    scoreAtual, metaVotos, posicaoRanking, totalEquipe } = params

  const progressoMeta = metaVotos && metaVotos > 0
    ? Math.min(100, Math.round((votosComprometidos / metaVotos) * 100))
    : null

  const metaHtml = progressoMeta !== null
    ? `<div style="background:#eee;border-radius:4px;height:12px;margin:6px 0">
        <div style="background:#009C3B;height:12px;border-radius:4px;width:${progressoMeta}%"></div>
       </div>
       <p style="font-size:12px;color:#666">${progressoMeta}% da meta (${votosComprometidos} / ${metaVotos} votos)</p>`
    : `<p>${votosComprometidos} votos comprometidos coletados</p>`

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:linear-gradient(135deg,#002776,#009C3B);padding:24px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:22px">🏅 Seu Desempenho Semanal</h1>
        <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px">
          ${fmt(semana.gte)} a ${fmt(semana.lte)}
        </p>
      </div>

      <div style="padding:24px;background:#f9f9f9;border-radius:0 0 8px 8px">
        <p>Olá, <strong>${nomeLider}</strong>! Veja seu desempenho na semana passada.</p>

        <h3 style="color:#002776;border-bottom:2px solid #009C3B;padding-bottom:6px">📊 Resultados</h3>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:8px;background:#fff;border-radius:4px;text-align:center">
              <div style="font-size:28px;font-weight:bold;color:#002776">${atividades}</div>
              <div style="font-size:12px;color:#666">Atividades</div>
            </td>
            <td style="width:10px"></td>
            <td style="padding:8px;background:#fff;border-radius:4px;text-align:center">
              <div style="font-size:28px;font-weight:bold;color:#009C3B">${pesquisas}</div>
              <div style="font-size:12px;color:#666">Pesquisas</div>
            </td>
            <td style="width:10px"></td>
            <td style="padding:8px;background:#fff;border-radius:4px;text-align:center">
              <div style="font-size:28px;font-weight:bold;color:#f39c12">${scoreAtual}</div>
              <div style="font-size:12px;color:#666">Score</div>
            </td>
          </tr>
        </table>

        <h3 style="color:#002776;border-bottom:2px solid #009C3B;padding-bottom:6px;margin-top:20px">🗳️ Votos Comprometidos</h3>
        ${metaHtml}

        <h3 style="color:#002776;border-bottom:2px solid #009C3B;padding-bottom:6px;margin-top:20px">🏆 Ranking da Equipe</h3>
        <p>Você está em <strong>${posicaoRanking}º lugar</strong> de ${totalEquipe} membros da equipe.</p>
        ${posicaoRanking === 1 ? '<p style="color:#f39c12;font-weight:bold">Parabéns! Você está no topo! 🥇</p>' : ''}

        <p style="margin-top:24px;font-size:12px;color:#999">
          Acesse o painel em <a href="https://app.syncrofloweleicoes.com.br/meu-desempenho">app.syncrofloweleicoes.com.br/meu-desempenho</a>
        </p>
      </div>
    </div>
  `
}

// ── Funções principais ────────────────────────────────────────────────────────

export async function sendWeeklyRelatorioCoord(): Promise<void> {
  const semana = previousWeekRange()

  const coordenadores = await prisma.coordenador.findMany({
    where: { ativo: true, email: { not: '' } },
    select: { id: true, nome: true, email: true, candidateId: true, colaboradorId: true },
  })

  for (const coord of coordenadores) {
    try {
      // Subordinados diretos
      const subordinados = coord.colaboradorId
        ? await prisma.colaboradorCampanha.findMany({
            where: { candidateId: coord.candidateId, supervisorId: coord.colaboradorId, status: 'ativo' },
            select: { id: true, nome: true, scoreAtividade: true, votosComprometidos: true, ultimaAtividade: true },
          })
        : []

      if (subordinados.length === 0) continue

      const subordinadoIds = subordinados.map(s => s.id)
      const limiteInativo = subDays(new Date(), 7)

      const [cadastrosSemana, pesquisasSemana, checkInsSemana] = await Promise.all([
        // Pesquisas (VoteSurveyResponse) coletadas pelos subordinados na semana
        prisma.voteSurveyResponse.count({
          where: {
            candidateId: coord.candidateId,
            collectedById: { in: subordinadoIds },
            createdAt: semana,
          },
        }),
        prisma.voteSurveyResponse.count({
          where: {
            candidateId: coord.candidateId,
            collectedById: { in: subordinadoIds },
            createdAt: semana,
          },
        }),
        prisma.atividadeLider.count({
          where: {
            candidateId: coord.candidateId,
            colaboradorId: { in: subordinadoIds },
            dataAtividade: semana,
          },
        }),
      ])

      const ativos = subordinados.filter(s =>
        s.ultimaAtividade && s.ultimaAtividade >= limiteInativo
      ).length
      const inativos = subordinados.length - ativos

      const alertas: string[] = subordinados
        .filter(s => !s.ultimaAtividade || s.ultimaAtividade < limiteInativo)
        .slice(0, 5)
        .map(s => `${s.nome} — sem atividade nos últimos 7 dias`)

      const topEquipe = [...subordinados]
        .sort((a, b) => b.scoreAtividade - a.scoreAtividade)
        .slice(0, 5)
        .map(s => ({ nome: s.nome, score: s.scoreAtividade, votos: s.votosComprometidos }))

      const html = emailCoordHtml({
        nomeCoord: coord.nome,
        semana,
        totalSubordinados: subordinados.length,
        ativos,
        inativos,
        cadastrosSemana,
        pesquisasSemana,
        checkInsSemana,
        topEquipe,
        alertas,
      })

      await sendEmail(coord.email, `Relatório semanal da sua equipe — ${fmt(semana.gte)} a ${fmt(semana.lte)}`, html)
    } catch {
      // Segue para o próximo coordenador sem travar
    }
  }
}

export async function sendWeeklyRelatorioLideres(): Promise<void> {
  const semana = previousWeekRange()

  const lideres = await prisma.colaboradorCampanha.findMany({
    where: { status: 'ativo', email: { not: null } },
    select: {
      id: true, nome: true, email: true, candidateId: true,
      scoreAtividade: true, votosComprometidos: true, metaVotos: true,
      supervisorId: true,
    },
  })

  // Ranking por candidato (para posição relativa)
  const rankingPorCandidato: Record<string, string[]> = {}
  const todosPorCandidato = await prisma.colaboradorCampanha.findMany({
    where: { status: 'ativo' },
    select: { id: true, candidateId: true, scoreAtividade: true },
    orderBy: { scoreAtividade: 'desc' },
  })
  for (const l of todosPorCandidato) {
    if (!rankingPorCandidato[l.candidateId]) rankingPorCandidato[l.candidateId] = []
    rankingPorCandidato[l.candidateId].push(l.id)
  }

  for (const lider of lideres) {
    if (!lider.email) continue
    try {
      const [atividades, pesquisas] = await Promise.all([
        prisma.atividadeLider.count({
          where: { colaboradorId: lider.id, dataAtividade: semana },
        }),
        prisma.voteSurveyResponse.count({
          where: { collectedById: lider.id, createdAt: semana },
        }),
      ])

      const ranking = rankingPorCandidato[lider.candidateId] || []
      const posicao = ranking.indexOf(lider.id) + 1

      const html = emailLiderHtml({
        nomeLider: lider.nome,
        semana,
        atividades,
        pesquisas,
        votosComprometidos: lider.votosComprometidos,
        scoreAtual: lider.scoreAtividade,
        metaVotos: lider.metaVotos,
        posicaoRanking: posicao || ranking.length,
        totalEquipe: ranking.length,
      })

      await sendEmail(lider.email, `Seu desempenho semanal — SyncroFlow Eleições`, html)
    } catch {
      // Segue para o próximo
    }
  }
}
