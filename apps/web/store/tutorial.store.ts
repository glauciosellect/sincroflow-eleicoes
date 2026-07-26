import { create } from 'zustand'

interface TutorialState {
  isOpen: boolean
  open: () => void
  close: () => void
}

// Estado global (fora das páginas) para o Tutorial poder ficar aberto — como um
// card flutuante — enquanto o candidato navega e configura o sistema por trás,
// sem perder o progresso ao trocar de página.
export const useTutorialStore = create<TutorialState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
