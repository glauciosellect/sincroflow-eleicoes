'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search, MessageSquare, UserCheck, Bot, Send, Loader2,
  X, RotateCcw, ChevronRight, ChevronLeft, StickyNote,
  Phone, Mail, Clock, Pencil, FileText, AlertTriangle, Paperclip, Image as ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime, channelLabel } from '@/lib/utils'
import { useSocketConnect, useSocketEvent } from '@/hooks/use-socket'
import { ChannelIcon } from '@/components/channel-icon'

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch {}
}

const CONTACT_TYPE_LABELS: Record<string, string> = {
  VOTER: 'Eleitor',
  FAMILY_FRIEND: 'Família/Amigo',
  STAFF: 'Equipe',
  CONTRACTOR: 'Terceirizado',
  OTHER: 'Outro',
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-blue-100 text-blue-700',
  URGENT: 'bg-red-100 text-red-700',
  CLOSED: 'bg-gray-100 text-gray-500',
}
const statusLabels: Record<string, string> = { ACTIVE: 'Com agente', URGENT: 'Urgente', CLOSED: 'Encerrada' }

// ─── Coluna 3: Painel de Perfil do Eleitor ────────────────────────────────────
function ContactPanel({ contactId }: { contactId: string }) {
  const qc = useQueryClient()
  const [editingNote, setEditingNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [activeSection, setActiveSection] = useState<'info' | 'requests' | 'history'>('info')

  const { data: contact } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => api.get(`/contacts/${contactId}`).then(r => r.data),
    enabled: !!contactId,
  })

  const { data: history } = useQuery({
    queryKey: ['contact-history', contactId],
    queryFn: () => api.get(`/contacts/${contactId}/conversations`).then(r => r.data),
    enabled: !!contactId && activeSection === 'history',
  })

  const { data: requests } = useQuery({
    queryKey: ['requests', { contactId }],
    queryFn: () => api.get('/requests', { params: { contactId } }).then(r => r.data.data),
    enabled: !!contactId && activeSection === 'requests',
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/contacts/${contactId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact', contactId] }),
  })

  const handleSaveNote = () => {
    updateMutation.mutate({ notes: noteText })
    setEditingNote(false)
  }

  if (!contact) return (
    <div className="w-96 border-l border-gray-100 flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
    </div>
  )

  return (
    <div className="w-96 border-l border-gray-100 flex flex-col shrink-0 bg-white">
      <div className="p-4 border-b border-gray-100 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-2" style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}>
          {(contact.name || contact.phone || '?')[0].toUpperCase()}
        </div>
        <div className="font-semibold text-gray-900 text-sm">{contact.name || 'Sem nome'}</div>
        <div className="mt-1.5">
          <select
            className="text-xs border border-gray-200 rounded-full px-2 py-0.5 text-gray-600"
            value={contact.contactType}
            onChange={(e) => updateMutation.mutate({ contactType: e.target.value })}
          >
            {Object.entries(CONTACT_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        {contact.phone && <div className="flex items-center justify-center gap-1 mt-0.5 text-xs text-gray-400"><Phone className="w-3 h-3" />{contact.phone}</div>}
        {contact.email && <div className="flex items-center justify-center gap-1 mt-0.5 text-xs text-gray-400"><Mail className="w-3 h-3" />{contact.email}</div>}
        <div className="text-xs text-gray-400 mt-1">{contact.totalInteractions} interações</div>
      </div>

      <div className="flex border-b border-gray-100">
        {[
          { key: 'info', label: 'Info' },
          { key: 'requests', label: 'Solicitações' },
          { key: 'history', label: 'Histórico' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveSection(t.key as any)}
            className={cn('flex-1 py-2 text-xs font-medium transition-colors', activeSection === t.key ? 'text-[#002776] border-b-2 border-[#002776]' : 'text-gray-400 hover:text-gray-600')}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {activeSection === 'info' && (
          <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1"><StickyNote className="w-3 h-3" /> Notas internas</span>
                {!editingNote && (
                  <button onClick={() => { setNoteText(contact.notes || ''); setEditingNote(true) }} className="text-xs text-[#002776] hover:underline flex items-center gap-0.5">
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                )}
              </div>
              {editingNote ? (
                <div>
                  <textarea
                    className="w-full border border-input rounded-lg px-2 py-1.5 text-xs h-20 resize-none focus:outline-none focus:ring-1 focus:ring-[#002776]"
                    value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Anote observações sobre este eleitor..." autoFocus
                  />
                  <div className="flex gap-1 mt-1">
                    <Button size="sm" className="h-6 text-xs bg-[#002776]" onClick={handleSaveNote} disabled={updateMutation.isPending}>Salvar</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingNote(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 min-h-10 whitespace-pre-wrap">
                  {contact.notes || <span className="text-gray-300 italic">Sem notas</span>}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 pt-1">
              <Clock className="w-3 h-3" /> Eleitor desde {new Date(contact.firstContactAt).toLocaleDateString('pt-BR')}
            </div>
          </>
        )}

        {activeSection === 'requests' && (
          <div>
            {!requests ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
            ) : requests.length === 0 ? (
              <div className="text-center py-6"><p className="text-xs text-gray-400">Nenhuma solicitação registrada</p></div>
            ) : (
              <div className="space-y-2">
                {requests.map((req: any) => (
                  <div key={req.id} className="bg-gray-50 rounded-lg px-3 py-2">
                    <div className="text-xs font-mono text-gray-500">{req.protocolNumber}</div>
                    <div className="text-xs font-medium text-gray-800 mt-0.5">{req.subject}</div>
                    <Badge className="text-xs mt-1">{req.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === 'history' && (
          <div>
            {!history ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
            ) : history.length === 0 ? (
              <div className="text-center py-6"><MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" /><p className="text-xs text-gray-400">Nenhum atendimento anterior</p></div>
            ) : (
              <div className="space-y-2">
                {history.map((conv: any) => (
                  <div key={conv.id} className="bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <Badge className={cn('text-xs', statusColors[conv.status])}>{statusLabels[conv.status]}</Badge>
                    </div>
                    <div className="text-xs text-gray-400">{new Date(conv.startedAt).toLocaleDateString('pt-BR')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatContent />
    </Suspense>
  )
}

function ChatContent() {
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<any>(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState(searchParams.get('channelId') || 'all')
  const [message, setMessage] = useState('')
  const [showCreativePicker, setShowCreativePicker] = useState(false)

  const { data: creatives } = useQuery({
    queryKey: ['creatives'],
    queryFn: () => api.get('/creatives').then(r => r.data),
  })
  const [showProfile, setShowProfile] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useSocketConnect()

  const handleNewMessage = useCallback((data: { conversationId: string; message: any }) => {
    qc.setQueryData(['messages', data.conversationId], (old: any) => {
      if (!old) return old
      const exists = old.data?.some((m: any) => m.id === data.message.id)
      if (exists) return old
      return { ...old, data: [...(old.data || []), data.message] }
    })

    if (data.message.senderType === 'VOTER') {
      setSelected((prev: any) => {
        const isOpen = prev?.id === data.conversationId
        if (!isOpen) {
          playNotificationSound()
        }
        return prev
      })
    }

    qc.invalidateQueries({ queryKey: ['conversations'] })
  }, [qc])

  const handleConversationUpdated = useCallback((conv: any) => {
    qc.setQueryData(['conversations', filter, search, channelFilter], (old: any) => {
      if (!old) return old
      return { ...old, data: old.data?.map((c: any) => c.id === conv.id ? { ...c, ...conv } : c) }
    })
    setSelected((prev: any) => prev?.id === conv.id ? { ...prev, ...conv } : prev)
  }, [filter, search, channelFilter])

  useSocketEvent('message:new', handleNewMessage)
  useSocketEvent('conversation:updated', handleConversationUpdated)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [selected?.id])

  const { data: channels } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.get('/channels').then(r => r.data),
  })

  const { data: conversations } = useQuery({
    queryKey: ['conversations', filter, search, channelFilter],
    queryFn: () => api.get('/conversations', {
      params: {
        status: filter !== 'all' && filter !== 'mine' ? filter : undefined,
        assignedToMe: filter === 'mine' ? 'true' : undefined,
        search: search || undefined,
        channelId: channelFilter !== 'all' ? channelFilter : undefined,
      },
    }).then(r => r.data),
  })

  // Vindo de um link externo (ex: Relatórios → Perguntas Sem Resposta): abre direto
  // a conversa específica, sem o usuário precisar procurar na lista.
  useEffect(() => {
    const conversationId = searchParams.get('conversationId')
    if (conversationId && !selected) {
      api.get(`/conversations/${conversationId}`).then((res) => setSelected(res.data)).catch(() => {})
    }
  }, [searchParams])

  const { data: msgs } = useQuery({
    queryKey: ['messages', selected?.id],
    queryFn: () => api.get(`/conversations/${selected.id}/messages`).then(r => r.data),
    enabled: !!selected,
  })

  useEffect(() => { if (msgs) messagesEndRef.current?.scrollIntoView({ behavior: 'instant' }) }, [msgs])

  const assumeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/conversations/${id}/assume`),
    onSuccess: (res) => { setSelected((p: any) => p ? { ...p, ...res.data } : p); qc.invalidateQueries({ queryKey: ['conversations'] }) },
  })
  const releaseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/conversations/${id}/release`),
    onSuccess: (res) => { setSelected((p: any) => p ? { ...p, ...res.data } : p); qc.invalidateQueries({ queryKey: ['conversations'] }) },
  })
  const urgentMutation = useMutation({
    mutationFn: (id: string) => api.post(`/conversations/${id}/urgent`),
    onSuccess: (res) => { setSelected((p: any) => p ? { ...p, ...res.data } : p); qc.invalidateQueries({ queryKey: ['conversations'] }); qc.invalidateQueries({ queryKey: ['alerts-dashboard'] }) },
  })
  const unurgentMutation = useMutation({
    mutationFn: (id: string) => api.post(`/conversations/${id}/unurgent`),
    onSuccess: (res) => { setSelected((p: any) => p ? { ...p, ...res.data } : p); qc.invalidateQueries({ queryKey: ['conversations'] }); qc.invalidateQueries({ queryKey: ['alerts-dashboard'] }) },
  })
  const closeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/conversations/${id}/close`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conversations'] }); qc.invalidateQueries({ queryKey: ['alerts-dashboard'] }); setSelected(null) },
  })
  const sendMutation = useMutation({
    mutationFn: ({ id, content, mediaUrl, mediaType }: { id: string; content: string; mediaUrl?: string; mediaType?: string }) =>
      api.post(`/conversations/${id}/messages`, { content, mediaUrl, mediaType }),
    onSuccess: () => setMessage(''),
  })

  const sendCreative = (creative: any) => {
    sendMutation.mutate({ id: selected.id, content: creative.title, mediaUrl: creative.fileUrl, mediaType: creative.fileType })
    setShowCreativePicker(false)
  }

  const tabs = [
    { key: 'all', label: 'Todos' },
    { key: 'URGENT', label: 'Urgentes' },
    { key: 'ACTIVE', label: 'Ativas' },
    { key: 'mine', label: 'Minhas' },
  ]

  const handleSelectConversation = useCallback((conv: any) => { setSelected(conv) }, [])

  const isAssignedToMe = !!selected?.assignedToId

  return (
    <div className="h-full flex -m-4 md:-m-6 bg-white rounded-lg overflow-hidden border border-gray-200">
      <div className={cn('border-r border-gray-100 flex flex-col shrink-0 w-full md:w-96', selected ? 'hidden md:flex' : 'flex')}>
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Buscar conversa..." className="pl-9 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {(channels?.length || 0) > 1 && (
            <select className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 mt-2 text-gray-700 bg-white" value={channelFilter} onChange={e => setChannelFilter(e.target.value)}>
              <option value="all">Todos os canais</option>
              {(channels || []).map((c: any) => <option key={c.id} value={c.id}>{channelLabel(c.type)} — {c.name}</option>)}
            </select>
          )}
          <div className="flex gap-1 mt-2">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setFilter(t.key)}
                className={cn('text-xs px-2 py-1 rounded-md flex-1 transition-colors', filter === t.key ? 'bg-[#002776] text-white' : 'text-gray-500 hover:bg-gray-50')}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations?.data?.length === 0 && (
            <div className="text-center py-12"><MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-2" /><p className="text-sm text-gray-400">Nenhuma conversa</p></div>
          )}
          {(conversations?.data || []).map((conv: any) => (
            <button key={conv.id} onClick={() => handleSelectConversation(conv)}
              className={cn('w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors', selected?.id === conv.id ? 'bg-blue-50 border-l-2 border-l-[#002776]' : '')}>
              <div className="flex items-start justify-between gap-2">
                <ChannelIcon type={conv.channel?.type} className="w-7 h-7 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm truncate text-gray-900">{conv.contact?.name || conv.contact?.phone || 'Desconhecido'}</span>
                    <span className="text-xs text-gray-400 shrink-0">{channelLabel(conv.channel?.type)}</span>
                  </div>
                  <p className="text-xs truncate text-gray-400">{conv.messages?.[0]?.content || 'Sem mensagens'}</p>
                </div>
                <Badge className={cn('text-xs', statusColors[conv.status])}>{statusLabels[conv.status]}</Badge>
              </div>
              <p className="text-xs text-gray-300 mt-1">{formatDateTime(conv.lastMessageAt)}</p>
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => setSelected(null)} className="md:hidden p-1 rounded-lg text-gray-400 hover:bg-gray-100 shrink-0"><ChevronLeft className="w-5 h-5" /></button>
              <ChannelIcon type={selected.channel?.type} className="w-8 h-8 shrink-0" />
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{selected.contact?.name || selected.contact?.phone || 'Desconhecido'}</h3>
                <p className="text-xs text-gray-400">
                  {channelLabel(selected.channel?.type)} ·{' '}
                  <span className={cn('font-medium', { 'text-blue-600': selected.status === 'ACTIVE', 'text-red-600': selected.status === 'URGENT', 'text-gray-500': selected.status === 'CLOSED' })}>
                    {statusLabels[selected.status]}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {!isAssignedToMe ? (
                <Button size="sm" onClick={() => assumeMutation.mutate(selected.id)} disabled={assumeMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs">
                  <UserCheck className="w-3 h-3 mr-1" />Assumir
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => releaseMutation.mutate(selected.id)} disabled={releaseMutation.isPending} className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50">
                  <RotateCcw className="w-3 h-3 mr-1" />Devolver ao agente
                </Button>
              )}
              {selected.status !== 'URGENT' && (
                <Button size="sm" variant="outline" onClick={() => urgentMutation.mutate(selected.id)} disabled={urgentMutation.isPending} className="h-7 text-xs text-red-500 border-red-200 hover:bg-red-50">
                  <AlertTriangle className="w-3 h-3 mr-1" />Marcar urgente
                </Button>
              )}
              {selected.status === 'URGENT' && (
                <Button size="sm" variant="outline" onClick={() => unurgentMutation.mutate(selected.id)} disabled={unurgentMutation.isPending} className="h-7 text-xs text-gray-500 border-gray-200 hover:bg-gray-50">
                  <AlertTriangle className="w-3 h-3 mr-1" />Remover urgência
                </Button>
              )}
              {selected.status !== 'CLOSED' && (
                <Button size="sm" variant="outline" onClick={() => closeMutation.mutate(selected.id)} disabled={closeMutation.isPending} className="h-7 text-xs text-gray-500 border-gray-200 hover:bg-gray-50">
                  <X className="w-3 h-3 mr-1" />Encerrar
                </Button>
              )}
              <button onClick={() => setShowProfile(p => !p)} className={cn('p-1.5 rounded-lg border transition-colors', showProfile ? 'bg-blue-50 border-blue-200 text-[#002776]' : 'border-gray-200 text-gray-400 hover:bg-gray-50')} title="Ver perfil do eleitor">
                <ChevronRight className={cn('w-4 h-4 transition-transform', showProfile ? 'rotate-180' : '')} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {(msgs?.data || []).map((msg: any) => (
              <div key={msg.id} className={cn('flex', msg.senderType === 'VOTER' ? 'justify-start' : 'justify-end')}>
                <div className={cn('max-w-xs lg:max-w-sm rounded-2xl px-4 py-2.5 text-sm',
                  msg.senderType === 'VOTER' ? 'bg-gray-100 text-gray-800' :
                  msg.senderType === 'HUMAN' ? 'bg-green-600 text-white' : 'bg-[#002776] text-white')}>
                  {msg.senderType === 'AGENT' && (
                    <div className="flex items-center gap-1 mb-1 opacity-70"><Bot className="w-3 h-3" /><span className="text-xs">Assistente</span></div>
                  )}
                  {msg.mediaUrl && msg.mediaType === 'audio' && <audio controls src={msg.mediaUrl} className="mb-1.5 max-w-full" />}
                  {msg.mediaUrl && msg.mediaType === 'image' && (
                    <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer"><img src={msg.mediaUrl} alt="Imagem enviada" className="mb-1.5 max-w-full rounded-lg" /></a>
                  )}
                  {msg.mediaUrl && msg.mediaType && msg.mediaType !== 'audio' && msg.mediaType !== 'image' && (
                    <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 mb-1.5 underline text-sm"><FileText className="w-3.5 h-3.5" />Ver documento</a>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <div className={cn('text-xs mt-1 opacity-60', msg.senderType !== 'VOTER' ? 'text-right' : '')}>
                    {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {isAssignedToMe && (
            <div className="p-4 border-t border-gray-100 relative">
              {showCreativePicker && (
                <div className="absolute bottom-full left-4 mb-2 w-72 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg p-2 space-y-1 z-10">
                  {!creatives?.length ? (
                    <p className="text-xs text-gray-400 p-3 text-center">Nenhum criativo cadastrado. Adicione em Agente → Criativos.</p>
                  ) : (
                    creatives.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => sendCreative(c)}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-left"
                      >
                        {c.fileType === 'image' ? (
                          <img src={c.fileUrl} alt={c.title} className="w-10 h-10 object-cover rounded" />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center"><ImageIcon className="w-4 h-4 text-gray-300" /></div>
                        )}
                        <span className="text-sm text-gray-700 truncate">{c.title}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => setShowCreativePicker(!showCreativePicker)} title="Anexar criativo">
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Input value={message} onChange={e => setMessage(e.target.value)} placeholder="Digite sua mensagem..."
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && message.trim()) { e.preventDefault(); sendMutation.mutate({ id: selected.id, content: message }) } }} />
                <Button onClick={() => sendMutation.mutate({ id: selected.id, content: message })} disabled={!message.trim() || sendMutation.isPending} className="bg-[#002776] hover:bg-[#002776]/90">
                  {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageSquare className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Conversas com eleitores</h3>
            <p className="text-gray-400 text-sm">Selecione uma conversa para visualizar</p>
          </div>
        </div>
      )}

      {selected && showProfile && selected.contactId && <ContactPanel contactId={selected.contactId} />}
    </div>
  )
}
