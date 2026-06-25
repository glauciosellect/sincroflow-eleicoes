'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Loader2, UserPlus, Mail, X, Clock, RefreshCw, Shield, ScrollText, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// ─── Roles eleitorais (seção 4.10 da spec) ────────────────────────────────────

const ROLES = [
  { value: 'ADMINISTRADOR', label: 'Administrador', desc: 'Acesso total: História, Plataforma, Chat, Contatos, Agenda, Relatórios, Configurações, Equipe', color: 'bg-purple-100 text-purple-700' },
  { value: 'ATENDIMENTO',   label: 'Atendimento',    desc: 'Chat, Contatos, Agenda',                                                                          color: 'bg-blue-100 text-blue-700' },
  { value: 'CONTEUDO',      label: 'Conteúdo',       desc: 'Minha História, Plataforma Eleitoral, Agenda',                                                    color: 'bg-indigo-100 text-indigo-700' },
  { value: 'RELATORIOS',    label: 'Relatórios',     desc: 'Contatos, Relatórios',                                                                             color: 'bg-amber-100 text-amber-700' },
]

const ROLE_MAP: Record<string, { label: string; color: string }> = Object.fromEntries(ROLES.map(r => [r.value, r]))

const TABS = [
  { id: 'members', label: 'Membros',   icon: Shield },
  { id: 'audit',   label: 'Auditoria', icon: ScrollText },
]

// ─── Modal de convite ─────────────────────────────────────────────────────────

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string>('ATENDIMENTO')
  const [error, setError] = useState('')

  const invite = useMutation({
    mutationFn: (data: { name: string; email: string; role: string }) => api.post('/candidates/me/team/invite', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invites'] })
      setName(''); setEmail(''); setRole('ATENDIMENTO'); setError(''); onClose()
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Erro ao enviar convite'),
  })

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Convidar colaborador</DialogTitle></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); if (!name || !email) return setError('Informe nome e e-mail'); invite.mutate({ name, email, role }) }} className="space-y-4 mt-2">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do colaborador" className="mt-1" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@email.com" className="mt-1" />
          </div>
          <div>
            <Label>Função</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => (
                  <SelectItem key={r.value} value={r.value}>
                    <span className="font-medium">{r.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-3 space-y-1.5">
              {ROLES.map(r => (
                <div key={r.value} className="flex items-start gap-2">
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5', r.color)}>{r.label}</span>
                  <span className="text-xs text-muted-foreground">{r.desc}</span>
                </div>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={invite.isPending} style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }} className="text-white">
              {invite.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Enviar convite
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function TeamPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [showInvite, setShowInvite] = useState(false)
  const [activeTab, setActiveTab] = useState('members')
  const [changingRole, setChangingRole] = useState<string | null>(null)

  const { data: members = [], isLoading: loadingMembers } = useQuery<any[]>({
    queryKey: ['team-members'],
    queryFn: () => api.get('/candidates/me/team').then(r => r.data),
  })

  const { data: invites = [], isLoading: loadingInvites } = useQuery<any[]>({
    queryKey: ['invites'],
    queryFn: () => api.get('/candidates/me/team/invites').then(r => r.data),
  })

  const { data: auditData, isLoading: loadingAudit } = useQuery<any>({
    queryKey: ['audit-log'],
    queryFn: () => api.get('/candidate/audit-log?limit=50').then(r => r.data),
    enabled: activeTab === 'audit',
  })

  const removeMember = useMutation({
    mutationFn: (id: string) => api.delete(`/candidates/me/team/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team-members'] }); toast({ title: 'Colaborador removido' }) },
  })

  const changeRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) => api.patch(`/candidates/me/team/${memberId}`, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team-members'] }); setChangingRole(null); toast({ title: 'Função atualizada!' }) },
    onError: (err: any) => toast({ title: err?.response?.data?.error ?? 'Erro ao atualizar função', variant: 'destructive' }),
  })

  const cancelInvite = useMutation({
    mutationFn: (id: string) => api.delete(`/candidates/me/team/invites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  })

  const resendInvite = useMutation({
    mutationFn: ({ name, email, role }: { name: string; email: string; role: string }) =>
      api.post('/candidates/me/team/invite', { name, email, role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invites'] }); toast({ title: 'Convite reenviado' }) },
  })

  const auditLogs: any[] = auditData?.logs ?? []

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipe</h1>
          <p className="text-gray-500 text-sm mt-1">Convide colaboradores para ajudar no atendimento da campanha</p>
        </div>
        <Button onClick={() => setShowInvite(true)} style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }} className="text-white gap-2">
          <UserPlus className="w-4 h-4" /> Convidar colaborador
        </Button>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all', activeTab === tab.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'members' && (
        <div className="space-y-4">
          {loadingMembers || loadingInvites ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : (
            <>
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-200"><h3 className="font-semibold">Colaboradores ({members.length})</h3></div>
                <div className="divide-y divide-gray-100">
                  {members.length === 0 && (
                    <div className="text-center py-10 text-sm text-gray-400">
                      Convide sua equipe para ajudar no atendimento. Cada colaborador tem seu próprio acesso.
                    </div>
                  )}
                  {members.map((member: any) => {
                    const role = ROLE_MAP[member.role] ?? { label: member.role, color: 'bg-gray-100 text-gray-700' }
                    const isAdmin = member.role === 'ADMINISTRADOR'
                    const isChanging = changingRole === member.id

                    return (
                      <div key={member.id} className="flex items-center justify-between px-4 py-3 gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}>
                            {(member.user?.name || member.name)?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{member.user?.name || member.name}</p>
                            <p className="text-xs text-gray-400 truncate">{member.user?.email || member.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isChanging ? (
                            <div className="flex items-center gap-2">
                              <Select defaultValue={member.role} onValueChange={val => changeRole.mutate({ memberId: member.id, role: val })}>
                                <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {ROLES.map(r => <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <button onClick={() => setChangingRole(null)} className="text-gray-400 hover:text-gray-700"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          ) : (
                            <button onClick={() => setChangingRole(member.id)} className={cn('flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full hover:opacity-80 transition-opacity', role.color)}>
                              {role.label} <ChevronDown className="w-3 h-3" />
                            </button>
                          )}

                          {!isAdmin && (
                            <button onClick={() => { if (confirm(`Remover ${member.user?.name || member.name}?`)) removeMember.mutate(member.id) }} className="text-gray-400 hover:text-red-500 transition-colors" title="Remover">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
                <h3 className="font-semibold text-sm">Referência de funções</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ROLES.map(r => (
                    <div key={r.value} className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5', r.color)}>{r.label}</span>
                      <span className="text-xs text-gray-500">{r.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {invites.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="font-semibold flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> Convites pendentes ({invites.length})</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {invites.map((invite: any) => {
                      const role = ROLE_MAP[invite.role] ?? { label: invite.role, color: 'bg-gray-100 text-gray-700' }
                      return (
                        <div key={invite.id} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-amber-50 rounded-full flex items-center justify-center shrink-0"><Mail className="w-4 h-4 text-amber-500" /></div>
                            <div>
                              <p className="font-medium text-sm">{invite.name}</p>
                              <p className="text-xs text-gray-400">{invite.email} · Aguardando resposta</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', role.color)}>{role.label}</span>
                            <button onClick={() => resendInvite.mutate({ name: invite.name, email: invite.email, role: invite.role })} disabled={resendInvite.isPending} className="text-gray-400 hover:text-[#002776] transition-colors" title="Reenviar">
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button onClick={() => cancelInvite.mutate(invite.id)} disabled={cancelInvite.isPending} className="text-gray-400 hover:text-red-500 transition-colors" title="Cancelar">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold">Log de auditoria</h3>
            <p className="text-xs text-gray-400 mt-0.5">Registro imutável das últimas ações — preservado para defesa legal (seção 7 da Resolução TSE)</p>
          </div>
          {loadingAudit ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">Nenhuma ação registrada ainda.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {auditLogs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-[#002776] mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{log.eventType}</p>
                    {log.content && <p className="text-xs text-gray-400 mt-0.5 truncate">{log.content}</p>}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(log.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} />
    </div>
  )
}
