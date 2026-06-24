'use client'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket'

// Conecta o socket ao montar e desconecta ao desmontar
export function useSocketConnect() {
  const { candidate, token } = useAuthStore()

  useEffect(() => {
    if (!candidate?.id || !token) return
    connectSocket(candidate.id, token)
    return () => { disconnectSocket() }
  }, [candidate?.id, token])
}

// Escuta um evento específico do socket
export function useSocketEvent<T>(event: string, handler: (data: T) => void) {
  useEffect(() => {
    const s = getSocket()
    s.on(event, handler)
    return () => { s.off(event, handler) }
  }, [event, handler])
}
