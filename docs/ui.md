# MindMap — UI / Design System

> Calm. Premium. Honest. Every pixel earns its place. Every animation has a purpose.

---

## 1. Design Philosophy

MindMap is a clinic, not a casino. The UI must feel like the medical equipment in a
premium specialist's office: precise, quiet, reassuring. We take inspiration from
**Linear** (motion density), **Notion** (text-as-UI), **Raycast** (command density),
**Apple** (restraint), **Vercel** (type & whitespace), and **Arc Browser** (delight in
transitions).

### Anti-principles (what we do NOT do)

- No streaks, no XP, no confetti.
- No red urgency. Errors are calm, blue-grey, actionable.
- No modal stacking. One focus at a time.
- No "Are you sure?" on safe actions; "Are you sure?" only on destructive ones, and it
  says what will happen, not "Confirm".
- No emoji in product copy (onboarding emoji is the user's choice, not our branding).
- No `text-xs` grey-on-grey disclaimers. If it matters, it's readable.

---

## 2. Spacing

A 4px base grid. The scale is **geometric (×2 every two steps)** to give clear jumps:

| Token | px | Use |
|------|----|----|
| `space-0` | 0 | — |
| `space-1` | 4 | inline icon ↔ text |
| `space-2` | 8 | tight grouping |
| `space-3` | 12 | control padding (default) |
| `space-4` | 16 | element ↔ element |
| `space-6` | 24 | group ↔ group |
| `space-8` | 32 | section ↔ section |
| `space-12` | 48 | page-level rhythm |
| `space-16` | 64 | hero spacing |
| `space-24` | 96 | landing section spacing |

Implemented as CSS variables in Tailwind v4's `@theme`:

```css
@theme {
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  /* ... */
}
```

`Tailwind` utilities `p-3`, `gap-6`, `mt-8` map to these.

---

## 3. Typography

- **Sans:** Geist Sans (via `next/font/google`, self-hosted, no FOUT).
- **Mono:** Geist Mono (for numbers, status codes, code samples).
- **No serif.** A serif would imply editorial warmth; MindMap is clinical.

### Type scale (modular, 1.125 ratio)

| Token | rem (16px base) | Use |
|------|------|----|
| `text-xs` | 0.75 | metadata, timestamps |
| `text-sm` | 0.875 | secondary text, table cells |
| `text-base` | 1 | body |
| `text-lg` | 1.125 | lead paragraph |
| `text-xl` | 1.25 | card titles |
| `text-2xl` | 1.5 | section H3 |
| `text-3xl` | 1.875 | section H2 |
| `text-4xl` | 2.25 | page H1 |
| `text-5xl` | 3 | landing hero |
| `text-6xl` | 3.75 | landing display (used sparingly) |

### Line heights

- Body: `leading-relaxed` (1.625) — reading comfort for explanations.
- Headings: `leading-tight` (1.2).
- UI text: `leading-normal` (1.5).

### Weight

- Two weights only: **400** (body), **600** (emphasis / headings / buttons).
- No 300 (too thin on low-DPI), no 700+ (too shouty).

### Numbers

- Tabular figures (`font-variant-numeric: tabular-nums`) for any mastery %, confidence,
  token counts — so they don't jitter as they update.

---

## 4. Color

### Base palette (HSL-based, single hue family per role)

A near-neutral, slightly cool grey base (Linear/Vercel-like) with a single accent.

```css
@theme {
  /* Neutrals — cool grey */
  --color-bg:                  hsl(0 0% 100%);       /* light bg */
  --color-bg-subtle:           hsl(210 20% 99%);
  --color-bg-muted:            hsl(210 20% 97%);
  --color-surface:             hsl(0 0% 100%);
  --color-surface-raised:      hsl(210 20% 98%);
  --color-border:              hsl(210 16% 90%);
  --color-border-strong:       hsl(210 16% 82%);
  --color-fg:                  hsl(210 24% 16%);
  --color-fg-muted:            hsl(210 12% 45%);
  --color-fg-subtle:           hsl(210 10% 60%);

  /* Accent — calm teal (clinical, premium, color-blind safe) */
  --color-accent:              hsl(186 72% 38%);
  --color-accent-fg:           hsl(186 80% 98%);
  --color-accent-hover:        hsl(186 72% 32%);

  /* Semantic — desaturated, never shouty */
  --color-success:             hsl(152 50% 38%);
  --color-warning:             hsl(38 80% 45%);
  --color-danger:              hsl(0 60% 52%);
  --color-info:                hsl(210 70% 45%);
}
```

### Dark mode (preferred by target audience — self-learners study at night)

```css
.dark {
  --color-bg:                  hsl(210 24% 8%);
  --color-bg-subtle:           hsl(210 24% 10%);
  --color-bg-muted:            hsl(210 24% 13%);
  --color-surface:             hsl(210 24% 11%);
  --color-surface-raised:      hsl(210 24% 14%);
  --color-border:              hsl(210 16% 22%);
  --color-border-strong:       hsl(210 16% 30%);
  --color-fg:                  hsl(210 30% 96%);
  --color-fg-muted:            hsl(210 12% 70%);
  --color-fg-subtle:           hsl(210 10% 50%);

  --color-accent:              hsl(186 70% 50%);
  --color-accent-fg:           hsl(186 80% 8%);
  --color-accent-hover:        hsl(186 70% 58%);

  --color-success:             hsl(152 50% 50%);
  --color-warning:             hsl(38 85% 55%);
  --color-danger:              hsl(0 60% 60%);
  --color-info:                hsl(210 70% 60%);
}
```

### Mastery color ramp (Knowledge Map nodes)

A **perceptually uniform, color-blind safe** ramp from cool-grey (unknown) to teal
(known), avoiding red/green confusion:

```
0.0  hsl(210 12% 75%)   // unknown — cool grey
0.25 hsl(195 30% 65%)   // barely
0.5  hsl(186 50% 52%)   // partial — teal mid
0.75 hsl(172 55% 42%)   // solid
1.0  hsl(160 60% 35%)   // mastered — deep green-teal
```

Confidence is rendered as **node ring opacity** (low confidence = faint ring), not as
another color — avoiding double-encoding on the same channel.

### Why teal, not blue or purple?

- Blue is overused by tech (Vercel, Twitter, Linear-ish) and reads generic.
- Purple reads "AI magic" — MindMap is *not* a magic-wand product, it's diagnostic.
- Teal sits between clinical blue and calm green; rare enough to be ownable; passes
  WCAG AA on both light and dark backgrounds at the chosen saturation.

---

## 5. Components (shadcn/ui-based)

`packages/ui` re-exports and themes shadcn/ui primitives. We add MindMap-specific
composites on top.

### Primitives (shadcn, themed)

Button, Input, Textarea, Select, Label, Card, Dialog, Sheet, Tabs, Tooltip, Toast,
ScrollArea, Separator, Skeleton, Avatar, Badge, Progress, Switch, Checkbox, RadioGroup,
DropdownMenu, Popover, AlertDialog.

### Composites (MindMap-specific, in `packages/ui/composites/`)

| Component | Purpose |
|-----------|---------|
| `<CalmProgress>` | Thin progress line; no percentage by default; subtle pulse |
| `<StatusBadge>` | Maps `DocumentStatus` enum → label + dot color |
| `<ConceptNode>` | react-flow node for the Knowledge Map |
| `<MasteryRing>` | Circular progress ring with tabular mastery % |
| `<EmptyState>` | Calm empty states with one affordance, never an error look |
| `<DiagnosisCard>` | Single question card; MCQ or free-text variant |
| `<TimelineDay>` | A day in the review timeline; list of ReviewItems |
| `<CouponInput>` | Single-field "Redeem coupon" with inline validation |
| `<LocaleSwitch>` | EN / ES segmented control |
| `<MindHeader>` | Workspace header with name + emoji + status |

### Component rules

- **Props in, events out.** No data fetching inside `packages/ui`.
- All interactive components accept `className` (merged via `cn`).
- All composites have a Storybook story (phase 8) — but we keep stories out of the
  runtime bundle.
- All copy is **externalized** — components accept labels as props or read from
  `next-intl` `useTranslations` only in `apps/web`, never inside `packages/ui`.

---

## 6. Motion

Framer Motion. **Motion density must stay low** — Linear, not Apple Keynote.

### Duration tokens

| Token | ms | Use |
|------|----|----|
| `instant` | 80 | hover, focus state |
| `quick` | 150 | button press, toggle |
| `base` | 220 | default transition (enter/exit, layout) |
| `slow` | 360 | page transitions, map layout reflow |
| `deliberate` | 600 | mastery fill animation on map completion |

### Easing

- Default: `[0.22, 1, 0.36, 1]` (out-expo-ish, calm).
- Enter from below: `translateY(8px) → 0` + opacity `0 → 1` over `base`.
- Exit: opacity only, `quick`. Never move on exit (jarring).
- Layout transitions: `layout` prop on Framer Motion with `base` duration.

### Specific motion choices

- **Onboarding step transitions:** horizontal slide + crossfade, `slow`. Feels like
  flipping a card, not navigating a form.
- **Document status changes:** the status badge crossfades; no positional move (the
  card stays put — predictability matters).
- **Diagnosis question → answer micro-feedback:** a 1-line fade-in below the question,
  `quick`, then the next question slides in from the right (`base`).
- **Knowledge Map completion:** nodes fade from grey to their mastery color in a
  staggered cascade (50ms per node, capped at 1.5s total) — this is the product's
  hero moment, the only place we allow slightly more motion.
- **No parallax, no spring bounce on scroll.** The clinic metaphor forbids it.

### Reduced motion

`@media (prefers-reduced-motion: reduce)` → all transitions collapse to instant opacity
fades only. Tested in phase 8.

---

## 7. Accessibility (WCAG 2.2 AA target)

- All interactive elements are keyboard reachable; visible focus ring (2px accent
  outline, never removed).
- Color is never the sole carrier of information — node mastery is shown by **ring
  size + label** in addition to color.
- `aria-live="polite"` on diagnosis feedback and on document status updates.
- Touch targets ≥44×44px (mobile).
- All form fields have associated `<label>`; errors are `aria-describedby` linked.
- Knowledge Map: keyboard navigation via react-flow's built-in arrow-key graph
  traversal; each node is a `button` with an accessible name (`concept title +
  mastery%`).
- Lang attribute set per locale on `<html>`; next-intl handles this.
- Tested with `axe-core` in CI (phase 8) and a manual VoiceOver pass on the diagnosis
  flow before launch.

---

## 8. Iconography

- **Lucide** (matches shadcn default; consistent stroke width 1.5).
- No filled icons except in mastery rings.
- No emoji in UI chrome (allowed only as user-set workspace emoji).
- Icon ↔ text gap: `space-2`.
- Icon size: 16px (inline), 20px (in buttons), 24px (in headers), 32px (in empty
  states).

---

## 9. Layout & Responsive

### Breakpoints

| Name | min-width | Target |
|------|-----------|--------|
| `sm` | 640 | large phone landscape |
| `md` | 768 | tablet |
| `lg` | 1024 | laptop |
| `xl` | 1280 | desktop |
| `2xl` | 1536 | wide |

### Mobile-first philosophy

- Every page is designed mobile-first, then enhanced upward.
- The **Knowledge Map** is the one exception: it's desktop-recommended. On mobile, we
  show a **vertical concept list** with the same mastery/confidence encoding, and a
  "Open the full map on a larger screen" hint. Forcing a 60-node graph onto a phone
  is anti-calm.
- Navigation: bottom tab bar on `< md`, sidebar on `≥ md`.

### Containers

- Marketing: `max-w-5xl` centered, generous `px-6`.
- App: full-bleed with a fixed-width sidebar (`w-60` on `lg`, collapsible on `md`).
- Reading content (diagnosis explanations): `max-w-2xl` centered.

### Density

- App is **comfortable density** by default. A future "compact" preference is
  architecture-ready (a `density` flag) but not built in MVP — premature.

---

## 10. Empty & Error States

### Empty states (the most under-designed surface in most apps — we treat them as prime)

Every empty state has:
1. A single calm sentence describing what *will* be here.
2. A single primary affordance.
3. No illustration of a sad person or empty box. We use a small geometric mark in
   `--color-fg-subtle` — restraint.

Examples:
- "No documents yet. Drop a PDF to begin." + upload affordance.
- "You haven't been diagnosed on this Mind. Diagnose to see your map."
- "No reviews due today. Take a breath." (literally — calm copy matters)

### Error states

- **Recoverable (network, parse fail):** inline calm card, blue-grey, "We couldn't
  process this file. Try a different one, or continue without it." + retry.
- **Auth required:** redirect to `/sign-in?callbackPath=...`, never a 403 page.
- **Budget exceeded:** "Your Mind is resting for today. Come back tomorrow, or upgrade
  to Pro for more." — *never* "Error 429".
- **Fatal (5xx):** Next `error.tsx` boundary, calm "Something went wrong on our side.
  We've been notified." + a "Reload" button. No stack traces, no error codes.

---

## 11. Copy & Tone

- **Voice:** expert, calm, second-person, never enthusiastic. Closer to a thoughtful
  doctor than a coach.
- "Let's check what you know about X" not "Get ready to ace your exam!"
- "We couldn't read this PDF" not "Oops! Something went wrong 🤖".
- Sentence case in UI (not Title Case). Periods at the end of empty-state sentences,
  no periods in button labels.
- Spanish translations match tone — not literal. "Tu Mente" not "Su Mente" (informal
  `tú` — matches the audience: adult self-learners, not corporate).

---

## 12. Loading States

- **Skeletons** for full-page loads (Workspace list, Map structure).
- **CalmProgress** for known-duration work (parse, diagnosis).
- **Inline shimmer** for small card content.
- **Never** a generic full-screen spinner. If we don't know what's loading, we don't
  show progress — we show a calm empty state with the expected next state.

### The "Mind is thinking" state

During AI calls, instead of a spinner we show a slow-pulsing accent dot + a one-line
status ("Reading chapter 3…", "Composing a question about mitosis…"). This converts
wait time into perceived competence — the same trick Linear uses for "Syncing".

---

## 13. PWA Considerations

- `manifest.ts` with maskable icons (192/512), `theme_color` = accent, `display:
  standalone`.
- Splash color: `--color-bg` (matches first paint, no flash).
- Offline-cached routes: Workspace list + last opened Map (read-only).
- Install prompt: a subtle "Install MindMap" item in Settings — never a banner
  hijacking the screen.

---

## 14. RTL Readiness (future)

Even though MVP ships EN + ES (both LTR), the layout uses **logical properties**
(`ps-`, `pe-`, `ms-`, `me-`) instead of `pl-`/`pr-` wherever it matters, so adding
Arabic/Hebrew later is a `dir="rtl"` flip, not a refactor. Tracked as a phase-8
acceptance criterion for the design system.