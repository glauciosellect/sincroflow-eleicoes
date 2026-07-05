'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import {
  Globe, Settings, Users, Download, ExternalLink, Copy, CheckCircle2,
  ChevronLeft, ChevronRight, Loader2, Search, Trash2, Phone, Mail, MapPin,
  UserPlus, RefreshCw, Plus, X, Instagram, Facebook
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

const trajetoriaSchema = z.object({ ano: z.string().max(10), descricao: z.string().max(300) })
const depoimentoSchema = z.object({ texto: z.string().max(500), autor: z.string().max(100) })

const configSchema = z.object({
  slug: z.string().min(3).max(60).regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens'),
  titulo: z.string().min(3).max(120),
  subtitulo: z.string().max(200).optional(),
  descricao: z.string().max(2000).optional(),
  fotoUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  corPrimaria: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#002776'),
  corDestaque: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#C9A227'),
  numero: z.string().max(20).optional(),
  instagram: z.string().max(100).optional(),
  facebook: z.string().max(100).optional(),
  tiktok: z.string().max(100).optional(),
  whatsapp: z.string().max(20).optional(),
  trajetoria: z.array(trajetoriaSchema).optional(),
  depoimentos: z.array(depoimentoSchema).optional(),
  ativo: z.boolean().default(true),
})
type ConfigForm = z.infer<typeof configSchema>

interface Portal {
  id: string; slug: string; titulo: string; subtitulo?: string; descricao?: string
  fotoUrl?: string; corPrimaria: string; corDestaque: string; numero?: string
  instagram?: string; facebook?: string; tiktok?: string; whatsapp?: string
  trajetoria?: { ano: string; descricao: string }[]
  depoimentos?: { texto: string; autor: string }[]
  ativo: boolean; totalCadastros: number
}

interface Cadastro {
  id: string; nome: string; telefone: string; email?: string
  cidade?: string; bairro?: string; assunto?: string; mensagem?: string
  status: string; createdAt: string; contactId?: string | null
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  novo: { label: 'Novo', color: 'bg-blue-100 text-blue-700' },
  contatado: { label: 'Contatado', color: 'bg-amber-100 text-amber-700' },
  convertido: { label: 'Convertido', color: 'bg-green-100 text-green-700' },
  spam: { label: 'Spam', color: 'bg-gray-100 text-gray-500' },
}

export default function PortalPage() {
  const [tab, setTab] = useState<'config' | 'cadastros'>('config')
  const [copied, setCopied] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const { toast } = useToast()
  const qc = useQueryClient()

  const { data: portal, isLoading: portalLoading } = useQuery<Portal | null>({
    queryKey: ['portal'],
    queryFn: () => api.get('/portal').then(r => r.data),
  })

  const { data: cadastrosData, isLoading: cadastrosLoading } = useQuery({
    queryKey: ['portal-cadastros', page, search, statusFilter],
    queryFn: () => api.get('/portal/cadastros', { params: { page, search: search || undefined, status: statusFilter || undefined } }).then(r => r.data),
    enabled: tab === 'cadastros',
  })

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<ConfigForm>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      slug: '', titulo: '', subtitulo: '', descricao: '', fotoUrl: '',
      corPrimaria: '#002776', corDestaque: '#C9A227', numero: '', instagram: '',
      facebook: '', tiktok: '', whatsapp: '',
      trajetoria: [{ ano: '', descricao: '' }],
      depoimentos: [{ texto: '', autor: '' }],
      ativo: true,
    },
  })

  const { fields: trajFields, append: trajAppend, remove: trajRemove } = useFieldArray({ control, name: 'trajetoria' })
  const { fields: depFields, append: depAppend, remove: depRemove } = useFieldArray({ control, name: 'depoimentos' })

  useEffect(() => {
    if (portal) {
      reset({
        ...portal,
        fotoUrl: portal.fotoUrl ?? '',
        numero: portal.numero ?? '',
        instagram: portal.instagram ?? '',
        facebook: portal.facebook ?? '',
        tiktok: portal.tiktok ?? '',
        whatsapp: portal.whatsapp ?? '',
        trajetoria: portal.trajetoria?.length ? portal.trajetoria : [{ ano: '', descricao: '' }],
        depoimentos: portal.depoimentos?.length ? portal.depoimentos : [{ texto: '', autor: '' }],
      })
    }
  }, [portal, reset])

  const saveMutation = useMutation({
    mutationFn: (data: ConfigForm) => api.post('/portal', {
      ...data,
      fotoUrl: data.fotoUrl || null,
      numero: data.numero || null,
      instagram: data.instagram || null,
      facebook: data.facebook || null,
      tiktok: data.tiktok || null,
      whatsapp: data.whatsapp || null,
      trajetoria: data.trajetoria?.filter(t => t.ano && t.descricao) ?? [],
      depoimentos: data.depoimentos?.filter(d => d.texto && d.autor) ?? [],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal'] })
      toast({ title: 'Portal salvo com sucesso!' })
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar', description: e.response?.data?.error, variant: 'destructive' }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/portal/cadastros/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-cadastros'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/portal/cadastros/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-cadastros'] }),
  })

  const [syncingId, setSyncingId] = useState<string | null>(null)
  const syncOne = async (id: string) => {
    setSyncingId(id)
    try {
      await api.post(`/portal/cadastros/${id}/sync-contact`)
      qc.invalidateQueries({ queryKey: ['portal-cadastros'] })
      toast({ title: 'Contato sincronizado!' })
    } catch (e: any) {
      toast({ title: 'Erro ao sincronizar', description: e.response?.data?.error, variant: 'destructive' })
    } finally { setSyncingId(null) }
  }

  const [syncingAll, setSyncingAll] = useState(false)
  const syncAll = async () => {
    setSyncingAll(true)
    try {
      const { data } = await api.post('/portal/cadastros/sync-all')
      qc.invalidateQueries({ queryKey: ['portal-cadastros'] })
      toast({ title: `${data.synced} contato(s) sincronizado(s) de ${data.total} pendente(s).` })
    } catch (e: any) {
      toast({ title: 'Erro ao sincronizar', description: e.response?.data?.error, variant: 'destructive' })
    } finally { setSyncingAll(false) }
  }

  const copyLink = () => {
    if (!portal) return
    navigator.clipboard.writeText(`https://app.syncrofloweleicoes.com.br/eleitor/${portal.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const exportCsv = () => {
    window.open(`${process.env.NEXT_PUBLIC_API_URL ?? 'https://api.syncrofloweleicoes.com.br'}/portal/cadastros/export`, '_blank')
  }

  const portalUrl = portal ? `https://app.syncrofloweleicoes.com.br/eleitor/${portal.slug}` : null

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portal do Eleitor</h1>
          <p className="text-sm text-gray-500 mt-1">Sua landing page pública para captar apoiadores — compartilhe o link e receba cadastros.</p>
        </div>
        {portal && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyLink} className="gap-2">
              {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              Copiar link
            </Button>
            <a href={`/eleitor/${portal.slug}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="w-4 h-4" />Ver portal
              </Button>
            </a>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { key: 'config', label: 'Configurações', icon: Settings },
          { key: 'cadastros', label: `Cadastros${portal ? ` (${portal.totalCadastros})` : ''}`, icon: Users },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-[#002776] text-[#002776]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ─── Config Tab ─── */}
      {tab === 'config' && (
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-6">

          {/* Guia rápido */}
          <div className="rounded-2xl border border-[#002776]/20 bg-gradient-to-br from-[#EFF6FF] to-[#F0FDF4] p-5">
            <h2 className="text-base font-bold text-[#002776] mb-1">🗺️ Como montar sua página pública</h2>
            <p className="text-sm text-gray-600 mb-4">
              Seu Portal do Eleitor é uma <strong>landing page completa</strong> no estilo de campanha profissional. Preencha as seções abaixo e clique em <strong>"Salvar"</strong> — o sistema já busca automaticamente sua foto, história e propostas cadastradas em <em>Minha História e Propostas</em>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                { num: '1', icon: '🔗', title: 'Endereço (slug)', desc: 'O link que você vai compartilhar. Use seu nome: ex. joao-silva45' },
                { num: '2', icon: '🎨', title: 'Cores da campanha', desc: 'Cor principal (fundo do hero) e cor de destaque (botões, linha do tempo). Combine com seu material gráfico.' },
                { num: '3', icon: '🗓️', title: 'Trajetória', desc: 'Adicione marcos da sua história política (ano + descrição) — aparecem como linha do tempo.' },
                { num: '4', icon: '💬', title: 'Depoimentos', desc: 'Frases de apoiadores ou lideranças que te indicam — criam prova social poderosa.' },
                { num: '5', icon: '📱', title: 'Redes sociais', desc: 'Instagram, Facebook, TikTok e WhatsApp — exibidos no rodapé da sua página.' },
                { num: '6', icon: '👁️', title: 'Visualize e compartilhe', desc: 'Clique em "Ver portal" para conferir. Depois copie o link e publique nas redes.' },
              ].map(s => (
                <div key={s.num} className="flex gap-3 bg-white rounded-xl p-3 border border-gray-100">
                  <div className="w-7 h-7 rounded-full bg-[#002776] text-white text-xs font-bold flex items-center justify-center shrink-0">{s.num}</div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{s.icon} {s.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <span className="text-base shrink-0">💡</span>
              <p><strong>Dica:</strong> Foto, história e propostas são puxadas automaticamente de <em>Minha História e Propostas</em>. Quanto mais completo esse cadastro, mais rica fica sua landing page — sem precisar repetir informações aqui.</p>
            </div>
          </div>

          {/* Seção 1 — Identidade básica */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Identidade e link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Slug (URL) *</label>
                  <div className="flex items-center border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-[#002776]">
                    <span className="px-3 py-2 bg-gray-50 text-gray-500 text-sm border-r whitespace-nowrap">/eleitor/</span>
                    <input {...register('slug')} placeholder="nome-candidato45" className="flex-1 px-3 py-2 text-sm outline-none" />
                  </div>
                  {errors.slug && <p className="text-xs text-red-600">{errors.slug.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Número eleitoral</label>
                  <Input {...register('numero')} placeholder="ex: 45678" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Título do portal *</label>
                <Input {...register('titulo')} placeholder="ex: João Silva — Deputado Estadual" />
                {errors.titulo && <p className="text-xs text-red-600">{errors.titulo.message}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Subtítulo / Slogan</label>
                <Input {...register('subtitulo')} placeholder="ex: Juntos por uma cidade mais justa e humana" />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Mensagem ao eleitor</label>
                <Textarea {...register('descricao')} rows={3} placeholder="Escreva por que o eleitor deve te apoiar. Aparece logo abaixo do hero." />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">URL da foto do candidato</label>
                <Input {...register('fotoUrl')} placeholder="https://..." />
                <p className="text-xs text-gray-400">Dica: hospede em imgbb.com (gratuito) e cole o "Direct link". Se não preencher, usa a foto já cadastrada no sistema.</p>
                {errors.fotoUrl && <p className="text-xs text-red-600">{errors.fotoUrl.message}</p>}
              </div>

              {/* Paleta de cores */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Cor principal</label>
                  <p className="text-xs text-gray-400 -mt-0.5">Fundo do cabeçalho (hero)</p>
                  <div className="flex items-center gap-2">
                    <input type="color" {...register('corPrimaria')} className="h-10 w-14 rounded-md border cursor-pointer" />
                    <input {...register('corPrimaria')} className="flex-1 border rounded-md px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-[#002776]" placeholder="#002776" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Cor de destaque</label>
                  <p className="text-xs text-gray-400 -mt-0.5">Botões, linha do tempo, bordas</p>
                  <div className="flex items-center gap-2">
                    <input type="color" {...register('corDestaque')} className="h-10 w-14 rounded-md border cursor-pointer" />
                    <input {...register('corDestaque')} className="flex-1 border rounded-md px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-[#002776]" placeholder="#C9A227" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" {...register('ativo')} id="ativo" className="w-4 h-4 rounded" />
                <label htmlFor="ativo" className="text-sm text-gray-700">Portal ativo (visível publicamente)</label>
              </div>
            </CardContent>
          </Card>

          {/* Seção 2 — Trajetória */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">🗓️ Trajetória política</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => trajAppend({ ano: '', descricao: '' })} className="gap-1">
                <Plus className="w-3.5 h-3.5" />Adicionar marco
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">Marcos da sua história (aparecem como linha do tempo na página). Ex: 2012 — "Início como assistente social na rede municipal".</p>
              {trajFields.map((field, idx) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <input
                    {...register(`trajetoria.${idx}.ano`)}
                    placeholder="Ano"
                    className="w-20 border rounded-md px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-[#002776]"
                  />
                  <input
                    {...register(`trajetoria.${idx}.descricao`)}
                    placeholder="Descreva o que aconteceu neste ano..."
                    className="flex-1 border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#002776]"
                  />
                  <button type="button" onClick={() => trajRemove(idx)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Seção 3 — Depoimentos */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">💬 Depoimentos de apoio</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => depAppend({ texto: '', autor: '' })} className="gap-1">
                <Plus className="w-3.5 h-3.5" />Adicionar depoimento
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">Frases de apoiadores, líderes ou comunidades — aparecem na seção de prova social da sua landing page.</p>
              {depFields.map((field, idx) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <input
                      {...register(`depoimentos.${idx}.texto`)}
                      placeholder="Depoimento de apoio..."
                      className="w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#002776]"
                    />
                    <input
                      {...register(`depoimentos.${idx}.autor`)}
                      placeholder="Autor — ex: Maria Silva, moradora do Jardim das Flores"
                      className="w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#002776]"
                    />
                  </div>
                  <button type="button" onClick={() => depRemove(idx)} className="p-2 text-gray-400 hover:text-red-500 transition-colors mt-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Seção 4 — Redes sociais */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">📱 Redes sociais e contato</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><Instagram className="w-3.5 h-3.5" />Instagram</label>
                <Input {...register('instagram')} placeholder="@seuinstagram" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><Facebook className="w-3.5 h-3.5" />Facebook</label>
                <Input {...register('facebook')} placeholder="facebook.com/suapagina" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">TikTok</label>
                <Input {...register('tiktok')} placeholder="@seutiktok" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />WhatsApp (somente números)</label>
                <Input {...register('whatsapp')} placeholder="5511999990000" />
              </div>
            </CardContent>
          </Card>

          {portal && (
            <div className="flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
              <Globe className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-blue-800">Link do seu portal</p>
                <p className="text-xs text-blue-600 truncate">{portalUrl}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || saveMutation.isPending} className="bg-[#002776] hover:bg-[#001f5e] gap-2 px-8">
              {(isSubmitting || saveMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              {portal ? 'Salvar alterações' : 'Criar portal'}
            </Button>
          </div>
        </form>
      )}

      {/* ─── Cadastros Tab ─── */}
      {tab === 'cadastros' && (
        <div className="space-y-4">
          {!portal ? (
            <div className="text-center py-12 text-gray-500">
              <Globe className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Configure o portal primeiro na aba Configurações.</p>
            </div>
          ) : (
            <>
              <div className="flex gap-3 items-center">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar por nome, telefone ou email..." className="pl-9" />
                </div>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="border rounded-md px-3 py-2 text-sm text-gray-700 bg-white">
                  <option value="">Todos os status</option>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2 shrink-0">
                  <Download className="w-4 h-4" />Exportar CSV
                </Button>
                <Button variant="outline" size="sm" onClick={syncAll} disabled={syncingAll} className="gap-2 shrink-0">
                  {syncingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Sincronizar todos
                </Button>
              </div>

              {cadastrosLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
              ) : cadastrosData?.items?.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p>Nenhum cadastro encontrado.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cadastrosData?.items?.map((c: Cadastro) => (
                    <Card key={c.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900 text-sm">{c.nome}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_LABEL[c.status]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                                {STATUS_LABEL[c.status]?.label ?? c.status}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.telefone}</span>
                              {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                              {(c.cidade || c.bairro) && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />{[c.bairro, c.cidade].filter(Boolean).join(', ')}
                                </span>
                              )}
                            </div>
                            {c.assunto && <p className="text-xs text-gray-600 font-medium">Assunto: {c.assunto}</p>}
                            {c.mensagem && <p className="text-xs text-gray-500 line-clamp-2">{c.mensagem}</p>}
                            <p className="text-xs text-gray-400">{formatDate(c.createdAt)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {c.contactId ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />Contato
                              </span>
                            ) : (
                              <button
                                onClick={() => syncOne(c.id)}
                                disabled={syncingId === c.id}
                                title="Adicionar aos Contatos"
                                className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                              >
                                {syncingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                              </button>
                            )}
                            <select
                              value={c.status}
                              onChange={e => statusMutation.mutate({ id: c.id, status: e.target.value })}
                              className="text-xs border rounded px-2 py-1 text-gray-700 bg-white"
                            >
                              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => { if (confirm('Remover este cadastro?')) deleteMutation.mutate(c.id) }}
                              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {cadastrosData && cadastrosData.pages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">Página {page} de {cadastrosData.pages}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= cadastrosData.pages}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
