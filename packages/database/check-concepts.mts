import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const session = await prisma.diagnosisSession.findFirst({
  where: { status: 'ACTIVE' },
  orderBy: { startedAt: 'desc' },
})
if (!session) { console.log('No active session'); process.exit(0) }

console.log('Session:', session.id, 'doc:', session.documentId)

const questions = await prisma.conversationTurn.findMany({
  where: { sessionId: session.id, role: 'ASSISTANT' },
  include: { question: true },
  take: 5,
})

const concepts = await prisma.concept.findMany({
  where: { documentId: session.documentId },
  select: { id: true, externalId: true, title: true },
})

console.log('\nConcepts in DB:')
concepts.forEach(c => console.log(`  id=${c.id} externalId=${c.externalId} title=${c.title.slice(0,40)}`))

console.log('\nQuestions in DB:')
questions.forEach(q => {
  const qRow = q.question
  console.log(`  turnId=${q.id} conceptId=${qRow?.conceptId} prompt=${q.content.slice(0,40)}`)
})

if (questions[0]?.question) {
  const qConceptId = questions[0].question.conceptId
  console.log('\nFirst question conceptId:', qConceptId)
  console.log('Matches concept.id?', concepts.some(c => c.id === qConceptId))
  console.log('Matches concept.externalId?', concepts.some(c => c.externalId === qConceptId))
}
