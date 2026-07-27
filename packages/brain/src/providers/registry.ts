/**
 * Provider registry. Looks up an adapter by id. The first call wires up the
 * real providers; tests can override via `setProviderRegistry`.
 *
 * Set `BRAIN_DEMO_MOCK=1` to swap the real `zen` provider for a
 * canned-script mock. The mock is useful for offline demos and
 * integration tests; the production path always uses the real
 * OpenCode endpoints.
 */
import type { ProviderId } from '@mindmap/types'
import type { ProviderAdapter } from './provider'
import { goAdapter, zenAdapter } from './zen'
import { demoMockProvider } from './demo-mock'

let registry: Map<ProviderId, ProviderAdapter> | null = null

function isDemoMode(): boolean {
  return process.env.BRAIN_DEMO_MOCK === '1'
}

function buildDefaultRegistry(): Map<ProviderId, ProviderAdapter> {
  if (isDemoMode()) {
    const demo = demoMockProvider()
    return new Map<ProviderId, ProviderAdapter>([
      [demo.id, demo],
      ['go', goAdapter()],
    ])
  }
  const zen = zenAdapter()
  const go = goAdapter()
  return new Map([
    [zen.id, zen],
    [go.id, go],
  ])
}

export function getProvider(id: ProviderId): ProviderAdapter {
  if (!registry) registry = buildDefaultRegistry()
  const a = registry.get(id)
  if (!a) throw new Error(`No provider registered for id "${id}"`)
  return a
}

export function listProviders(): ProviderAdapter[] {
  if (!registry) registry = buildDefaultRegistry()
  return [...registry.values()]
}

/** Tests and the in-process bootstrap path use this to inject fakes. */
export function setProviderRegistry(map: Map<ProviderId, ProviderAdapter>): void {
  registry = map
}

export function resetProviderRegistry(): void {
  registry = null
}
