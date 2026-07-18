import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'
import ws from 'ws'

// Usamos só o Storage (upload de criativos), nunca o Realtime — mas o client
// do Supabase instancia um RealtimeClient internamente de qualquer forma, que
// exige WebSocket nativo (só disponível a partir do Node 22). Em runtimes
// Node 20 isso quebra o boot a menos que um transport seja fornecido explicitamente.
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  realtime: { transport: ws as any },
})

const BUCKET_CREATIVES = 'creatives'
const BUCKET_CANDIDATES = 'candidates'

/** Sobe um criativo para o Supabase Storage e retorna a URL pública. */
export async function uploadCreative(candidateId: string, fileBuffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const path = `${candidateId}/${Date.now()}-${filename}`
  const { error } = await supabase.storage.from(BUCKET_CREATIVES).upload(path, fileBuffer, { contentType: mimeType, upsert: false })
  if (error) throw new Error(`Falha ao subir criativo: ${error.message}`)
  const { data } = supabase.storage.from(BUCKET_CREATIVES).getPublicUrl(path)
  return data.publicUrl
}

/** Remove o arquivo do bucket creatives — best-effort. */
export async function deleteCreativeFile(fileUrl: string): Promise<void> {
  try {
    const path = fileUrl.split(`/${BUCKET_CREATIVES}/`)[1]
    if (!path) return
    await supabase.storage.from(BUCKET_CREATIVES).remove([path])
  } catch (err) {
    logger.error('[STORAGE] Erro ao remover arquivo do bucket (ignorado):', err)
  }
}

/** Sobe a foto do candidato e retorna a URL pública. Substitui a anterior se existir. */
export async function uploadCandidatePhoto(candidateId: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  const path = `${candidateId}/photo.${ext}`
  const { error } = await supabase.storage.from(BUCKET_CANDIDATES).upload(path, fileBuffer, { contentType: mimeType, upsert: true })
  if (error) throw new Error(`Falha ao subir foto: ${error.message}`)
  const { data } = supabase.storage.from(BUCKET_CANDIDATES).getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}

/** Sobe foto do portal (hero, sobre ou fundo) e retorna a URL pública permanente. */
export async function uploadPortalPhoto(candidateId: string, tipo: 'hero' | 'sobre' | 'fundo', fileBuffer: Buffer, mimeType: string): Promise<string> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  const filePath = `${candidateId}/portal-${tipo}.${ext}`
  const { error } = await supabase.storage.from(BUCKET_CANDIDATES).upload(filePath, fileBuffer, { contentType: mimeType, upsert: true })
  if (error) throw new Error(`Falha ao subir foto do portal: ${error.message}`)
  const { data } = supabase.storage.from(BUCKET_CANDIDATES).getPublicUrl(filePath)
  return `${data.publicUrl}?t=${Date.now()}`
}
