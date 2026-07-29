// Loaded as the first import of scripts/worker.ts so process.env is populated
// from /root/mindmap/.env before @mindmap/database (which instantiates
// PrismaClient at import time) and @vercel/blob are evaluated. Avoids
// relying on pm2's node_args, which were being dropped in fork mode.
import { loadEnvFile } from 'node:process'

const path = process.env.MINDMAP_ENV_FILE ?? '/root/mindmap/.env'
try {
  loadEnvFile(path)
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[worker] could not load env file ${path}: ${message}`)
  process.exit(1)
}
