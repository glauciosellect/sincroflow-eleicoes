import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Carrega .env manualmente
const envFile = readFileSync(resolve(__dirname, '.env'), 'utf8')
for (const line of envFile.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const val = match[2].trim().replace(/^["']|["']$/g, '')
    process.env[key] = val
  }
}

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../../node_modules/@prisma/client/index.js')
const prisma = new PrismaClient()

const rows = await prisma.$queryRawUnsafe(`
  SELECT u.email, u.name, w.id as workspace_id, w.name as workspace_name
  FROM "User" u
  JOIN "WorkspaceMember" wm ON wm."userId" = u.id
  JOIN "Workspace" w ON w.id = wm."workspaceId"
  WHERE wm.role = 'OWNER'
  ORDER BY u."createdAt" DESC
  LIMIT 20
`)
console.log(JSON.stringify(rows, null, 2))
await prisma.$disconnect()
