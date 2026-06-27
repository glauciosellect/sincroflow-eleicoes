'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { CalendarDays, Plus, Loader2, MapPin, Link as LinkIcon, Trash2, Pencil, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const EVENT_TYPES = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'LIVE', label: 'Live' },
  { value: 'DEBATE', label: 'Debate' },
  { value: 'REUNIAO', label: 'Reunião' },
]

interface EventForm {
  title: string
  description: string
  eventType: string
  location: string
  neighborhood: string
  city: string
  link: string
  startsAt: string
  endsAt: string
  isPublic: boolean
}

const emptyForm: EventForm = { title: '', description: '', eventType: 'PRESENCIAL', location: '', neighborhood: '', city: '', link: '', startsAt: '', endsAt: '', isPublic: true }

export default function AgendaPage() {
  return (
    <Suspense>
      <AgendaContent />
    </Suspense>
  )
}

function AgendaContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EventForm>(emptyForm)

  // Vindo de Solicitações ("Agendar"): abre o formulário já com o assunto preenchido
  useEffect(() => {
    if (searchParams.get('openNew') === '1') {
      const title = searchParams.get('title') || ''
      setForm({ ...emptyForm, title, isPublic: false })
      setEditingId(null)
      setShowForm(true)
    }
  }, [searchParams])

  const { data: events, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get('/events').then(r => r.data),
  })

  const { data: googleStatus } = useQuery({
    queryKey: ['google-integration'],
    queryFn: () => api.get('/integrations/google').then(r => r.data),
    staleTime: 10 * 60 * 1000,
  })

  const saveMutation = useMutation({
    mutationFn: (data: EventForm) => {
      const payload = {
        ...data,
        startsAt: new Date(data.startsAt).toISOString(),
        endsAt: data.endsAt ? new Date(data.endsAt).toISOString() : null,
        link: data.link || null,
        location: data.location || null,
        neighborhood: data.neighborhood || null,
        city: data.city || null,
        description: data.description || null,
      }
      return editingId ? api.patch(`/events/${editingId}`, payload) : api.post('/events', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] })
      setShowForm(false); setEditingId(null); setForm(emptyForm)
      toast({ title: 'Evento salvo!' })
    },
    onError: (err: any) => toast({ title: 'Erro ao salvar evento', description: err.response?.data?.error, variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/events/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast({ title: 'Evento removido' }) },
  })

  const openEdit = (event: any) => {
    setEditingId(event.id)
    setForm({
      title: event.title,
      description: event.description || '',
      eventType: event.eventType,
      location: event.location || '',
      neighborhood: event.neighborhood || '',
      city: event.city || '',
      link: event.link || '',
      startsAt: event.startsAt.slice(0, 16),
      endsAt: event.endsAt ? event.endsAt.slice(0, 16) : '',
      isPublic: event.isPublic,
    })
    setShowForm(true)
  }

  const openNew = () => { setEditingId(null); setForm(emptyForm); setShowForm(true) }

  const now = new Date()
  const upcoming = (events || []).filter((e: any) => new Date(e.startsAt) >= now)
  const past = (events || []).filter((e: any) => new Date(e.startsAt) < now)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <p className="text-gray-500 text-sm mt-1">O assistente informa estes compromissos aos eleitores — nunca cria ou altera nada sozinho.</p>
        </div>
        <Button onClick={openNew} style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }} className="text-white">
          <Plus className="w-4 h-4 mr-2" /> Novo evento
        </Button>
      </div>

      {googleStatus?.connected ? (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Sincronizando automaticamente com {googleStatus.email} a cada 30 minutos.
        </div>
      ) : (
        <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          Conecte o Google Calendar em Integrações para importar eventos automaticamente — ou cadastre manualmente abaixo.
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#002776]" /></div>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Próximos eventos</h2>
            {upcoming.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-30" />
                Nenhum evento cadastrado
              </div>
            ) : (
              <div className="space-y-2">
                {upcoming.map((event: any) => <EventCard key={event.id} event={event} onEdit={openEdit} onDelete={(id) => deleteMutation.mutate(id)} />)}
              </div>
            )}
          </div>

          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Eventos passados</h2>
              <div className="space-y-2 opacity-60">
                {past.slice(0, 10).map((event: any) => <EventCard key={event.id} event={event} onEdit={openEdit} onDelete={(id) => deleteMutation.mutate(id)} />)}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? 'Editar evento' : 'Novo evento'}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto py-2">
            <div>
              <Label>Título *</Label>
              <Input className="mt-1" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Caminhada no Centro" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início *</Label>
                <Input type="datetime-local" className="mt-1" value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="datetime-local" className="mt-1" value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.eventType} onValueChange={v => setForm({ ...form, eventType: v })}>
                <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Local (endereço completo)</Label>
              <Input className="mt-1" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Rua, número" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bairro</Label>
                <Input className="mt-1" value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input className="mt-1" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Link (lives/transmissões)</Label>
              <Input className="mt-1" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea className="mt-1" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Aberto ao público</Label>
              <button onClick={() => setForm({ ...form, isPublic: !form.isPublic })} className={cn('w-11 h-6 rounded-full transition-colors', form.isPublic ? 'bg-[#009C3B]' : 'bg-gray-300')}>
                <div className={cn('w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5', form.isPublic ? 'translate-x-5' : 'translate-x-0')} />
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.title || !form.startsAt || saveMutation.isPending} style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }} className="text-white">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EventCard({ event, onEdit, onDelete }: { event: any; onEdit: (e: any) => void; onDelete: (id: string) => void }) {
  const date = new Date(event.startsAt).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return (
    <Card>
      <CardContent className="p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900">{event.title}</span>
            <Badge variant="secondary" className="text-xs">{EVENT_TYPES.find(t => t.value === event.eventType)?.label}</Badge>
            {!event.isPublic && <Badge variant="outline" className="text-xs">Interno</Badge>}
          </div>
          <div className="text-sm text-gray-500">{date}</div>
          {event.location && <div className="flex items-center gap-1 text-xs text-gray-400 mt-1"><MapPin className="w-3 h-3" />{event.location}{event.neighborhood ? ` — ${event.neighborhood}` : ''}</div>}
          {event.link && <a href={event.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#002776] mt-1 hover:underline"><LinkIcon className="w-3 h-3" />{event.link}</a>}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(event)} className="p-1.5 text-gray-400 hover:text-[#002776] hover:bg-blue-50 rounded"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => { if (confirm('Remover este evento?')) onDelete(event.id) }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
        </div>
      </CardContent>
    </Card>
  )
}
