import axios from 'axios'
import { logger } from './logger'

const ASAAS_API_URL = process.env.ASAAS_ENV === 'sandbox'
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/api/v3'

if (!process.env.ASAAS_API_KEY) {
  logger.error('[ASAAS] ASAAS_API_KEY não está definida no ambiente — todas as chamadas à Asaas vão falhar')
}

export const asaas = axios.create({
  baseURL: ASAAS_API_URL,
  headers: {
    'access_token': process.env.ASAAS_API_KEY || '',
    'Content-Type': 'application/json',
  },
})

// Loga o corpo completo de erro da Asaas — sem isso, só se vê "Request failed with
// status code 404/401" no log, sem a mensagem de erro real que a Asaas retorna.
asaas.interceptors.response.use(
  (res) => res,
  (err) => {
    logger.error('[ASAAS] Erro na chamada à API', {
      url: err?.config?.url,
      method: err?.config?.method,
      status: err?.response?.status,
      data: err?.response?.data,
      baseURL: ASAAS_API_URL,
      hasApiKey: !!process.env.ASAAS_API_KEY,
    })
    return Promise.reject(err)
  }
)

export const PLANOS_CAMPANHA = {
  deputado_estadual: {
    nome: 'SyncroFlow Eleições — Deputado Estadual',
    valor: 5990.00,
  },
  deputado_federal: {
    nome: 'SyncroFlow Eleições — Deputado Federal',
    valor: 7490.00,
  },
  senador_governador: {
    nome: 'SyncroFlow Eleições — Senador / Governador',
    valor: 10990.00,
  },
} as const

export type PlanoCampanhaKey = keyof typeof PLANOS_CAMPANHA

export function calcularParcelas(valorTotal: number, parcelas: 1 | 2 | 3) {
  const valorParcela = Math.round((valorTotal / parcelas) * 100) / 100
  return { valorTotal, parcelas, valorParcela }
}

// Cria ou recupera cliente no Asaas pelo CPF
export async function upsertClienteAsaas(params: {
  name: string
  cpf: string
  email: string
  whatsapp?: string
}): Promise<string> {
  // Busca cliente existente pelo CPF
  const busca = await asaas.get('/customers', { params: { cpfCnpj: params.cpf.replace(/\D/g, '') } })
  if (busca.data.data?.length > 0) {
    return busca.data.data[0].id as string
  }

  // Cria novo cliente
  const criacao = await asaas.post('/customers', {
    name: params.name,
    cpfCnpj: params.cpf.replace(/\D/g, ''),
    email: params.email,
    mobilePhone: params.whatsapp?.replace(/\D/g, '') || undefined,
    notificationDisabled: false,
  })
  return criacao.data.id as string
}

// Gera cobrança no Asaas (Pix, cartão parcelado)
export async function criarCobrancaAsaas(params: {
  customerId: string
  valor: number
  parcelas: 1 | 2 | 3
  billingType: 'PIX' | 'CREDIT_CARD'
  descricao: string
  externalReference: string // candidateId
  redirectUrl?: string
}) {
  const payload: Record<string, any> = {
    customer: params.customerId,
    billingType: params.billingType,
    value: params.valor,
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    description: params.descricao,
    externalReference: params.externalReference,
  }

  if (params.billingType === 'CREDIT_CARD' && params.parcelas > 1) {
    payload.installmentCount = params.parcelas
    payload.installmentValue = Math.round((params.valor / params.parcelas) * 100) / 100
    payload.totalValue = params.valor
  }

  if (params.billingType === 'PIX') {
    payload.pixAddressKeyType = 'EVP'
  }

  const res = await asaas.post('/payments', payload)
  return res.data
}

// Busca link de pagamento de uma cobrança
export async function getLinkPagamento(paymentId: string): Promise<string | null> {
  const res = await asaas.get(`/payments/${paymentId}/viewingInfo`)
  return res.data?.bankSlipUrl || res.data?.invoiceUrl || null
}

// Busca QR Code Pix de uma cobrança
export async function getPixQrCode(paymentId: string): Promise<{ encodedImage: string; payload: string } | null> {
  try {
    const res = await asaas.get(`/payments/${paymentId}/pixQrCode`)
    return { encodedImage: res.data.encodedImage, payload: res.data.payload }
  } catch {
    return null
  }
}
