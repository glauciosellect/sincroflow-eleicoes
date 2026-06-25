import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const BUCKET = 'creatives'

/** Sobe um criativo para o Supabase Storage e retorna a URL pública. */
export async function uploadCreative(candidateId: string, fileBuffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const path = `${candidateId}/${Date.now()}-${filename}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, fileBuffer, { contentType: mimeType, upsert: false })
  if (error) throw new Error(`Falha ao subir criativo: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** Remove o arquivo do bucket — best-effort, não lança erro se falhar. */
export async function deleteCreativeFile(fileUrl: string): Promise<void> {
  try {
    const path = fileUrl.split(`/${BUCKET}/`)[1]
    if (!path) return
    await supabase.storage.from(BUCKET).remove([path])
  } catch (err) {
    console.error('[STORAGE] Erro ao remover arquivo do bucket (ignorado):', err)
  }
}
