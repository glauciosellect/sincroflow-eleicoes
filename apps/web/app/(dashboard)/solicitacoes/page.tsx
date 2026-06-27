'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import api from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, FileWarning, Loader2, Phone } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'

const STATUS_OPTIONS = [
  { value: 'RECEIVED', label: 'Recebido', color: 'bg-blue-100 text-blue-700' },
  { value: 'ANALYZING', label: 'Em análise', color: 'bg-amber-100 text-amber-700' },
  { value: 'FORWARDED', label: 'Encaminhado', color: 'bg-purple-100 text-purple-700' },
  { value: 'RESOLVED', label: 'Resolvido', color: 'bg-green-100 text-green-700' },
]
const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s]))

export default function SolicitacoesPage() {
  return (
    <Suspense>
      <SolicitacoesContent />
    </Suspense>
  )
}

function SolicitacoesContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['requests', search, statusFilter, page],
    queryFn: () => api.get('/requests', {
      params: { search: search || undefined, status: statusFilter !== 'all' ? statusFilter : undefined, page, limit: 20 },
    }).then(r => r.data),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/requests/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['requests'] }); toast({ title: 'Status atualizado!' }) },
    onError: (err: any) => toast({ title: 'Erro ao atualizar', description: err.response?.data?.error, variant: 'destructive' }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Solicitações</h1>
        <p className="text-gray-500 text-sm mt-1">Pedidos e reclamações registrados automaticamente pelo assistente, com protocolo</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Buscar por protocolo, assunto ou eleitor..." className="pl-10" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#002776]" /></div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-16">
          <FileWarning className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhuma solicitação ainda</h3>
          <p className="text-gray-400">Quando um eleitor fizer um pedido ou reclamação, o assistente registra aqui automaticamente</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Protocolo</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Assunto</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Eleitor</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Data</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.data || []).map((req: any) => (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{req.protocolNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{req.subject}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{req.contact?.name || 'Sem nome'}</div>
                      {req.contact?.phone && <div className="flex items-center gap-1 text-xs text-gray-400"><Phone className="w-3 h-3" />{req.contact.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(req.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Select value={req.status} onValueChange={(v) => updateStatus.mutate({ id: req.id, status: v })}>
                        <SelectTrigger className="h-7 text-xs w-36">
                          <Badge className={STATUS_MAP[req.status]?.color}>{STATUS_MAP[req.status]?.label}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Mostrando {((page - 1) * 20) + 1}–{Math.min(page * 20, data?.total || 0)} de {data?.total} solicitações</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded-md disabled:opacity-50 hover:bg-gray-50">Anterior</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= (data?.total || 0)} className="px-3 py-1 border rounded-md disabled:opacity-50 hover:bg-gray-50">Próximo</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
