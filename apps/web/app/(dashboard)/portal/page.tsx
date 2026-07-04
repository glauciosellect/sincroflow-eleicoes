'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import {
  Globe, Settings, Users, Download, ExternalLink, Copy, CheckCircle2,
  ChevronLeft, ChevronRight, Loader2, Search, Trash2, Phone, Mail, MapPin,
  UserPlus, RefreshCw, BookOpen, ImageIcon, Link2, Palette, Eye, ArrowRight
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

const configSchema = z.object({
  slug: z.string().min(3).max(60).regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens'),
  titulo: z.string().min(3).max(120),
  subtitulo: z.string().max(200).optional(),
  descricao: z.string().max(2000).optional(),
  fotoUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  corPrimaria: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor hex inválida').default('#002776'),
  ativo: z.boolean().default(true),
})
type ConfigForm = z.infer<typeof configSchema>

interface Portal {
  id: string; slug: string; titulo: string; subtitulo?: string; descricao?: string
  fotoUrl?: string; corPrimaria: string; ativo: boolean; totalCadastros: number
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

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<ConfigForm>({
    resolver: zodResolver(configSchema),
    defaultValues: portal ?? {
      slug: '', titulo: '', subtitulo: '', descricao: '', fotoUrl: '', corPrimaria: '#002776', ativo: true,
    },
  })

  // Reset form when portal data loads
  useState(() => {
    if (portal) reset(portal)
  })

  const saveMutation = useMutation({
    mutationFn: (data: ConfigForm) => api.post('/portal', { ...data, fotoUrl: data.fotoUrl || null }),
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
    const url = `${window.location.origin.replace('3000', '3001')}/eleitor/${portal.slug}`
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
          <p className="text-sm text-gray-500 mt-1">Página pública para cadastro de eleitores — compartilhe o link e receba apoiadores.</p>
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

      {/* Config Tab */}
      {tab === 'config' && (
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-6">

          {/* Guia passo a passo */}
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-blue-800">
                <BookOpen className="w-5 h-5" />
                Como configurar seu Portal do Eleitor — passo a passo
              </CardTitle>
              <p className="text-sm text-blue-700 mt-1">
                O Portal do Eleitor é uma página pública que você compartilha nas redes sociais, WhatsApp e material impresso. Eleitores se cadastram e ficam na sua base de apoiadores.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">

              {/* Passo 1 */}
              <div className="flex gap-3 p-3 bg-white rounded-xl border border-blue-100">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0">1</div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-blue-500" />
                    Escolha o endereço (slug) do seu portal
                  </p>
                  <p className="text-xs text-gray-600">
                    O slug é o final do link que você vai compartilhar. Use seu nome sem espaços ou acentos.
                    Exemplo: se você se chama <strong>João Silva</strong>, coloque <code className="bg-gray-100 px-1 rounded">joao-silva</code>.
                    Seu link ficará: <span className="text-blue-700 font-medium">syncrofloweleicoes.com.br/eleitor/joao-silva</span>
                  </p>
                </div>
              </div>

              {/* Passo 2 */}
              <div className="flex gap-3 p-3 bg-white rounded-xl border border-blue-100">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0">2</div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-blue-500" />
                    Escreva o título e a mensagem do portal
                  </p>
                  <p className="text-xs text-gray-600">
                    O <strong>Título</strong> é o que aparece em destaque para o eleitor (ex: <em>"Apoie a campanha de João Silva — Deputado Estadual"</em>).
                    A <strong>Descrição</strong> é a mensagem motivacional abaixo do título — use para contar por que o eleitor deve se cadastrar e apoiar sua candidatura.
                  </p>
                </div>
              </div>

              {/* Passo 3 */}
              <div className="flex gap-3 p-3 bg-white rounded-xl border border-blue-100">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0">3</div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-blue-500" />
                    Adicione sua foto
                  </p>
                  <p className="text-xs text-gray-600">
                    Cole o link direto de uma foto sua (URL terminando em .jpg ou .png).
                    Dica: faça upload da foto no{' '}
                    <a href="https://imgbb.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium">imgbb.com</a>
                    {' '}(gratuito, sem cadastro) e copie o "Direct link" gerado.
                  </p>
                </div>
              </div>

              {/* Passo 4 */}
              <div className="flex gap-3 p-3 bg-white rounded-xl border border-blue-100">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0">4</div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-blue-500" />
                    Escolha a cor da sua campanha
                  </p>
                  <p className="text-xs text-gray-600">
                    Clique no campo de cor e selecione a cor principal da sua campanha.
                    Ela aparecerá no botão e no cabeçalho do portal — use a mesma cor dos seus materiais de campanha para manter a identidade visual.
                  </p>
                </div>
              </div>

              {/* Passo 5 */}
              <div className="flex gap-3 p-3 bg-white rounded-xl border border-blue-100">
                <div className="w-7 h-7 rounded-full bg-green-600 text-white text-sm font-bold flex items-center justify-center shrink-0">5</div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-green-500" />
                    Salve, visualize e compartilhe!
                  </p>
                  <p className="text-xs text-gray-600">
                    Clique em <strong>"Criar portal"</strong> (ou "Salvar alterações"). Depois clique em <strong>"Ver portal"</strong> no topo da tela para ver como ficou.
                    Quando estiver satisfeito, clique em <strong>"Copiar link"</strong> e compartilhe nas suas redes sociais, grupos de WhatsApp e material impresso (QR Code).
                  </p>
                </div>
              </div>

              {/* Dica extra */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-lg shrink-0">💡</span>
                <p className="text-xs text-amber-800">
                  <strong>Dica:</strong> Os eleitores que se cadastrarem aparecem automaticamente na aba <strong>Cadastros</strong> desta página. Você pode marcá-los como "Contatado" ou "Convertido" conforme for fazendo o acompanhamento. Use o botão <strong>"Exportar CSV"</strong> para baixar a lista completa e usar em outras ferramentas.
                </p>
              </div>

            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Identidade do portal</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Slug (URL) *</label>
                  <div className="flex items-center border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-[#002776]">
                    <span className="px-3 py-2 bg-gray-50 text-gray-500 text-sm border-r whitespace-nowrap">/eleitor/</span>
                    <input {...register('slug')} placeholder="nome-do-candidato" className="flex-1 px-3 py-2 text-sm outline-none" />
                  </div>
                  {errors.slug && <p className="text-xs text-red-600">{errors.slug.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Cor primária</label>
                  <input type="color" {...register('corPrimaria')} className="h-10 w-full rounded-md border cursor-pointer" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Título do portal *</label>
                <Input {...register('titulo')} placeholder="ex: Apoie a campanha de João Silva" />
                {errors.titulo && <p className="text-xs text-red-600">{errors.titulo.message}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Subtítulo</label>
                <Input {...register('subtitulo')} placeholder="ex: Juntos por um futuro melhor para o Brasil" />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Descrição / Mensagem ao eleitor</label>
                <Textarea {...register('descricao')} rows={4} placeholder="Escreva uma mensagem motivacional para quem acessar o portal..." />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">URL da foto do candidato</label>
                <Input {...register('fotoUrl')} placeholder="https://..." />
                {errors.fotoUrl && <p className="text-xs text-red-600">{errors.fotoUrl.message}</p>}
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" {...register('ativo')} id="ativo" className="w-4 h-4 rounded" />
                <label htmlFor="ativo" className="text-sm text-gray-700">Portal ativo (visível publicamente)</label>
              </div>
            </CardContent>
          </Card>

          {portal && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-blue-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-blue-800">Link do portal</p>
                    <p className="text-xs text-blue-600 truncate">{portalUrl}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || saveMutation.isPending} className="bg-[#002776] hover:bg-[#001f5e] gap-2">
              {(isSubmitting || saveMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              {portal ? 'Salvar alterações' : 'Criar portal'}
            </Button>
          </div>
        </form>
      )}

      {/* Cadastros Tab */}
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

              {/* Pagination */}
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
