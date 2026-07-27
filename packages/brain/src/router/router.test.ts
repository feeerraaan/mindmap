import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { setProviderRegistry, resetProviderRegistry } from '../providers/registry'
import { mockProvider } from '../providers/mock'
import { pickRoute, resetBudgets, candidatesFor, availableProviderCount } from '../router'
import type { ProviderAdapter } from '../providers/provider'

describe('router', () => {
  it('candidatesFor returns a non-empty list for extract.structure', () => {
    const list = candidatesFor('extract.structure')
    assert.ok(list.length > 0, 'should have at least one candidate')
    assert.equal(list[0]?.provider, 'go')
  })

  it('candidatesFor returns go first for reason.diagnose and keeps zen as fallback', () => {
    const list = candidatesFor('reason.diagnose')
    assert.ok(list.length >= 2, 'should have a primary + fallback')
    assert.equal(list[0]?.provider, 'go')
    const zenIdx = list.findIndex((c) => c.provider === 'zen')
    assert.ok(zenIdx > 0, 'zen should appear as a later fallback')
  })

  it('pickRoute returns BudgetExceeded when no provider is available', () => {
    resetBudgets()
    const fake: ProviderAdapter = mockProvider({ id: 'zen', available: false })
    setProviderRegistry(
      new Map([
        ['zen', fake],
        ['go', mockProvider({ id: 'go', available: false })],
      ]),
    )
    const d = pickRoute({ userId: 'u1', task: 'classify.language' })
    assert.equal(d.ok, false)
    if (!d.ok) assert.equal(d.error.kind, 'BudgetExceeded')
    assert.equal(availableProviderCount(), 0)
    resetProviderRegistry()
  })

  it('pickRoute succeeds when at least one provider is available', () => {
    resetBudgets()
    const fake = mockProvider({
      id: 'zen',
      available: true,
      defaultText: '{"language":"en","confidence":1}',
    })
    setProviderRegistry(
      new Map([
        ['zen', fake],
        ['go', mockProvider({ id: 'go', available: false })],
      ]),
    )
    const d = pickRoute({ userId: 'u2', task: 'classify.language' })
    assert.equal(d.ok, true)
    if (d.ok) {
      assert.equal(d.value.provider, 'zen')
      assert.ok(d.value.model.length > 0)
    }
    resetProviderRegistry()
  })
})
