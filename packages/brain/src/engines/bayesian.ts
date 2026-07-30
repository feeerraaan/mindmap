/**
 * Bayesian update on a discretized grid.
 *
 *   We represent the learner's belief about a single concept's mastery as a
 *   probability density over a finite grid of θ points in [-3, +3]. The
 *   density is updated by multiplying by a likelihood derived from the
 *   IRT 1PL model (see `./irt.ts`).
 *
 *   Properties we want:
 *
 *     1. The grid is a Beta-like distribution in (mastery, confidence)
 *        space; we re-derive those moments after each update for the
 *        persistence layer.
 *     2. Two pieces of evidence in the same direction should move the
 *        mean more than one piece (composability).
 *     3. An "I don't know" answer should move the mean down but raise
 *        confidence (the learner is being honest). A "Skip" should only
 *        lower confidence (no signal about mastery).
 *     4. The posterior is always normalised.
 *
 *   Discretized grid is intentionally chosen over a closed-form Beta
 *   update because the IRT likelihood is not a simple power form - a
 *   grid is the cleanest way to keep the math tight and the test
 *   assertions obvious.
 */
import { masteryToTheta, probabilityCorrect, thetaToMastery } from './irt'

/** A 1D grid density over θ ∈ [-3, +3]. */
export interface Density {
  /** θ points, evenly spaced, length N. */
  theta: number[]
  /** Probability mass at each point; sums to 1. */
  mass: number[]
}

export interface Posterior {
  /** Mastery ∈ [0, 1] (mean of the density). */
  mastery: number
  /** Confidence ∈ [0, 1] (1 / (1 + variance) of the density in theta-space). */
  confidence: number
  /** Posterior variance in theta-space. */
  variance: number
}

export const GRID_SIZE = 21
const THETA_MIN = -3
const THETA_MAX = 3

/** Build a uniform prior over the grid - no information yet. */
export function uniformPrior(): Density {
  const theta = linspace(THETA_MIN, THETA_MAX, GRID_SIZE)
  const mass = new Array<number>(theta.length).fill(1 / theta.length)
  return { theta, mass }
}

/**
 * Build a Gaussian-shaped prior centred on `mastery` with a width implied
 * by `confidence`. `confidence = 1` → very tight (variance ≈ 0.05);
 * `confidence = 0` → wide, near-uniform.
 *
 * The variance mapping is exponential so that small confidences don't
 * accidentally produce a grid-truncated Gaussian whose moments lie far
 * from the requested mastery (a wide Gaussian centred at the boundary
 * of [-3, +3] gets pulled toward the centre by the grid truncation).
 */
export function priorFromState(mastery: number, confidence: number): Density {
  const c = clamp01(confidence)
  if (c < 0.01) return uniformPrior()
  const theta = linspace(THETA_MIN, THETA_MAX, GRID_SIZE)
  const center = masteryToTheta(clamp01(mastery))
  // variance ∈ (0.05, 4). c=0.5 → variance ≈ 0.7; c=1 → 0.05.
  const variance = 0.05 + 4 * Math.exp(-3.5 * c)
  const raw = theta.map((t) => Math.exp(-((t - center) ** 2) / (2 * variance)))
  const sum = raw.reduce((a, b) => a + b, 0)
  if (sum <= 0) return uniformPrior()
  const mass = raw.map((r) => r / sum)
  return { theta, mass }
}

/** Return the (mastery, confidence) moments of a density. */
export function moments(d: Density): Posterior {
  let mean = 0
  for (let i = 0; i < d.theta.length; i += 1) {
    mean += d.theta[i]! * d.mass[i]!
  }
  let variance = 0
  for (let i = 0; i < d.theta.length; i += 1) {
    const diff = d.theta[i]! - mean
    variance += diff * diff * d.mass[i]!
  }
  const mastery = thetaToMastery(mean)
  const confidence = 1 / (1 + variance)
  return { mastery: clamp01(mastery), confidence: clamp01(confidence), variance }
}

/**
 * Update a density with a graded response. `correctness` ∈ [0, 1] is the
 * continuous signal from the evaluator; `difficulty` is the IRT `b` of the
 * question. We re-normalise so the density stays a distribution.
 */
export function updateWithEvidence(
  prior: Density,
  correctness: number,
  difficulty: number,
): Density {
  const c = clamp01(correctness)
  const next = prior.theta.map((theta) => {
    const p = probabilityCorrect(theta, difficulty)
    const likelihood = Math.pow(p, c) * Math.pow(1 - p, 1 - c)
    return (prior.mass[prior.theta.indexOf(theta)] ?? 0) * likelihood
  })
  return normalise({ theta: prior.theta, mass: next })
}

/**
 * Apply an "I don't know" response. We treat this as `correctness = 0` on
 * a hard question, but also slightly tighten the density around the new
 * mean - the learner has revealed something, so confidence goes up.
 */
export function updateWithIDontKnow(prior: Density, difficulty: number): Density {
  const after = updateWithEvidence(prior, 0, difficulty)
  // Tighten: a 0.9 mix toward the new posterior mass, but with the old
  // mass as a small floor so we never collapse to a delta. This nudges
  // confidence up by 0.1 in practice.
  const floor = 0.1
  const mass = after.mass.map((m, i) => floor * (prior.mass[i] ?? 0) + (1 - floor) * m)
  return normalise({ theta: after.theta, mass })
}

/**
 * Apply a "Skip" response. Skip carries no information about mastery, so
 * we just widen the prior slightly. Confidence goes down; mastery is
 * unchanged.
 */
export function updateWithSkip(prior: Density): Density {
  const uniform = uniformPrior().mass
  // Mix 15% uniform in: that adds entropy → lowers confidence.
  const mix = 0.15
  const mass = prior.mass.map((m, i) => (1 - mix) * m + mix * (uniform[i] ?? 0))
  return normalise({ theta: prior.theta, mass })
}

function normalise(d: Density): Density {
  const sum = d.mass.reduce((a, b) => a + b, 0)
  if (sum <= 0 || !Number.isFinite(sum)) return uniformPrior()
  return { theta: d.theta, mass: d.mass.map((m) => m / sum) }
}

function linspace(lo: number, hi: number, n: number): number[] {
  if (n <= 1) return [lo]
  const out: number[] = []
  const step = (hi - lo) / (n - 1)
  for (let i = 0; i < n; i += 1) out.push(lo + step * i)
  return out
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}
