import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const j = await p.job.findFirst({ orderBy: { createdAt: 'desc' } })
const d = await p.document.findFirst({ orderBy: { createdAt: 'desc' }, include: { chunks: true } })
console.log('Job:', j?.status, j?.progress, 'err:', j?.error)
console.log('Doc:', d?.status, 'chunks:', d?.chunks.length)
if (d?.chunks[0]) console.log('Chunk[0]:', d.chunks[0].text.slice(0, 80))
await p.$disconnect()
