import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  dropSession,
  dropUserMemory,
  getSession,
  recall,
  registerSession,
  remember,
  turnWindow,
  type ActiveSession,
  type SessionTurn,
} from './memory'

function session(): ActiveSession {
  return {
    sessionId: 's1',
    userId: 'u1',
    documentId: 'd1',
    startedAt: Date.now(),
    turns: [],
    notes: new Map(),
  }
}

describe('Memory', () => {
  it('registerSession / getSession round-trips', () => {
    const s = session()
    registerSession(s)
    assert.equal(getSession('s1'), s)
    dropSession('s1')
    assert.equal(getSession('s1'), undefined)
  })

  it('remember / recall is per-user', () => {
    remember('u1', 'learning-style', 'visual')
    remember('u2', 'learning-style', 'auditory')
    assert.equal(recall('u1', 'learning-style'), 'visual')
    assert.equal(recall('u2', 'learning-style'), 'auditory')
    dropUserMemory('u1')
    assert.equal(recall('u1', 'learning-style'), undefined)
  })

  it('turnWindow renders a compact transcript with the most recent turns', () => {
    const s = session()
    const t: SessionTurn = {
      kind: 'question',
      at: new Date().toISOString(),
      conceptId: 'A',
      question: {
        kind: 'EASY',
        prompt: 'What is X?',
        options: ['1', '2', '3', '4'],
        correctIndex: 0,
        difficulty: 0.1,
        microFeedback: 'ok',
      },
    }
    s.turns.push(t, {
      kind: 'answer',
      at: new Date().toISOString(),
      answer: { kind: 'MCQ', optionIndex: 0 },
    })
    const out = turnWindow(s)
    assert.ok(out.includes('What is X?'))
    assert.ok(out.includes('option 0'))
  })

  it('turnWindow returns the placeholder for an empty session', () => {
    const s = session()
    assert.equal(turnWindow(s), '(no prior turns in this session)')
  })

  it('turnWindow limits to the last N turns', () => {
    const s = session()
    for (let i = 0; i < 20; i += 1) {
      s.turns.push({
        kind: 'answer',
        at: new Date().toISOString(),
        answer: { kind: 'MCQ', optionIndex: i % 4 },
      })
    }
    const out = turnWindow(s, 3)
    // 3 turns * one line each
    const lines = out.split('\n').filter((l) => l.length > 0)
    assert.equal(lines.length, 3)
  })
})
