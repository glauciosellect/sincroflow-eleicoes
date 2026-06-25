import { createWorker } from '../../lib/queue'
import { prisma } from '../../lib/prisma'
import { processAgentResponse, processIncomingMedia, detectRequestIntent, classifyMessageForAlerts } from '../ai/ai.service'
import { getWhatsAppProvider } from '../channels/whatsapp/provider.factory'
import { emitNewMessage, emitConversationUpdated } from '../../lib/socket'
import { redis } from '../../lib/redis'
import { getAgendaContextForPrompt } from '../calendar/calendar.service'
import { generateSpeech } from '../tts/tts.service'
import { getValidGmailToken, sendReply } from '../../lib/gmail'
import { createRequest, getRequestStatusMessage } from '../requests/requests.service'
import axios from 'axios'

// Detecta se o remetente é um grupo do WhatsApp (@g.us)
function isWhatsAppGroup(from: string): boolean {
  return from.endsWith('@g.us')
}

// Detecta se a mensagem parece ser de outra IA / bot automatizado — evita loop infinito
function isBotMessage(text: string): boolean {
  const botPatterns = [
    /obrigad[oa]\s*por\s*(entrar|contatar|nos\s*contatar)/i,
    /atendimento\s*(encerrado|finalizado|conclu[ií]do)/i,
    /assistente\s*virtual/i,
    /atendimento\s*autom[aá]tico/i,
    /conversa\s*(encerrada|finalizada)/i,
  ]
  return botPatterns.some((pattern) => pattern.test(text))
}

// Detecta se a mensagem é uma despedida do eleitor
function isFarewellMessage(text: string): boolean {
  const t = text.trim()
  const farewellPatterns = [
    /^(tchau|xau|tchauzinho|xauzinho|até\s*mais|até\s*logo|até\s*breve|até\s*amanhã|falou|flw|fui|valeu\s*falou|abraços?|bjs?|bjão|bjoca)[\s!.]*$/i,
    /^(bye|cya|see\s*you|goodbye|hasta\s*luego)[\s!.]*$/i,
    /\b(tchau|xau|até\s*mais|até\s*logo|até\s*breve|até\s*a\s*próxima|boa\s*noite|boa\s*tarde|bom\s*dia)\s*[\W]*$/i,
  ]
  return t.length <= 60 && farewellPatterns.some((p) => p.test(t))
}

const DISCLAIMER_FALLBACK = 'Olá! Sou o assistente virtual desta campanha. Estou aqui para responder suas dúvidas sobre as propostas, informar sobre eventos e registrar suas sugestões. Como posso ajudar você hoje?'

export function startMessageWorker() {
  return createWorker<{ channelId: string; channelType: string; payload: any }>(
    'messages',
    async (job) => {
      try {
      const { channelType, payload } = job.data
      const { channelId } = job.data

      const channel = await prisma.channel.findUnique({ where: { id: channelId } })
      if (!channel || !channel.isActive) return

      const candidate = await prisma.candidate.findUnique({ where: { id: channel.candidateId } })
      if (!candidate || candidate.status !== 'ACTIVE') return

      const agentConfig = await prisma.agentConfig.findUnique({ where: { candidateId: candidate.id } })
      if (!agentConfig || !agentConfig.isActive) return

      let from: string, name: string, text: string | undefined
      let incomingMediaType: string | undefined
      let incomingMediaUrl: string | undefined
      let emailMetadata: { threadId: string; messageId: string; references?: string; subject: string } | undefined

      if (channelType === 'WHATSAPP') {
        const provider = getWhatsAppProvider()
        const msg = provider.parseWebhook(payload)
        if (!msg) return
        from = msg.from
        name = msg.name
        text = msg.text
        incomingMediaType = msg.mediaType

        if (!text && msg.mediaUrl && msg.mediaType) {
          const providerMediaMatch = msg.mediaUrl.match(/^([a-z-]+):(.+)$/)
          if (providerMediaMatch && provider.downloadMedia) {
            const messageId = providerMediaMatch[2]
            const result = await provider.downloadMedia(messageId, channelId)
            incomingMediaUrl = result.fileURL
            if (result.transcription) {
              text = result.transcription
            } else if (result.fileURL) {
              text = await processIncomingMedia(result.fileURL, msg.mediaType, result.mimetype, result.authHeader)
            } else {
              text = msg.mediaType === 'audio'
                ? '[Áudio recebido — não foi possível transcrever]'
                : '[Mídia recebida]'
            }
          } else {
            incomingMediaUrl = msg.mediaUrl
            text = await processIncomingMedia(msg.mediaUrl, msg.mediaType)
          }
        }

        if (!text) return
        if (isWhatsAppGroup(from)) return
        if (isBotMessage(text)) return

        const silenceKey = `silence:${channelId}:${from}`
        const isSilenced = await redis.get(silenceKey)
        if (isSilenced) { console.log(`[WORKER] conversa silenciada (chave ${silenceKey}) — descartada`); return }

        const farewell = isFarewellMessage(text)
        if (farewell) {
          await redis.set(silenceKey, '1', 'EX', 2 * 60 * 60)
          console.log(`[WORKER] Despedida detectada de ${from} — silenciando por 2h após esta resposta`)
        }

      } else if (channelType === 'TELEGRAM') {
        from = String(payload.message?.from?.id || payload.message?.chat?.id)
        name = payload.message?.from?.first_name || 'Eleitor'
        text = payload.message?.text
        if (!text) return
      } else if (channelType === 'META' || channelType === 'INSTAGRAM' || channelType === 'FACEBOOK') {
        let messaging = payload.entry?.[0]?.messaging?.[0]
        if (!messaging) {
          const val = payload.entry?.[0]?.changes?.[0]?.value
          if (val?.sender && val?.message) {
            messaging = { sender: val.sender, recipient: val.recipient, message: val.message }
          }
        }
        if (!messaging) return
        from = messaging.sender?.id || String(messaging.sender)
        name = 'Eleitor'
        text = messaging.message?.text
        if (!text) return
      } else if (channelType === 'EMAIL') {
        from = payload.from
        name = payload.fromName || payload.from
        text = payload.body
        emailMetadata = {
          threadId: payload.threadId,
          messageId: payload.messageId,
          references: payload.references,
          subject: payload.subject,
        }
        if (!text) return
      } else {
        return
      }

      // ── Créditos de mensagens ativas ──────────────────────────────────────
      // Mensagens passivas (eleitor escreveu primeiro) sempre são respondidas.
      // Mensagens ativas (iniciadas pelo agente — lembretes, disclaimer, broadcast)
      // contam contra o limite de activeMsgsIncluded + activeMsgsExtra.
      const activeMsgsAvailable = (candidate.activeMsgsIncluded + candidate.activeMsgsExtra) > candidate.activeMsgsUsed

      let contact = await prisma.contact.findUnique({
        where: { candidateId_channelId_externalId: { candidateId: candidate.id, channelId, externalId: from } },
      })
      const isNewContact = !contact
      if (!contact) {
        contact = await prisma.contact.create({
          data: { candidateId: candidate.id, channelId, externalId: from, name, phone: channelType === 'WHATSAPP' ? from : undefined },
        })
      } else {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { lastContactAt: new Date(), totalInteractions: { increment: 1 } },
        })
      }

      let conversation = await prisma.conversation.findFirst({
        where: { channelId, contactId: contact.id, status: { not: 'CLOSED' } },
      })
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { candidateId: candidate.id, channelId, contactId: contact.id, status: 'ACTIVE' },
        })
      }

      // ── Disclaimer obrigatório no primeiro contato (Resolução TSE 23.755/2026) ──
      // É uma mensagem ATIVA (o agente fala antes de o eleitor receber resposta a nada) —
      // só é pulada se o limite de mensagens ativas tiver esgotado, mas isso é extremamente
      // raro acontecer logo no primeiro contato; ainda assim, a IA responde normalmente abaixo.
      if (isNewContact && activeMsgsAvailable) {
        const disclaimerText = agentConfig.disclaimer || DISCLAIMER_FALLBACK
        if (channelType === 'WHATSAPP') {
          await getWhatsAppProvider().sendText(channelId, from, disclaimerText)
        } else if (channelType === 'TELEGRAM') {
          const botToken = (channel.config as any).botToken
          await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, { chat_id: from, text: disclaimerText })
        }
        const disclaimerMsg = await prisma.message.create({
          data: { conversationId: conversation.id, senderType: 'AGENT', content: disclaimerText, isActiveMessage: true },
        })
        try { emitNewMessage(candidate.id, conversation.id, disclaimerMsg) } catch {}
        await prisma.candidate.update({ where: { id: candidate.id }, data: { activeMsgsUsed: { increment: 1 } } })
      }

      // Carregar histórico e salvar mensagem do eleitor em paralelo
      const [history, userMsg] = await Promise.all([
        prisma.message.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: 'asc' },
          take: 20,
        }),
        prisma.message.create({
          data: { conversationId: conversation.id, senderType: 'VOTER', content: text, mediaUrl: incomingMediaUrl, mediaType: incomingMediaType },
        }),
      ])

      await Promise.all([
        prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } }),
        Promise.resolve().then(() => { try { emitNewMessage(candidate.id, conversation.id, userMsg) } catch {} }),
      ])

      // ── Classificação para alertas automáticos (tema, gap de conteúdo, urgência) ──
      const topicsForAlerts = await prisma.platformTopic.findMany({ where: { candidateId: candidate.id } })
      const topicsWithContent = new Set(topicsForAlerts.filter(t => t.content && t.content.trim().length > 0).map(t => t.topicKey))
      const classification = await classifyMessageForAlerts(text, topicsWithContent)
      await prisma.message.update({
        where: { id: userMsg.id },
        data: { topicKey: classification.topicKey, isContentGap: classification.isContentGap },
      })
      if (classification.isUrgent) {
        const urgentConv = await prisma.conversation.update({ where: { id: conversation.id }, data: { status: 'URGENT' } })
        try { emitConversationUpdated(candidate.id, urgentConv) } catch {}
        console.log(`[WORKER] Conversa ${conversation.id} marcada como urgente automaticamente`)
      }

      // Relê o status no banco para evitar responder quando a equipe assumiu a conversa
      // entre a leitura inicial e este ponto (condição de corrida).
      const freshConversation = await prisma.conversation.findUnique({ where: { id: conversation.id }, select: { status: true, assignedToId: true } })
      if (freshConversation?.assignedToId) {
        console.log(`[WORKER] Silenciado: conversa ${conversation.id} foi assumida pela equipe`)
        return
      }

      // ── Preferência de resposta em áudio (espelha o formato do eleitor) ──────
      let audioPreference: 'audio' | 'text' | undefined = contact.audioPreference as 'audio' | 'text' | undefined

      const isAudioMessage = channelType === 'WHATSAPP' && incomingMediaType === 'audio'
      if (isAudioMessage) {
        if (audioPreference !== 'audio') {
          audioPreference = 'audio'
          await prisma.contact.update({ where: { id: contact.id }, data: { audioPreference: 'audio' } })
        }
      } else if (!audioPreference) {
        audioPreference = 'text'
      }

      const lowerText = text.trim().toLowerCase()
      if (lowerText === '#texto' || lowerText === '#audio' || lowerText === '#áudio') {
        const newPref = lowerText === '#texto' ? 'text' : 'audio'
        await prisma.contact.update({ where: { id: contact.id }, data: { audioPreference: newPref } })
        const confirmMsg = newPref === 'text' ? 'Perfeito! Responderei sempre em texto. ✍️' : 'Ótimo! Vou responder em áudio. 🎧'
        if (channelType === 'WHATSAPP') await getWhatsAppProvider().sendText(channelId, from, confirmMsg)
        const cfmMsg = await prisma.message.create({ data: { conversationId: conversation.id, senderType: 'AGENT', content: confirmMsg } })
        try { emitNewMessage(candidate.id, conversation.id, cfmMsg) } catch {}
        return
      }

      // Responder a uma mensagem que o eleitor mandou primeiro é sempre uma mensagem PASSIVA
      // (dentro da janela de atendimento) — não consome o limite de mensagens ativas, mesmo
      // que activeMsgsAvailable seja false. O limite só se aplica a envios iniciados pelo agente
      // (disclaimer no 1º contato, lembretes futuros, broadcasts).

      // ── Consulta de protocolo existente (seção 4.12 da spec) ────────────────
      const protocolMatch = text.match(/#?(EL-\d{4}-\d{5})/i)
      if (protocolMatch) {
        const statusMsg = await getRequestStatusMessage(candidate.id, protocolMatch[1].toUpperCase())
        if (statusMsg) {
          if (channelType === 'WHATSAPP') await getWhatsAppProvider().sendText(channelId, from, statusMsg)
          const replyMsg = await prisma.message.create({ data: { conversationId: conversation.id, senderType: 'AGENT', content: statusMsg } })
          try { emitNewMessage(candidate.id, conversation.id, replyMsg) } catch {}
          return
        }
      }

      // ── Registro de solicitação (pedido/reclamação → protocolo, seção 4.12) ──
      let requestContext = ''
      const requestIntent = await detectRequestIntent(text)
      if (requestIntent.isRequest) {
        const request = await createRequest({
          candidateId: candidate.id,
          contactId: contact.id,
          conversationId: conversation.id,
          subject: requestIntent.subject || text.slice(0, 100),
          description: text,
        })
        requestContext = `\n\n[CONTEXTO INTERNO — NÃO MENCIONE AO USUÁRIO ESTE TEXTO, MAS INFORME O PROTOCOLO NATURALMENTE NA SUA RESPOSTA: Esta mensagem foi identificada como uma solicitação e foi registrada com o protocolo ${request.protocolNumber}. Confirme o registro e informe este número de protocolo ao eleitor, e diga que a equipe entrará em contato em breve.]`
      }

      // ── Resposta via IA, restrita ao conteúdo cadastrado (Minha História + Plataforma Eleitoral) ──
      const topics = topicsForAlerts
      const conversationHistory = history.map((m) => ({
        role: (m.senderType === 'VOTER' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }))

      const alreadyIntroduced = history.some(m => m.senderType === 'AGENT' && m.content.length > 0)
      const contactContext = (isNewContact && !alreadyIntroduced)
        ? `\n\n[CONTEXTO INTERNO — NÃO MENCIONE AO USUÁRIO: Este é o PRIMEIRO contato desta pessoa. Apresente-se brevemente UMA única vez nesta mensagem.]`
        : `\n\n[CONTEXTO INTERNO — NÃO MENCIONE AO USUÁRIO: Você já se apresentou anteriormente. O nome desta pessoa é ${contact.name || 'o eleitor'}. NÃO diga seu nome novamente. Responda diretamente ao que foi perguntado.]`

      const agendaContext = await getAgendaContextForPrompt(candidate.id)
      const aiRes = await processAgentResponse({
        candidate,
        config: agentConfig,
        topics,
        conversationHistory,
        userMessage: text + contactContext + requestContext + agendaContext,
      })
      const responseText = aiRes.content

      if (agentConfig.responseDelay && agentConfig.responseDelay > 0) {
        const safeDelay = Math.min(agentConfig.responseDelay, 300)
        await new Promise((r) => setTimeout(r, safeDelay * 1000))
      }

      const aiMsg = await prisma.message.create({
        data: { conversationId: conversation.id, senderType: 'AGENT', content: responseText },
      })
      try { emitNewMessage(candidate.id, conversation.id, aiMsg) } catch {}

      const updatedConv = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      })
      try { emitConversationUpdated(candidate.id, updatedConv) } catch {}

      if (channelType === 'WHATSAPP') {
        const provider = getWhatsAppProvider()
        if (audioPreference === 'audio') {
          const audioBuffer = await generateSpeech(responseText, agentConfig.ttsVoice || 'onyx')
          if (audioBuffer && provider.sendAudioBase64) {
            await provider.sendAudioBase64(channelId, from, audioBuffer.toString('base64'))
          } else {
            await provider.sendText(channelId, from, responseText)
          }
        } else {
          await provider.sendText(channelId, from, responseText)
        }

        // Anexa o criativo ("Santinho") do tema identificado, se houver um cadastrado —
        // sempre em resposta a uma pergunta do eleitor, nunca disparo em massa.
        if (classification.topicKey) {
          const creative = await prisma.creative.findFirst({
            where: { candidateId: candidate.id, topicKey: classification.topicKey },
            orderBy: { createdAt: 'desc' },
          })
          if (creative) {
            await provider.sendMedia(channelId, from, creative.fileUrl, creative.title)
            const creativeMsg = await prisma.message.create({
              data: { conversationId: conversation.id, senderType: 'AGENT', content: creative.title, mediaUrl: creative.fileUrl, mediaType: creative.fileType },
            })
            try { emitNewMessage(candidate.id, conversation.id, creativeMsg) } catch {}
          }
        }
      } else if (channelType === 'TELEGRAM') {
        const botToken = (channel.config as any).botToken
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, { chat_id: from, text: responseText })
      } else if (channelType === 'META' || channelType === 'INSTAGRAM' || channelType === 'FACEBOOK') {
        const pageToken = (channel.config as any).pageAccessToken
        const pageId = (channel.config as any).pageId
        try {
          await axios.post(`https://graph.facebook.com/v21.0/${pageId}/messages`, {
            recipient: { id: from },
            message: { text: responseText },
            messaging_type: 'RESPONSE',
          }, { params: { access_token: pageToken } })
        } catch (sendErr: any) {
          console.error('[META-SEND] ERRO:', sendErr?.response?.data || sendErr?.message)
          throw sendErr
        }
      } else if (channelType === 'EMAIL' && emailMetadata) {
        const accessToken = await getValidGmailToken(channelId)
        if (accessToken) {
          await sendReply(accessToken, {
            threadId: emailMetadata.threadId,
            messageId: emailMetadata.messageId,
            references: emailMetadata.references,
            to: from,
            subject: emailMetadata.subject.toLowerCase().startsWith('re:') ? emailMetadata.subject : `Re: ${emailMetadata.subject}`,
            body: responseText,
          })
        } else {
          console.error('[EMAIL-SEND] Token inválido para canal', channelId)
        }
      }

      } catch (err: any) {
        console.error('[WORKER] ERRO:', err?.message || err, '| status:', err?.status ?? err?.response?.status, '| detalhe:', JSON.stringify(err?.error ?? err?.response?.data ?? {}))
        throw err // re-throw para BullMQ registrar como falha e fazer retry
      }
    },
    5
  )
}
