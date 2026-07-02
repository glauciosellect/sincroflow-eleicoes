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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import {
  Users, Plus, Loader2, MapPin, Target, X, Eye, EyeOff,
  ToggleLeft, ToggleRight, Trash2, Activity, ChevronDown, ChevronUp
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

const coordSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Mínimo 6 caracteres'),
  telefone: z.string().optional(),
  cidade: z.string().optional(),
  bairros: z.string().optional(),
  metaVotos: z.string().optional(),
})
type CoordForm = z.infer<typeof coordSchema>

interface Coord {
  id: string; nome: string; email: string; telefone?: string
  cidade?: string; bairros: string[]; metaVotos?: number
  ativo: boolean; ultimoAcesso?: string; createdAt: string
  _count: { checkIns: number }
}

export default function CoordenadoresPage() {
  const [showForm, setShowForm] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { toast } = useToast()
  const qc = useQueryClient()

  const { data: coordenadores = [], isLoading } = useQuery<Coord[]>({
    queryKey: ['coordenadores'],
    queryFn: () => api.get('/painel/coordenadores').then(r => r.data),
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CoordForm>({
    resolver: zodResolver(coordSchema),
  })

  const createMutation = useMutation({
    mutationFn: (data: CoordForm) => api.post('/painel/coordenadores', {
      nome: data.nome,
      email: data.email,
      senha: data.senha,
      telefone: data.telefone || undefined,
      cidade: data.cidade || undefined,
      bairros: data.bairros ? data.bairros.split(',').map(b => b.trim()).filter(Boolean) : [],
      metaVotos: data.metaVotos ? parseInt(data.metaVotos) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coordenadores'] })
      toast({ title: 'Coordenador cadastrado!' })
      reset()
      setShowForm(false)
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.response?.data?.error, variant: 'destructive' }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => api.patch(`/painel/coordenadores/${id}`, { ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coordenadores'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/painel/coordenadores/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coordenadores'] }); toast({ title: 'Coordenador removido' }) },
    onError: (e: any) => toast({ title: 'Erro ao remover', description: e.response?.data?.error, variant: 'destructive' }),
  })

  const ativos = coordenadores.filter(c => c.ativo).length

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coordenadores</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie os coordenadores regionais da campanha.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{ativos} ativos</Badge>
          <Button onClick={() => setShowForm(s => !s)} className="bg-[#002776] hover:bg-[#001f5e] gap-2">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancelar' : 'Novo coordenador'}
          </Button>
        </div>
      </div>

      {/* Form de cadastro */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Dados do coordenador</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Nome *</label>
                  <Input {...register('nome')} placeholder="Nome completo" />
                  {errors.nome && <p className="text-xs text-red-600">{errors.nome.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Email *</label>
                  <Input {...register('email')} type="email" placeholder="email@exemplo.com" />
                  {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Senha temporária *</label>
                  <div className="relative">
                    <Input {...register('senha')} type={showPass ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" className="pr-10" />
                    <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.senha && <p className="text-xs text-red-600">{errors.senha.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Telefone</label>
                  <Input {...register('telefone')} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Cidade</label>
                  <Input {...register('cidade')} placeholder="Cidade de atuação" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Bairros (separados por vírgula)</label>
                  <Input {...register('bairros')} placeholder="Centro, Vila Nova, Jardim..." />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Meta de votos</label>
                  <Input {...register('metaVotos')} type="number" min="0" placeholder="Ex: 500" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting || createMutation.isPending} className="bg-[#002776] hover:bg-[#001f5e] gap-2">
                  {(isSubmitting || createMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                  Cadastrar coordenador
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : coordenadores.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-medium">Nenhum coordenador cadastrado</p>
          <p className="text-sm mt-1">Clique em "Novo coordenador" para começar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coordenadores.map(coord => (
            <Card key={coord.id} className={!coord.ativo ? 'opacity-60' : ''}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#002776]/10 flex items-center justify-center shrink-0 text-[#002776] font-bold text-sm">
                    {coord.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{coord.nome}</span>
                      <Badge variant={coord.ativo ? 'default' : 'secondary'} className={coord.ativo ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                        {coord.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{coord.email}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-400">
                      {coord.cidade && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {coord.cidade}{coord.bairros.length > 0 ? ` — ${coord.bairros.join(', ')}` : ''}
                        </span>
                      )}
                      {coord.metaVotos && (
                        <span className="flex items-center gap-1"><Target className="w-3 h-3" />Meta: {coord.metaVotos.toLocaleString()}</span>
                      )}
                      <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{coord._count.checkIns} check-ins</span>
                      {coord.ultimoAcesso && <span>Último acesso: {formatDate(coord.ultimoAcesso)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setExpandedId(expandedId === coord.id ? null : coord.id)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400"
                      title="Atividade"
                    >
                      {expandedId === coord.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => toggleMutation.mutate({ id: coord.id, ativo: !coord.ativo })}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400"
                      title={coord.ativo ? 'Desativar' : 'Ativar'}
                    >
                      {coord.ativo ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => { if (confirm(`Remover ${coord.nome}?`)) deleteMutation.mutate(coord.id) }}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expandido: atividade */}
                {expandedId === coord.id && (
                  <CoordAtividade coordId={coord.id} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function CoordAtividade({ coordId }: { coordId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['coord-atividade', coordId],
    queryFn: () => api.get(`/painel/coordenadores/${coordId}/atividade`).then(r => r.data),
  })

  if (isLoading) return <div className="mt-3 flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>

  return (
    <div className="mt-4 pt-4 border-t space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Atividade recente</p>
        <span className="text-xs text-gray-500">{data?.totalEleitores ?? 0} eleitores na área</span>
      </div>
      {data?.checkIns?.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhum check-in registrado</p>
      ) : (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {data?.checkIns?.slice(0, 10).map((c: any) => (
            <div key={c.id} className="flex items-center gap-2 text-xs text-gray-600">
              <span className="shrink-0 w-16 text-gray-400">{formatDate(c.dataCheckin)}</span>
              <Badge variant="secondary" className="text-xs py-0">{c.tipo}</Badge>
              {c.observacao && <span className="truncate text-gray-500">{c.observacao}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
