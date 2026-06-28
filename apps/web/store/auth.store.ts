import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  onboardingDone: boolean
  twoFactorEnabled: boolean
  language: string
  theme: string
}

interface Candidate {
  id: string
  name: string
  cpf: string
  email: string
  whatsapp: string
  candidateNumber: string | null
  party: string | null
  position: string | null
  state: string | null
  city: string | null
  photoUrl: string | null
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'
  plan: 'CAMPAIGN' | 'MANDATE'
  activeMsgsIncluded: number
  activeMsgsUsed: number
  activeMsgsExtra: number
  weeklyBriefingEnabled: boolean
  campaignPaymentMethod: 'card' | 'pix' | 'boleto' | null
  campaignPaidUntil: string | null
}

type TeamRole = 'ADMINISTRADOR' | 'ATENDIMENTO' | 'CONTEUDO' | 'RELATORIOS' | 'AGENTE_CAMPO'

interface AuthState {
  user: User | null
  candidate: Candidate | null
  role: TeamRole | null
  token: string | null
  refreshToken: string | null
  setAuth: (user: User, candidate: Candidate | null, token: string, refreshToken: string, role?: TeamRole) => void
  setUser: (user: Partial<User>) => void
  setCandidate: (candidate: Partial<Candidate>) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      candidate: null,
      role: null,
      token: null,
      refreshToken: null,
      setAuth: (user, candidate, token, refreshToken, role) => {
        localStorage.setItem('sf_token', token)
        localStorage.setItem('sf_refresh', refreshToken)
        set({ user, candidate, token, refreshToken, role: role ?? null })
      },
      setUser: (partial) => set((s) => ({ user: s.user ? { ...s.user, ...partial } : null })),
      setCandidate: (partial) => set((s) => ({ candidate: s.candidate ? { ...s.candidate, ...partial } : null })),
      logout: () => {
        localStorage.removeItem('sf_token')
        localStorage.removeItem('sf_refresh')
        set({ user: null, candidate: null, role: null, token: null, refreshToken: null })
      },
    }),
    { name: 'sf-auth', partialize: (s) => ({ user: s.user, candidate: s.candidate, role: s.role, token: s.token, refreshToken: s.refreshToken }) }
  )
)
