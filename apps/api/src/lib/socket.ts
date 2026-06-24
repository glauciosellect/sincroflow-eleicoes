import { Server as SocketServer } from 'socket.io'
import type { Server as HttpServer } from 'http'

let io: SocketServer | null = null

export function initSocket(server: HttpServer, allowedOrigins: string[]) {
  io = new SocketServer(server, {
    cors: { origin: allowedOrigins, credentials: true },
    path: '/ws',
  })

  io.on('connection', (socket) => {
    // Cliente entra na sala do candidato dele
    socket.on('join:candidate', (candidateId: string) => {
      socket.join(`candidate:${candidateId}`)
    })

    socket.on('disconnect', () => {})
  })

  return io
}

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.io não foi inicializado')
  return io
}

// Emite nova mensagem para todos no candidato
export function emitNewMessage(candidateId: string, conversationId: string, message: object) {
  getIO().to(`candidate:${candidateId}`).emit('message:new', { conversationId, message })
}

// Emite mudança de status de conversa (ex: IA → espera → humano)
export function emitConversationUpdated(candidateId: string, conversation: object) {
  getIO().to(`candidate:${candidateId}`).emit('conversation:updated', conversation)
}
