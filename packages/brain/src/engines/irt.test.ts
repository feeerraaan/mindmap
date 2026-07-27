import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fisherInformation, masteryToTheta, probabilityCorrect, thetaToMastery } from './irt'

describe('IRT 1PL', () => {
  it('P(correct | θ=b) is exactly 0.5 at the item difficulty', () => {
    const p = probabilityCorrect(0, 0)
    assert.ok(Math.abs(p - 0.5) < 1e-6, `p=${p}`)
  })

  it('P(correct) is complementary around b: P(θ, b) + P(2b−θ, b) = 1', () => {
    const b = 0.7
    const p1 = probabilityCorrect(2.0, b)
    const p2 = probabilityCorrect(2 * b - 2.0, b)
    assert.ok(Math.abs(p1 + p2 - 1) < 1e-6, `p1=${p1} p2=${p2}`)
  })

  it('P(correct) is monotonically increasing in θ', () => {
    let last = 0
    for (let theta = -3; theta <= 3; theta += 0.5) {
      const p = probabilityCorrect(theta, 0)
      assert.ok(
        p >= last,
        `p should be non-decreasing in theta; got ${p} after ${last} at θ=${theta}`,
      )
      last = p
    }
  })

  it('Fisher information is maximised at θ = b with value 0.25', () => {
    const info = fisherInformation(0, 0)
    assert.ok(Math.abs(info - 0.25) < 1e-6)
  })

  it('Fisher information is lower when θ is far from b', () => {
    const peak = fisherInformation(0, 0)
    const off = fisherInformation(2, 0)
    assert.ok(off < peak, `expected I(2,0) < I(0,0); got ${off} vs ${peak}`)
    assert.ok(off > 0, 'information is non-negative')
  })

  it('masteryToTheta / thetaToMastery round-trip', () => {
    for (const m of [0, 0.1, 0.5, 0.9, 1]) {
      const theta = masteryToTheta(m)
      const back = thetaToMastery(theta)
      assert.ok(Math.abs(m - back) < 1e-9, `m=${m} -> theta=${theta} -> ${back}`)
    }
  })

  it('probabilityCorrect clamps to a small epsilon to avoid log(0)', () => {
    const pHigh = probabilityCorrect(100, 0)
    const pLow = probabilityCorrect(-100, 0)
    assert.ok(pHigh > 0.99 && pHigh < 1)
    assert.ok(pLow > 0 && pLow < 0.01)
  })
})
