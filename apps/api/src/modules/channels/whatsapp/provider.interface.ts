export interface WhatsAppMessage {
  from: string
  name: string
  text?: string
  mediaUrl?: string
  mediaType?: 'image' | 'audio' | 'video' | 'document'
  messageId: string
  timestamp: number
}

export interface WhatsAppProvider {
  createInstance(channelId: string): Promise<void>
  deleteInstance(channelId: string): Promise<void>
  getQRCode(channelId: string): Promise<string>
  getStatus(channelId: string): Promise<'connected' | 'disconnected' | 'qr_required'>
  sendText(channelId: string, to: string, text: string): Promise<void>
  sendMedia(channelId: string, to: string, mediaUrl: string, caption?: string): Promise<void>
  sendAudio(channelId: string, to: string, audioUrl: string): Promise<void>
  sendAudioBase64?(channelId: string, to: string, audioBase64: string): Promise<void>
  // Envio de template WABA pré-aprovado pela Meta — único jeito de reabrir contato
  // fora da janela de 24h (ver seção "Janela de conversação" da spec). `params`
  // preenche as variáveis {{1}}, {{2}}... do corpo; `imageUrl` preenche o header
  // IMAGE quando o template tiver (ex: sae_novidade).
  sendTemplate?(channelId: string, to: string, templateName: string, languageCode: string, params?: string[], imageUrl?: string): Promise<void>
  parseWebhook(payload: unknown): WhatsAppMessage | null
  downloadMedia?(messageId: string, channelId?: string): Promise<{ fileURL?: string; transcription?: string; mimetype?: string; authHeader?: string }>
}
