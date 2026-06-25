'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, Users, Phone, Mail, Download, QrCode, Loader2 } from 'lucide-react'
import { formatDate, channelLabel } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import { ChannelIcon } from '@/components/channel-icon'

const CONTACT_TYPE_LABELS: Record<string, string> = {
  VOTER: 'Eleitor',
  FAMILY_FRIEND: 'Família/Amigo',
  STAFF: 'Equipe',
  CONTRACTOR: 'Terceirizado',
  OTHER: 'Outro',
}

export default function ContactsPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [contactType, setContactType] = useState('')
  const [page, setPage] = useState(1)
  const [qrOpen, setQrOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search, contactType, page],
    queryFn: () => api.get('/contacts', { params: { search: search || undefined, contactType: contactType || undefined, page, limit: 20 } }).then(r => r.data),
  })

  const updateTypeMutation = useMutation({
    mutationFn: ({ id, contactType }: { id: string; contactType: string }) => api.patch(`/contacts/${id}`, { contactType }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
    onError: () => toast({ title: 'Erro ao reclassificar contato', variant: 'destructive' }),
  })

  const { data: qr, isLoading: loadingQr } = useQuery({
    queryKey: ['contacts-qrcode'],
    queryFn: () => api.get('/contacts/qrcode').then(r => r.data),
    enabled: qrOpen,
    retry: false,
  })

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await api.get('/contacts/export', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = 'contatos.csv'; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({ title: 'Erro ao exportar', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contatos</h1>
          <p className="text-gray-500 text-sm mt-1">Todos os eleitores que já interagiram com seu assistente</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
            <QrCode className="w-4 h-4 mr-2" /> QR Code
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Buscar por nome, telefone ou email..." className="pl-10" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          value={contactType}
          onChange={(e) => { setContactType(e.target.value); setPage(1) }}
        >
          <option value="">Todos os tipos</option>
          {Object.entries(CONTACT_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#002776]" /></div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhum contato ainda</h3>
          <p className="text-gray-400">Os eleitores aparecerão aqui quando interagirem com seu assistente</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Eleitor</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Tipo</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Canal</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Telefone</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">E-mail</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Interações</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Primeiro contato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.data || []).map((contact: any) => (
                  <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-[#002776]">
                          {contact.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="text-sm font-medium text-gray-900">{contact.name || 'Sem nome'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="text-xs border border-gray-200 rounded-full px-2 py-1"
                        value={contact.contactType}
                        onChange={(e) => updateTypeMutation.mutate({ id: contact.id, contactType: e.target.value })}
                      >
                        {Object.entries(CONTACT_TYPE_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <ChannelIcon type={contact.channel?.type} className="w-4 h-4" />
                        {channelLabel(contact.channel?.type)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-600">{contact.phone && <><Phone className="w-3 h-3 text-gray-400" />{contact.phone}</>}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-600">{contact.email && <><Mail className="w-3 h-3 text-gray-400" />{contact.email}</>}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{contact.totalInteractions}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(contact.firstContactAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Mostrando {((page - 1) * 20) + 1}–{Math.min(page * 20, data?.total || 0)} de {data?.total} contatos</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded-md disabled:opacity-50 hover:bg-gray-50">Anterior</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= (data?.total || 0)} className="px-3 py-1 border rounded-md disabled:opacity-50 hover:bg-gray-50">Próximo</button>
            </div>
          </div>
        </>
      )}

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>QR Code do seu WhatsApp</DialogTitle></DialogHeader>
          {loadingQr ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#002776]" /></div>
          ) : qr?.dataUrl ? (
            <div className="text-center space-y-3">
              <img src={qr.dataUrl} alt="QR Code" className="mx-auto rounded-lg border" />
              <p className="text-xs text-gray-500">Disponível para impressão em material de campanha</p>
              <a href={qr.dataUrl} download="qrcode-whatsapp.png">
                <Button size="sm" className="w-full"><Download className="w-4 h-4 mr-2" />Baixar em alta resolução</Button>
              </a>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-6">Conecte o WhatsApp em Configurações → Canais para gerar o QR Code.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
