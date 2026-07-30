/**
 * IRT 1PL (Rasch) math.
 *
 * Mastery θ ∈ [-3, +3] (mapped from [0,1] for storage via {@link masteryToTheta}).
 * Item difficulty b ∈ [-3, +3].
 *
 *   P(correct | θ, b) = 1 / (1 + exp(-(θ - b)))
 *
 * Fisher information for a 1PL item collapses to:
 *
 *   I(θ, b) = P(θ, b) * (1 - P(θ, b))
 *
 * It is maximised at θ = b, where P = 0.5 and I = 0.25. That is why the
 * scheduler tries to pick items whose difficulty is at the learner's
 * current estimate.
 *
 * Everything here is pure math - no LLM, no DB.
 */

const THETA_MIN = -3
const THETA_MAX = 3

/** Map a UI-friendly mastery ∈ [0,1] to the IRT theta ∈ [-3,+3]. */
export function masteryToTheta(mastery: number): number {
  const m = clamp01(mastery)
  return THETA_MIN + m * (THETA_MAX - THETA_MIN)
}

/** Inverse of {@link masteryToTheta}. */
export function thetaToMastery(theta: number): number {
  const t = clamp(theta, THETA_MIN, THETA_MAX)
  return (t - THETA_MIN) / (THETA_MAX - THETA_MIN)
}

/**
 * Probability of a correct response under the 1PL model. Returns a value in
 * (0, 1); the hard clamp keeps it strictly away from 0/1 so Bayesian
 * updates with `correctness` in (0, 1) never divide by zero.
 */
export function probabilityCorrect(theta: number, difficulty: number): number {
  const p = 1 / (1 + Math.exp(-(theta - difficulty)))
  return clamp(p, 1e-6, 1 - 1e-6)
}

/**
 * Fisher information at a given (theta, b) point. For 1PL, this is the
 * single-item information - the expected squared score of the score
 * function. Maximised at θ = b.
 */
export function fisherInformation(theta: number, difficulty: number): number {
  const p = probabilityCorrect(theta, difficulty)
  return p * (1 - p)
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0
  return clamp(x, 0, 1)
}

function clamp(x: number, lo: number, hi: number): number {
  if (x < lo) return lo
  if (x > hi) return hi
  return x
}
