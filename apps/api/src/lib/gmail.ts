import axios from 'axios'
import { refreshAccessToken } from './google'
import { logger } from './logger'

const GMAIL_API = 'https://www.googleapis.com/gmail/v1/users/me'
const GMAIL_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024 // limite da própria Gmail API

export interface GmailMessage {
  messageId: string
  threadId: string
  from: string
  fromName: string
  subject: string
  body: string
  references?: string
  timestamp: number
}

export function getGmailOAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'email',
      'profile',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// Token do Gmail é armazenado por Channel (não por Workspace, como o Calendar) —
// um workspace pode ter uma conta Gmail diferente da conta usada no Calendar.
export async function getValidGmailToken(channelId: string): Promise<string | null> {
  const { prisma } = await import('./prisma')
  const channel = await prisma.channel.findUnique({ where: { id: channelId } })
  const cfg = channel?.config as any
  if (!cfg?.accessToken) return null

  const expiry = cfg.tokenExpiry ? new Date(cfg.tokenExpiry).getTime() : 0
  if (Date.now() < expiry - 60_000) return cfg.accessToken

  if (!cfg.refreshToken) return null
  try {
    const tokens = await refreshAccessToken(cfg.refreshToken)
    await prisma.channel.update({
      where: { id: channelId },
      data: { config: { ...cfg, accessToken: tokens.access_token, tokenExpiry: new Date(tokens.expiry_date).toISOString() } },
    })
    return tokens.access_token
  } catch {
    return null
  }
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

function encodeBase64Url(data: string): string {
  return Buffer.from(data, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function extractHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
}

// Extrai o corpo em texto puro, priorizando text/plain; cai para uma versão
// simplificada do HTML se só houver text/html.
function extractPlainTextBody(payload: any): string {
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  if (payload.parts) {
    const plain = payload.parts.find((p: any) => p.mimeType === 'text/plain')
    if (plain?.body?.data) return decodeBase64Url(plain.body.data)
    const html = payload.parts.find((p: any) => p.mimeType === 'text/html')
    if (html?.body?.data) return decodeBase64Url(html.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    // multipart/alternative aninhado
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractPlainTextBody(part)
        if (nested) return nested
      }
    }
  }
  if (payload.body?.data) return decodeBase64Url(payload.body.data)
  return ''
}

export async function listNewMessages(accessToken: string, query: string): Promise<string[]> {
  const params = new URLSearchParams({ q: query, maxResults: '20' })
  const res = await fetch(`${GMAIL_API}/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json() as any
  if (!res.ok) {
    logger.error('[GMAIL] listNewMessages erro:', JSON.stringify(data))
    return []
  }
  return (data.messages || []).map((m: any) => m.id)
}

export async function getMessage(accessToken: string, messageId: string): Promise<GmailMessage | null> {
  const res = await fetch(`${GMAIL_API}/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json() as any
  if (!res.ok) {
    logger.error('[GMAIL] getMessage erro:', JSON.stringify(data))
    return null
  }

  const headers = data.payload?.headers || []
  const fromRaw = extractHeader(headers, 'From') // ex: "Nome Sobrenome <email@dominio.com>"
  const fromMatch = fromRaw.match(/<(.+)>/)
  const from = (fromMatch ? fromMatch[1] : fromRaw).trim().toLowerCase()
  const fromName = fromRaw.replace(/<.+>/, '').replace(/"/g, '').trim() || from

  const subject = extractHeader(headers, 'Subject')
  const messageIdHeader = extractHeader(headers, 'Message-ID')
  const referencesHeader = extractHeader(headers, 'References')
  const references = [referencesHeader, messageIdHeader].filter(Boolean).join(' ').trim()

  const body = extractPlainTextBody(data.payload).slice(0, 8000)

  return {
    messageId: messageIdHeader || data.id,
    threadId: data.threadId,
    from,
    fromName,
    subject,
    body,
    references,
    timestamp: data.internalDate ? parseInt(data.internalDate, 10) : Date.now(),
  }
}

export async function sendReply(accessToken: string, params: {
  threadId: string
  messageId: string
  references?: string
  to: string
  subject: string
  body: string
}): Promise<void> {
  const { threadId, messageId, references, to, subject, body } = params
  const raw = [
    `To: ${to}`,
    `Subject: ${encodeHeaderText(subject)}`,
    `In-Reply-To: ${messageId}`,
    `References: ${references || messageId}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
  ].join('\r\n')

  const res = await fetch(`${GMAIL_API}/messages/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encodeBase64Url(raw), threadId }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    logger.error('[GMAIL] sendReply erro:', JSON.stringify(data))
    throw new Error('Falha ao enviar resposta por e-mail')
  }
}

function detectExtension(url: string): string {
  return url.split('?')[0].split('.').pop()?.toLowerCase() || ''
}

function mimeTypeForExtension(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    mp4: 'video/mp4', mov: 'video/quicktime',
    pdf: 'application/pdf',
  }
  return map[ext] || 'application/octet-stream'
}

// Quebra base64 em linhas de 76 caracteres — padrão MIME (RFC 2045).
function wrapBase64(base64: string): string {
  return base64.replace(/(.{76})/g, '$1\r\n')
}

// Headers de e-mail (Subject, filename) só aceitam ASCII puro — texto com acentos
// precisa ser codificado em "encoded-word" (RFC 2047), senão chega corrompido
// (ex: "Educação" virando "EducaÃ§Ã£o" no cliente do destinatário).
function encodeHeaderText(text: string): string {
  if (/^[\x00-\x7F]*$/.test(text)) return text
  return `=?UTF-8?B?${Buffer.from(text, 'utf-8').toString('base64')}?=`
}

// Baixa o anexo e valida o limite de 25MB da Gmail API — usado tanto por respostas
// em thread existente quanto por e-mails novos (broadcast). Retorna null se a
// IO de download falhar ou o arquivo for grande demais, para o chamador decidir o
// fallback (enviar só texto, ou pular o destinatário no caso de broadcast).
async function downloadAttachmentForGmail(attachmentUrl: string): Promise<Buffer | null> {
  let attachmentBuffer: Buffer | null = null
  try {
    const res = await axios.get(attachmentUrl, { responseType: 'arraybuffer', timeout: 30000 })
    attachmentBuffer = Buffer.from(res.data)
  } catch (err: any) {
    logger.error('[GMAIL] Falha ao baixar anexo:', err?.message)
    return null
  }
  if (attachmentBuffer.byteLength > GMAIL_MAX_ATTACHMENT_BYTES) {
    logger.warn('[GMAIL] Anexo excede 25MB, ignorado', { bytes: attachmentBuffer.byteLength })
    return null
  }
  return attachmentBuffer
}

// Monta o bloco multipart/mixed (texto + anexo) reaproveitado tanto por respostas
// em thread quanto por e-mails novos — só os headers de cabeçalho (To/Subject/
// In-Reply-To/References) variam entre os dois casos.
function buildMultipartBody(body: string, attachmentBuffer: Buffer, attachmentUrl: string, attachmentName: string): { boundary: string; mimePart: string } {
  const boundary = `boundary_${Date.now()}`
  // O nome do arquivo precisa ter a extensão real (vinda da URL) — attachmentName é o
  // TÍTULO do criativo (ex: "lançamento"), sem extensão, então detectar o MIME type
  // por ele faria cair sempre no fallback genérico e o cliente de e-mail trataria como
  // arquivo desconhecido em vez de imagem.
  const ext = detectExtension(attachmentUrl)
  const mimeType = mimeTypeForExtension(ext)
  const safeFilename = `${attachmentName.replace(/[^\w\s-]/g, '').trim() || 'arquivo'}${ext ? `.${ext}` : ''}`
  const mimePart = [
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
    '',
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    `Content-Disposition: attachment; filename="${safeFilename}"`,
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(attachmentBuffer.toString('base64')),
    '',
    `--${boundary}--`,
  ].join('\r\n')
  return { boundary, mimePart }
}

// Mesmo fluxo de sendReply, mas anexando um arquivo (ex: criativo/"Santinho") via
// multipart/mixed. Se o anexo exceder o limite de 25MB da Gmail API, envia só o
// texto em vez de falhar — nunca bloqueia a resposta por causa do anexo.
export async function sendReplyWithAttachment(accessToken: string, params: {
  threadId: string
  messageId: string
  references?: string
  to: string
  subject: string
  body: string
  attachmentUrl: string
  attachmentName: string
}): Promise<void> {
  const { threadId, messageId, references, to, subject, body, attachmentUrl, attachmentName } = params

  const attachmentBuffer = await downloadAttachmentForGmail(attachmentUrl)
  if (!attachmentBuffer) {
    return sendReply(accessToken, { threadId, messageId, references, to, subject, body })
  }

  const { mimePart } = buildMultipartBody(body, attachmentBuffer, attachmentUrl, attachmentName)
  const raw = [
    `To: ${to}`,
    `Subject: ${encodeHeaderText(subject)}`,
    `In-Reply-To: ${messageId}`,
    `References: ${references || messageId}`,
    mimePart,
  ].join('\r\n')

  const res = await fetch(`${GMAIL_API}/messages/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encodeBase64Url(raw), threadId }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    logger.error('[GMAIL] sendReplyWithAttachment erro:', JSON.stringify(data))
    throw new Error('Falha ao enviar resposta com anexo por e-mail')
  }
}

// E-mail NOVO (não resposta a thread existente) com anexo — usado pelo disparo em
// massa (broadcast) de criativo por e-mail. Mesma validação de 25MB; se o anexo
// falhar, lança erro em vez de mandar só texto (no broadcast isso conta como falha
// daquele destinatário, não um envio silencioso sem o criativo prometido).
export async function sendNewEmailWithAttachment(accessToken: string, params: {
  to: string
  subject: string
  body: string
  attachmentUrl: string
  attachmentName: string
}): Promise<void> {
  const { to, subject, body, attachmentUrl, attachmentName } = params

  const attachmentBuffer = await downloadAttachmentForGmail(attachmentUrl)
  if (!attachmentBuffer) {
    throw new Error('Falha ao baixar o anexo do criativo — envio não realizado')
  }

  const { mimePart } = buildMultipartBody(body, attachmentBuffer, attachmentUrl, attachmentName)
  const raw = [
    `To: ${to}`,
    `Subject: ${encodeHeaderText(subject)}`,
    mimePart,
  ].join('\r\n')

  const res = await fetch(`${GMAIL_API}/messages/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encodeBase64Url(raw) }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    logger.error('[GMAIL] sendNewEmailWithAttachment erro:', JSON.stringify(data))
    throw new Error('Falha ao enviar e-mail com anexo')
  }
}

export async function markAsRead(accessToken: string, messageId: string): Promise<void> {
  await fetch(`${GMAIL_API}/messages/${messageId}/modify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
  }).catch(() => {})
}
