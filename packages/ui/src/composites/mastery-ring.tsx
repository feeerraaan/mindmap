import { cn } from '../cn'

/**
 * MasteryRing — circular progress ring with the mastery value.
 *
 * Color follows the mastery ramp from `ui.md` §4 — perceptually uniform,
 * color-blind safe. Confidence is implied by ring opacity.
 */
export interface MasteryRingProps {
  /** Mastery ∈ [0, 1] */
  mastery: number
  /** Optional confidence ∈ [0, 1]; lower confidence = fainter ring. */
  confidence?: number
  size?: number
  className?: string
  showLabel?: boolean
}

const RAMP = [
  'var(--color-mastery-0)',
  'var(--color-mastery-1)',
  'var(--color-mastery-2)',
  'var(--color-mastery-3)',
  'var(--color-mastery-4)',
]

function colorForMastery(m: number): string {
  if (m < 0.2) return RAMP[0]!
  if (m < 0.4) return RAMP[1]!
  if (m < 0.6) return RAMP[2]!
  if (m < 0.8) return RAMP[3]!
  return RAMP[4]!
}

export function MasteryRing({
  mastery,
  confidence = 0.8,
  size = 56,
  className,
  showLabel = true,
}: MasteryRingProps) {
  const clamped = Math.max(0, Math.min(1, mastery))
  const stroke = 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped)
  const color = colorForMastery(clamped)
  const opacity = 0.4 + confidence * 0.6
  const pct = Math.round(clamped * 100)

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Mastery ${pct}%, confidence ${Math.round(confidence * 100)}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-border)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ opacity, transition: 'all 360ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      {showLabel ? (
        <span
          className="absolute text-xs font-semibold tabular-nums text-[var(--color-fg)]"
          data-num
        >
          {pct}
        </span>
      ) : null}
    </div>
  )
}
