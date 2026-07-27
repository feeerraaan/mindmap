import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  moments,
  priorFromState,
  uniformPrior,
  updateWithEvidence,
  updateWithIDontKnow,
  updateWithSkip,
} from './bayesian'

describe('Bayesian density', () => {
  it('uniform prior has mean ≈ 0 (mid-mastery) and low confidence', () => {
    const d = uniformPrior()
    const m = moments(d)
    assert.ok(Math.abs(m.mastery - 0.5) < 1e-6)
    // Uniform over [-3, 3] has variance 3, so confidence = 1/(1+3) ≈ 0.25.
    assert.ok(m.confidence < 0.35, `confidence too high: ${m.confidence}`)
  })

  it('Gaussian prior centres on the supplied mastery', () => {
    const d = priorFromState(0.7, 0.8)
    const m = moments(d)
    assert.ok(Math.abs(m.mastery - 0.7) < 0.05, `mastery=${m.mastery}`)
    assert.ok(m.confidence > 0.4, `confidence=${m.confidence}`)
  })

  it('strong confidence = low variance (sharper peak)', () => {
    const looseM = moments(priorFromState(0.5, 0.0))
    const tightM = moments(priorFromState(0.5, 1.0))
    assert.ok(
      tightM.variance < looseM.variance,
      `tight.variance=${tightM.variance} loose=${looseM.variance}`,
    )
  })

  it('a perfect correct answer raises mastery', () => {
    const before = priorFromState(0.5, 0.5)
    const after = updateWithEvidence(before, 1, 0)
    const m = moments(after)
    assert.ok(
      m.mastery > moments(before).mastery,
      `before=${moments(before).mastery} after=${m.mastery}`,
    )
  })

  it('a perfect wrong answer lowers mastery', () => {
    const before = priorFromState(0.5, 0.5)
    const after = updateWithEvidence(before, 0, 0)
    const m = moments(after)
    assert.ok(m.mastery < moments(before).mastery)
  })

  it('monotonic in evidence: more correct answers move mastery further up', () => {
    const start = priorFromState(0.5, 0.5)
    let a = start
    for (let i = 0; i < 3; i += 1) a = updateWithEvidence(a, 1, 0)
    const m3 = moments(a)
    let b = start
    b = updateWithEvidence(b, 1, 0)
    const m1 = moments(b)
    assert.ok(
      m3.mastery > m1.mastery,
      `3 correct (${m3.mastery}) should beat 1 correct (${m1.mastery})`,
    )
  })

  it('I dont know lowers mastery but raises confidence', () => {
    const before = priorFromState(0.5, 0.3)
    const after = updateWithIDontKnow(before, 0)
    const m = moments(after)
    assert.ok(
      m.mastery < moments(before).mastery,
      `mastery ${m.mastery} vs ${moments(before).mastery}`,
    )
    assert.ok(
      m.confidence >= moments(before).confidence,
      `confidence ${m.confidence} vs ${moments(before).confidence}`,
    )
  })

  it('Skip lowers confidence but barely moves mastery', () => {
    const before = priorFromState(0.5, 0.6)
    const after = updateWithSkip(before)
    const m = moments(after)
    const beforeM = moments(before)
    assert.ok(
      m.confidence < beforeM.confidence,
      `confidence ${m.confidence} vs ${beforeM.confidence}`,
    )
    assert.ok(
      Math.abs(m.mastery - beforeM.mastery) < 0.05,
      `mastery should be near-unchanged: ${m.mastery} vs ${beforeM.mastery}`,
    )
  })

  it('density is normalised after each update', () => {
    let d = uniformPrior()
    for (let i = 0; i < 10; i += 1) {
      d = updateWithEvidence(d, Math.random(), 0)
      const sum = d.mass.reduce((a, b) => a + b, 0)
      assert.ok(Math.abs(sum - 1) < 1e-9, `mass sum ${sum} after update ${i}`)
    }
  })
})
