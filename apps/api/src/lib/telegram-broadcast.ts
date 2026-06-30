import axios from 'axios'

// Envio de criativo via Telegram Bot API (seção 7.1 da spec) — canal principal de
// re-engajamento: sem janela de 24h, sem template aprovado, sem restrição de
// conteúdo político. Mapeia Creative.fileType ('image'|'video'|'document') para o
// método correspondente da Bot API.
export async function sendTelegramCreative(botToken: string, chatId: string, fileUrl: string, fileType: string, caption?: string) {
  const method = fileType === 'image' ? 'sendPhoto' : fileType === 'video' ? 'sendVideo' : 'sendDocument'
  const mediaField = fileType === 'image' ? 'photo' : fileType === 'video' ? 'video' : 'document'

  await axios.post(`https://api.telegram.org/bot${botToken}/${method}`, {
    chat_id: chatId,
    [mediaField]: fileUrl,
    caption,
  })
}
