'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Check, X, Search, Smartphone, MessageSquare } from 'lucide-react'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Painel interno do dono do sistema — fora do dashboard de candidato, sem JWT de
// usuário. Protegido por uma chave fixa (SYSTEM_ADMIN_KEY), digitada uma vez por
// sessão de navegador e enviada como header em toda chamada. Plano B para Pix/boleto
// pago direto na chave do CNPJ, fora do Stripe Checkout (que já cobre o caso comum).
function adminApi(key: string) {
  return axios.create({ baseURL: BASE_URL, headers: { 'X-System-Admin-Key': key } })
}

export default function AdminPage() {
  const [key, setKey] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [lineQty, setLineQty] = useState<Record<string, number>>({})
  const [msgQty, setMsgQty] = useState<Record<string, number>>({})

  useEffect(() => {
    const saved = localStorage.getItem('sf_admin_key')
    if (saved) { setKey(saved); setUnlocked(true) }
  }, [])

  const api = adminApi(key)

  const { data: pending, isLoading: loadingPending } = useQuery({
    queryKey: ['admin-pending-registrations'],
    queryFn: () => api.get('/system/pending-registrations').then(r => r.data),
    enabled: unlocked,
  })

  const { data: candidates, isLoading: loadingSearch } = useQuery({
    queryKey: ['admin-candidates-search', search],
    queryFn: () => api.get('/system/candidates/search', { params: { q: search } }).then(r => r.data),
    enabled: unlocked && search.trim().length >= 2,
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, paymentMethod }: { id: string; paymentMethod: 'pix' | 'boleto' }) =>
      api.post(`/system/pending-registrations/${id}/approve`, { paymentMethod }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-pending-registrations'] }),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/system/pending-registrations/${id}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-pending-registrations'] }),
  })

  const addLineMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      api.post(`/system/candidates/${id}/add-whatsapp-line`, { quantity }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-candidates-search'] }),
  })

  const addMsgsMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      api.post(`/system/candidates/${id}/add-active-msgs`, { quantity }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-candidates-search'] }),
  })

  const handleUnlock = () => {
    if (!key.trim()) return
    localStorage.setItem('sf_admin_key', key)
    setUnlocked(true)
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h1 className="text-lg font-bold text-gray-900">Painel administrativo</h1>
          <input
            type="password"
            placeholder="Chave de admin"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          />
          <button
            onClick={handleUnlock}
            className="w-full bg-gray-900 text-white rounded-lg py-2 text-sm font-medium"
          >
            Entrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Painel administrativo</h1>

        {/* Cadastros pendentes via Pix/boleto manual */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Cadastros pendentes</h2>
          {loadingPending ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : !pending?.length ? (
            <p className="text-sm text-gray-400">Nenhum cadastro pendente.</p>
          ) : (
            <div className="space-y-2">
              {pending.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                  <div>
                    <div className="font-medium text-sm text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-400">{p.email} · {p.whatsapp} · {p.paymentMethod} · {p.plan}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveMutation.mutate({ id: p.id, paymentMethod: p.paymentMethod === 'boleto' ? 'boleto' : 'pix' })}
                      disabled={approveMutation.isPending}
                      className="flex items-center gap-1 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg"
                    >
                      <Check className="w-3 h-3" /> Aprovar
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate(p.id)}
                      disabled={rejectMutation.isPending}
                      className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg"
                    >
                      <X className="w-3 h-3" /> Rejeitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Buscar candidato — liberar linha de WhatsApp / mensagens ativas */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Buscar candidato</h2>
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              placeholder="Nome, e-mail ou CPF"
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loadingSearch && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}

          <div className="space-y-3">
            {candidates?.map((c: any) => (
              <div key={c.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
                <div>
                  <div className="font-medium text-sm text-gray-900">{c.name}</div>
                  <div className="text-xs text-gray-400">{c.email} · {c.cpf} · {c.plan} · {c.status}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    WhatsApp: {c.whatsappLineLimit} linhas ({c.whatsappLinesManual} manuais) · Mensagens: {c.activeMsgsUsed}/{c.activeMsgsIncluded + c.activeMsgsExtra}
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      min={1}
                      className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm"
                      value={lineQty[c.id] ?? 1}
                      onChange={(e) => setLineQty({ ...lineQty, [c.id]: Number(e.target.value) })}
                    />
                    <button
                      onClick={() => addLineMutation.mutate({ id: c.id, quantity: lineQty[c.id] ?? 1 })}
                      disabled={addLineMutation.isPending}
                      className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg"
                    >
                      +linha WhatsApp
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      min={1}
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm"
                      value={msgQty[c.id] ?? 1000}
                      onChange={(e) => setMsgQty({ ...msgQty, [c.id]: Number(e.target.value) })}
                    />
                    <button
                      onClick={() => addMsgsMutation.mutate({ id: c.id, quantity: msgQty[c.id] ?? 1000 })}
                      disabled={addMsgsMutation.isPending}
                      className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg"
                    >
                      +mensagens ativas
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
