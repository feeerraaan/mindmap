/**
 * Seed script — populates a demo user, a workspace, a pre-built document
 * with a 20-concept knowledge graph, and a hackathon coupon. The landing
 * page's live mini-demo can render this graph.
 *
 * Run with: pnpm --filter @mindmap/database seed
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@mindmap.app' },
    update: {},
    create: {
      email: 'demo@mindmap.app',
      name: 'Demo Learner',
      emailVerified: true,
      locale: 'en',
    },
  })

  // Demo workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: 'ws_demo' },
    update: {},
    create: {
      id: 'ws_demo',
      ownerId: user.id,
      name: 'Cardiology Q1',
      emoji: '🫀',
    },
  })

  // Demo document
  const doc = await prisma.document.upsert({
    where: { id: 'doc_demo' },
    update: {},
    create: {
      id: 'doc_demo',
      workspaceId: workspace.id,
      blobKey: 'demo/cardiology.txt',
      filename: 'cardiology-101.txt',
      mimeType: 'text/plain',
      sizeBytes: 12_345,
      pageCount: 30,
      status: 'MAPPED',
      language: 'en',
    },
  })

  // Demo concepts — 20 in a small DAG
  const conceptData = [
    { id: 'c1', externalId: 'c-1', title: 'Cardiac cycle', importance: 0.95, difficulty: 0.7 },
    { id: 'c2', externalId: 'c-2', title: 'Systole', importance: 0.85, difficulty: 0.4 },
    { id: 'c3', externalId: 'c-3', title: 'Diastole', importance: 0.85, difficulty: 0.4 },
    { id: 'c4', externalId: 'c-4', title: 'Atrial contraction', importance: 0.6, difficulty: 0.5 },
    { id: 'c5', externalId: 'c-5', title: 'Ventricular contraction', importance: 0.75, difficulty: 0.5 },
    { id: 'c6', externalId: 'c-6', title: 'AV node', importance: 0.7, difficulty: 0.6 },
    { id: 'c7', externalId: 'c-7', title: 'SA node', importance: 0.7, difficulty: 0.5 },
    { id: 'c8', externalId: 'c-8', title: 'EKG basics', importance: 0.9, difficulty: 0.65 },
    { id: 'c9', externalId: 'c-9', title: 'P wave', importance: 0.6, difficulty: 0.4 },
    { id: 'c10', externalId: 'c-10', title: 'QRS complex', importance: 0.8, difficulty: 0.5 },
    { id: 'c11', externalId: 'c-11', title: 'T wave', importance: 0.55, difficulty: 0.4 },
    { id: 'c12', externalId: 'c-12', title: 'Stroke volume', importance: 0.7, difficulty: 0.55 },
    { id: 'c13', externalId: 'c-13', title: 'Cardiac output', importance: 0.85, difficulty: 0.5 },
    { id: 'c14', externalId: 'c-14', title: 'Preload', importance: 0.5, difficulty: 0.6 },
    { id: 'c15', externalId: 'c-15', title: 'Afterload', importance: 0.5, difficulty: 0.6 },
    { id: 'c16', externalId: 'c-16', title: 'Frank-Starling law', importance: 0.7, difficulty: 0.75 },
    { id: 'c17', externalId: 'c-17', title: 'Coronary circulation', importance: 0.6, difficulty: 0.55 },
    { id: 'c18', externalId: 'c-18', title: 'Heart valves', importance: 0.7, difficulty: 0.45 },
    { id: 'c19', externalId: 'c-19', title: 'Mitral valve', importance: 0.5, difficulty: 0.4 },
    { id: 'c20', externalId: 'c-20', title: 'Aortic valve', importance: 0.5, difficulty: 0.4 },
  ]

  for (const c of conceptData) {
    await prisma.concept.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        documentId: doc.id,
        externalId: c.externalId,
        title: c.title,
        summary: `${c.title} — concise summary used by the demo knowledge map.`,
        importance: c.importance,
        difficulty: c.difficulty,
      },
    })
  }

  // Demo edges (acyclic DAG)
  const edges: Array<{ from: string; to: string }> = [
    { from: 'c1', to: 'c2' },
    { from: 'c1', to: 'c3' },
    { from: 'c2', to: 'c4' },
    { from: 'c2', to: 'c5' },
    { from: 'c3', to: 'c4' },
    { from: 'c5', to: 'c6' },
    { from: 'c6', to: 'c7' },
    { from: 'c8', to: 'c9' },
    { from: 'c8', to: 'c10' },
    { from: 'c8', to: 'c11' },
    { from: 'c13', to: 'c12' },
    { from: 'c13', to: 'c14' },
    { from: 'c13', to: 'c15' },
    { from: 'c16', to: 'c13' },
    { from: 'c1', to: 'c8' },
    { from: 'c17', to: 'c1' },
    { from: 'c18', to: 'c19' },
    { from: 'c18', to: 'c20' },
  ]
  for (const e of edges) {
    await prisma.conceptDependency.upsert({
      where: { dependantId_dependencyId: { dependantId: e.from, dependencyId: e.to } },
      update: {},
      create: { dependantId: e.from, dependencyId: e.to, weight: 1.0 },
    })
  }

  // Hackathon coupon
  await prisma.coupon.upsert({
    where: { code: 'JUDGE100' },
    update: {},
    create: {
      code: 'JUDGE100',
      plan: 'PRO',
      durationDays: 365,
      maxRedemptions: 100,
      validFrom: new Date(),
      note: 'Hackathon judges 2026',
    },
  })

  console.warn(`Seeded demo user ${user.email}, workspace ${workspace.id}, ${conceptData.length} concepts, ${edges.length} edges.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
