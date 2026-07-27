import { NextResponse } from 'next/server'
import { getCurrentUser } from '@mindmap/auth'
import { prisma } from '@mindmap/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspaces = await prisma.workspace.findMany({
    where: { ownerId: user.id },
    include: {
      documents: {
        include: {
          concepts: true,
          diagnosisSessions: {
            where: { userId: user.id },
            include: { turns: true },
          },
        },
      },
    },
  })

  const reviewSessions = await prisma.reviewSession.findMany({
    where: { userId: user.id },
    include: { items: true, plan: { select: { documentId: true } } },
    orderBy: { scheduledFor: 'desc' },
    take: 100,
  })

  const exportData = {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    },
    workspaces: workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      emoji: w.emoji,
      createdAt: w.createdAt.toISOString(),
      documents: w.documents.map((d) => ({
        id: d.id,
        filename: d.filename,
        status: d.status,
        sizeBytes: d.sizeBytes,
        pageCount: d.pageCount,
        createdAt: d.createdAt.toISOString(),
        concepts: d.concepts.map((c) => ({
          id: c.id,
          title: c.title,
          summary: c.summary,
          importance: c.importance,
          difficulty: c.difficulty,
        })),
        diagnosisSessions: d.diagnosisSessions.map((ds) => ({
          id: ds.id,
          status: ds.status,
          globalConfidence: ds.globalConfidence,
          questionsAsked: ds.questionsAsked,
          startedAt: ds.startedAt.toISOString(),
          finishedAt: ds.finishedAt?.toISOString() ?? null,
          turnCount: ds.turns.length,
        })),
      })),
    })),
    reviewHistory: reviewSessions.map((r) => ({
      id: r.id,
      documentId: r.plan.documentId,
      scheduledFor: r.scheduledFor.toISOString(),
      startedAt: r.startedAt?.toISOString() ?? null,
      completedAt: r.completedAt?.toISOString() ?? null,
      status: r.status,
      itemCount: r.items.length,
    })),
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="mindmap-export-${user.id}.json"`,
    },
  })
}
