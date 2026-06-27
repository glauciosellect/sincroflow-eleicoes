import PDFDocument from 'pdfkit'
import { prisma } from '../../lib/prisma'
import { PLATFORM_TOPICS } from '../../lib/platform-topics'

const COLOR_AZUL = '#002776'
const COLOR_VERDE = '#009C3B'
const COLOR_CINZA = '#64748B'

function dateRange(start?: string, end?: string) {
  const s = start ? new Date(start) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const e = end ? new Date(end) : new Date()
  return { gte: s, lte: e }
}

const REQUEST_STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Recebido',
  ANALYZING: 'Em análise',
  FORWARDED: 'Encaminhado',
  RESOLVED: 'Resolvido',
}

// Monta o mesmo conjunto de dados exibido na tela de Relatórios e desenha um PDF
// de uma página com cada seção — pensado para ser impresso ou enviado por e-mail
// (ex: para o partido), sem depender de navegador (não usa Puppeteer).
export async function generateReportPdf(candidateId: string, start?: string, end?: string): Promise<Buffer> {
  const range = dateRange(start, end)

  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })

  const [conversations, newContacts, requests, resolvedRequests, byStatus, topicsGrouped, gapsGrouped, topContacts] = await Promise.all([
    prisma.conversation.count({ where: { candidateId, createdAt: range } }),
    prisma.contact.count({ where: { candidateId, createdAt: range } }),
    prisma.request.count({ where: { candidateId, createdAt: range } }),
    prisma.request.count({ where: { candidateId, createdAt: range, status: 'RESOLVED' } }),
    prisma.request.groupBy({ by: ['status'], where: { candidateId }, _count: true }),
    prisma.message.groupBy({
      by: ['topicKey'],
      where: { topicKey: { not: null }, createdAt: range, conversation: { candidateId } },
      _count: true,
      orderBy: { _count: { topicKey: 'desc' } },
      take: 10,
    }),
    prisma.message.groupBy({
      by: ['topicKey'],
      where: { isContentGap: true, createdAt: range, conversation: { candidateId } },
      _count: true,
      orderBy: { _count: { topicKey: 'desc' } },
      take: 10,
    }),
    prisma.contact.findMany({
      where: { candidateId },
      orderBy: { totalInteractions: 'desc' },
      take: 10,
      select: { name: true, phone: true, totalInteractions: true },
    }),
  ])

  const resolutionRate = requests > 0 ? Math.round((resolvedRequests / requests) * 100) : 0
  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]))
  const topics = topicsGrouped.map((g) => ({
    name: PLATFORM_TOPICS.find((t) => t.key === g.topicKey)?.name ?? g.topicKey,
    count: g._count,
  }))
  const gaps = gapsGrouped.map((g) => ({
    name: g.topicKey ? (PLATFORM_TOPICS.find((t) => t.key === g.topicKey)?.name ?? g.topicKey) : 'Sem tema identificado',
    count: g._count,
  }))

  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } })
  const chunks: Buffer[] = []
  doc.on('data', (chunk) => chunks.push(chunk))

  const formatPeriod = `${range.gte.toLocaleDateString('pt-BR')} a ${range.lte.toLocaleDateString('pt-BR')}`

  // Cabeçalho
  doc.fillColor(COLOR_AZUL).fontSize(20).font('Helvetica-Bold').text('Relatório de Campanha', { align: 'left' })
  doc.fillColor(COLOR_CINZA).fontSize(11).font('Helvetica').text(candidate?.name || '', { align: 'left' })
  doc.fontSize(9).text(`Período: ${formatPeriod}  ·  Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`)
  doc.moveDown(1)
  doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke()
  doc.moveDown(1)

  function sectionTitle(title: string) {
    doc.fillColor(COLOR_AZUL).fontSize(13).font('Helvetica-Bold').text(title)
    doc.moveDown(0.3)
  }

  function kv(label: string, value: string | number) {
    doc.fillColor(COLOR_CINZA).fontSize(10).font('Helvetica').text(label, { continued: true })
    doc.fillColor('#0F172A').font('Helvetica-Bold').text(`  ${value}`)
  }

  // Visão Geral
  sectionTitle('Visão Geral')
  kv('Conversas no período:', conversations)
  kv('Novos eleitores:', newContacts)
  kv('Solicitações recebidas:', requests)
  kv('Taxa de resolução:', `${resolutionRate}%`)
  doc.moveDown(1)

  // Status das Solicitações
  sectionTitle('Status das Solicitações')
  for (const [key, label] of Object.entries(REQUEST_STATUS_LABELS)) {
    kv(`${label}:`, statusMap[key] ?? 0)
  }
  doc.moveDown(1)

  // Temas Mais Perguntados
  sectionTitle('Temas Mais Perguntados')
  if (topics.length === 0) {
    doc.fillColor(COLOR_CINZA).fontSize(10).font('Helvetica').text('Sem dados no período')
  } else {
    topics.forEach((t, i) => kv(`${i + 1}. ${t.name}`, `${t.count}x`))
  }
  doc.moveDown(1)

  // Perguntas Sem Resposta
  sectionTitle('Perguntas Sem Resposta (Gaps de Conteúdo)')
  if (gaps.length === 0) {
    doc.fillColor(COLOR_VERDE).fontSize(10).font('Helvetica').text('Nenhum gap de conteúdo no período')
  } else {
    gaps.forEach((g) => kv(g.name, `${g.count}x`))
  }
  doc.moveDown(1)

  // Eleitores Mais Engajados
  if (doc.y > 650) doc.addPage()
  sectionTitle('Eleitores Mais Engajados (Top 10)')
  if (topContacts.length === 0) {
    doc.fillColor(COLOR_CINZA).fontSize(10).font('Helvetica').text('Nenhum dado ainda')
  } else {
    topContacts.forEach((c, i) => kv(`${i + 1}. ${c.name || c.phone}`, `${c.totalInteractions} interações`))
  }

  doc.end()

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })
}
