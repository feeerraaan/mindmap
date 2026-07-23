import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const v = await p.verification.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })
console.log(JSON.stringify(v, null, 2))
await p.$disconnect()
