/**
 * Prisma client singleton.
 *
 * Next.js dev mode hot-reloads server modules and would create a new
 * PrismaClient on every reload, exhausting the connection pool. We cache
 * the instance on globalThis to survive HMR.
 */
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
