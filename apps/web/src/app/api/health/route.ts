import { NextResponse } from 'next/server'
import { prisma } from '@mindmap/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  let db: 'ok' | 'down' = 'ok'
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    db = 'down'
  }
  const body = {
    ok: db === 'ok',
    db,
    time: new Date().toISOString(),
  }
  return NextResponse.json(body, { status: db === 'ok' ? 200 : 503 })
}
