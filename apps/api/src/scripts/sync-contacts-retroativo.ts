/**
 * Script de migração retroativa — sincroniza contatos antigos para a tabela Contact.
 * Roda uma vez. Processa: CadastroPortal + VoteSurveyResponse.
 *
 * Executar: npx tsx src/scripts/sync-contacts-retroativo.ts
 */
import { prisma } from '../lib/prisma'
import { syncContactFromField } from '../lib/sync-contact'

async function main() {
  console.log('=== Sincronização retroativa de contatos ===\n')

  // ── 1. CadastroPortal ──────────────────────────────────────────────────────
  const portais = await prisma.portalEleitor.findMany({
    select: { id: true, candidateId: true, slug: true },
  })

  let portalOk = 0, portalSkip = 0
  for (const portal of portais) {
    const cadastros = await prisma.cadastroPortal.findMany({
      where: { portalId: portal.id, contactId: null },
      select: { id: true, nome: true, telefone: true, email: true, bairro: true, cidade: true },
    })

    for (const c of cadastros) {
      try {
        const contactId = await syncContactFromField({
          candidateId: portal.candidateId,
          channelType: 'PORTAL',
          sourceName: portal.slug,
          nome: c.nome,
          telefone: c.telefone || null,
          email: c.email || null,
          bairro: c.bairro || null,
          cidade: c.cidade || null,
        })
        // Marca o cadastro como sincronizado
        await prisma.cadastroPortal.update({ where: { id: c.id }, data: { contactId } })
        portalOk++
      } catch {
        portalSkip++
      }
    }
  }
  console.log(`Portal do Eleitor: ${portalOk} sincronizados, ${portalSkip} erros`)

  // ── 2. VoteSurveyResponse ──────────────────────────────────────────────────
  const surveys = await prisma.voteSurveyResponse.findMany({
    where: {
      OR: [
        { voterName: { not: null } },
        { voterPhone: { not: null } },
      ],
    },
    select: {
      id: true, candidateId: true, voterName: true, voterPhone: true,
      neighborhood: true, city: true,
      collectedBy: { select: { name: true } },
    },
  })

  let surveyOk = 0, surveySkip = 0
  for (const s of surveys) {
    try {
      await syncContactFromField({
        candidateId: s.candidateId,
        channelType: 'CAMPO',
        sourceName: s.collectedBy?.name ?? 'Agente de Campo',
        nome: s.voterName ?? 'Eleitor (pesquisa)',
        telefone: s.voterPhone || null,
        bairro: s.neighborhood || null,
        cidade: s.city || null,
      })
      surveyOk++
    } catch {
      surveySkip++
    }
  }
  console.log(`Pesquisa de Voto: ${surveyOk} sincronizados, ${surveySkip} erros`)

  // ── 3. CadastroPortal do Coordenador (cadastroPortal via coordenador) ──────
  const coordenadores = await prisma.coordenador.findMany({
    select: { id: true, candidateId: true, nome: true },
  })

  let coordOk = 0, coordSkip = 0
  for (const coord of coordenadores) {
    const cadastros = await prisma.cadastroPortal.findMany({
      where: {
        portal: { candidateId: coord.candidateId },
        contactId: null,
        telefone: { not: '' },
      },
      select: { id: true, nome: true, telefone: true, email: true, bairro: true, cidade: true },
    })
    for (const c of cadastros) {
      try {
        const contactId = await syncContactFromField({
          candidateId: coord.candidateId,
          channelType: 'CAMPO',
          sourceName: coord.nome,
          nome: c.nome,
          telefone: c.telefone || null,
          email: c.email || null,
          bairro: c.bairro || null,
          cidade: c.cidade || null,
        })
        await prisma.cadastroPortal.update({ where: { id: c.id }, data: { contactId } })
        coordOk++
      } catch {
        coordSkip++
      }
    }
  }
  console.log(`Coordenador de Campo: ${coordOk} sincronizados, ${coordSkip} erros`)

  console.log('\n=== Concluído! ===')
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
