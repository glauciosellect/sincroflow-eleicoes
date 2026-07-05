'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Users, Phone, Mail, Download, QrCode, Loader2, X, MessageCircle, MapPin, Calendar, ExternalLink } from 'lucide-react'
import { formatDate, channelLabel } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import { ChannelIcon } from '@/components/channel-icon'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const CONTACT_TYPE_LABELS: Record<string, string> = {
  VOTER: 'Eleitor',
  FAMILY_FRIEND: 'Família/Amigo',
  STAFF: 'Equipe',
  CONTRACTOR: 'Terceirizado',
  OTHER: 'Outro',
}


function ContactDrawer({ contact, onClose }: { contact: any; onClose: () => void }) {
  const router = useRouter()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(contact.notes || '')

  const { data: conversations, isLoading: loadingConvs } = useQuery({
    queryKey: ['contact-convs', contact.id],
    queryFn: () => api.get(`/contacts/${contact.id}/conversations`).then(r => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/contacts/${contact.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setEditing(false)
      toast({ title: 'Contato atualizado' })
    },
  })

  const origin = contact.channel?.type === 'WHATSAPP' ? 'WhatsApp' :
                 contact.channel?.type === 'INSTAGRAM' ? 'Instagram' :
                 contact.channel?.type === 'MESSENGER' ? 'Messenger' :
                 contact.channel?.type === 'EMAIL' ? 'Email' : 'Portal/Campo'

  const initials = (contact.name || '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* drawer */}
      <div className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="bg-[#002776] text-white px-6 pt-6 pb-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
                {initials}
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">{contact.name || 'Sem nome'}</h2>
                <p className="text-sm text-blue-200">{origin}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5 hover:bg-white/20">
                <Phone className="w-3.5 h-3.5" />{contact.phone}
              </a>
            )}
            {contact.email && (
              <span className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
                <Mail className="w-3.5 h-3.5" />{contact.email}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 px-5 py-4 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-[#002776]">{contact.totalInteractions}</p>
              <p className="text-xs text-gray-500 mt-0.5">Interações</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-[#002776]">{conversations?.length ?? '—'}</p>
              <p className="text-xs text-gray-500 mt-0.5">Conversas</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs font-semibold text-[#002776] mt-1">{CONTACT_TYPE_LABELS[contact.contactType] || contact.contactType}</p>
              <p className="text-xs text-gray-500 mt-0.5">Tipo</p>
            </div>
          </div>

          {/* Localização */}
          {contact.neighborhood && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
              {contact.neighborhood}
            </div>
          )}

          {/* Primeiro contato */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            Primeiro contato: {formatDate(contact.firstContactAt)}
          </div>

          {/* Anotações */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Anotações</p>
              {!editing && (
                <button onClick={() => setEditing(true)} className="text-xs text-[#002776] hover:underline">
                  {notes ? 'Editar' : 'Adicionar'}
                </button>
              )}
            </div>
            {editing ? (
              <div className="space-y-2">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Anote informações importantes sobre este eleitor..."
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776] resize-none"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateMutation.mutate({ notes })} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(false); setNotes(contact.notes || '') }}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5 min-h-[40px]">
                {notes || 'Nenhuma anotação ainda.'}
              </p>
            )}
          </div>

          {/* Conversas recentes */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Conversas</p>
            {loadingConvs ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
            ) : !conversations || conversations.length === 0 ? (
              <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-3 py-4 text-center">Nenhuma conversa registrada</p>
            ) : (
              <div className="space-y-2">
                {conversations.slice(0, 5).map((conv: any) => (
                  <button
                    key={conv.id}
                    onClick={() => router.push(`/chat?conversation=${conv.id}`)}
                    className="w-full flex items-center justify-between bg-gray-50 hover:bg-blue-50 rounded-xl px-4 py-3 text-left transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800 group-hover:text-[#002776]">
                        {conv.status === 'OPEN' ? 'Conversa aberta' : conv.status === 'RESOLVED' ? 'Resolvida' : 'Encerrada'}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(conv.createdAt)}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-[#002776]" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-4">
          {contact.phone && (
            <Button
              className="w-full text-white"
              style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }}
              onClick={() => {
                const phone = contact.phone?.replace(/\D/g, '')
                window.open(`https://wa.me/${phone}`, '_blank')
              }}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Abrir no WhatsApp
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ContactsPage() {
  return (
    <Suspense>
      <ContactsContent />
    </Suspense>
  )
}

function ContactsContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [contactType, setContactType] = useState('')
  const [page, setPage] = useState(1)
  const [qrOpen, setQrOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selected, setSelected] = useState<any>(null)

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
      {selected && <ContactDrawer contact={selected} onClose={() => setSelected(null)} />}

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
          <Input placeholder="Buscar por nome, telefone ou email..." className="pl-10" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
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
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">E-mail</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Interações</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Primeiro contato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.data || []).map((contact: any) => (
                  <tr
                    key={contact.id}
                    className="hover:bg-blue-50 transition-colors cursor-pointer"
                    onClick={() => setSelected(contact)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-[#002776] shrink-0">
                          {(contact.name || '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{contact.name || 'Sem nome'}</div>
                          {contact.neighborhood && <span className="text-xs text-gray-400">{contact.neighborhood}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
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
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        {contact.phone && <><Phone className="w-3 h-3 text-gray-400" />{contact.phone}</>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        {contact.email && <><Mail className="w-3 h-3 text-gray-400" />{contact.email}</>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{contact.totalInteractions}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">{formatDate(contact.firstContactAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Mostrando {Math.min(((page - 1) * 20) + 1, data?.total || 0)}–{Math.min(page * 20, data?.total || 0)} de {data?.total} contatos</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 border rounded-md disabled:opacity-50 hover:bg-gray-50">Anterior</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= (data?.total || 0)}
                className="px-3 py-1 border rounded-md disabled:opacity-50 hover:bg-gray-50">Próximo</button>
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
