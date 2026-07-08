import { Redis } from 'ioredis'
import { logger } from './logger'

const redisUrl = process.env.REDIS_URL
if (!redisUrl) throw new Error('REDIS_URL não definida — servidor não pode iniciar sem Redis')

const isTLS = redisUrl.startsWith('rediss://')

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  tls: isTLS ? {} : undefined,
})

redis.on('error', (err) => {
  logger.error('[Redis] Connection error', { message: err.message })
})
