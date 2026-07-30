# MindMap - UI / Design System

> Apple-inspired design system. Product-first, quiet UI, a single accent, and a single press gesture.

---

## 1. Design Philosophy

MindMap is presented as a clean, premium productivity app. We take Apple's web design language as the primary reference: **SF Pro typography**, **Action Blue (#0066cc)** as the only accent, **white/parchment/neutral-black tiles** as the rhythm, and **hairline borders** instead of shadows. The UI recedes so the content (the Mind, the documents, the concepts) can speak.

### Anti-principles

- No decorative gradients.
- No shadows on UI chrome. The only shadow is reserved for product photography (not applicable here).
- No second accent color. Action Blue carries every interactive element.
- No uppercase micro-labels. Labels are small, gray, and sentence-case.
- No weight 500. The ladder is 300 / 400 / 600 / 700.
- No emoji in product copy (onboarding emoji is the user's choice, not our branding).
- No `text-xs` gray-on-grey disclaimers. If it matters, it's readable.

---

## 2. Typography

- **Display / Headlines:** SF Pro Display, weight 600, tight negative tracking.
- **Body / UI:** SF Pro Text, weight 400, 17px, line-height 1.47.
- **Fallback stack:** `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.

### Type scale

| Utility         | Size | Weight | Line height | Letter spacing | Use                   |
| --------------- | ---- | ------ | ----------- | -------------- | --------------------- |
| `text-hero`     | 56px | 600    | 1.07        | -0.28px        | Landing hero          |
| `text-display`  | 40px | 600    | 1.10        | -0.01em        | Section H1s           |
| `text-headline` | 34px | 600    | 1.18        | -0.023em       | Page titles           |
| `text-tagline`  | 21px | 600    | 1.19        | 0.014em        | Card headers          |
| `text-lead`     | 28px | 400    | 1.14        | 0.012em        | Large subcopy         |
| `text-[17px]`   | 17px | 400    | 1.47        | -0.022em       | Body, buttons, inputs |
| `text-sm`       | 14px | 400    | 1.43        | -0.014em       | Captions, metadata    |
| `text-xs`       | 12px | 400    | 1.0         | -0.012em       | Fine print            |

### Numbers

- Tabular figures (`font-variant-numeric: tabular-nums`) for percentages, counts, dates.

---

## 3. Color

```css
@theme {
  --color-bg: #ffffff;
  --color-bg-subtle: #fafafc;
  --color-bg-muted: #f5f5f7;
  --color-surface: #ffffff;
  --color-surface-raised: #fafafc;
  --color-nav: #000000;
  --color-tile-dark: #272729;

  --color-border: #e0e0e0;
  --color-border-strong: #d2d2d7;
  --color-border-subtle: #f0f0f0;

  --color-fg: #1d1d1f;
  --color-fg-muted: #6e6e73;
  --color-fg-subtle: #86868b;

  --color-primary: #0066cc;
  --color-primary-fg: #ffffff;
  --color-primary-hover: #005fb8;
  --color-primary-focus: #0071e3;
  --color-primary-on-dark: #2997ff;

  --color-success: #34c759;
  --color-warning: #ff9500;
  --color-danger: #ff3b30;
  --color-info: #0066cc;

  --color-mastery-0: #d2d2d7;
  --color-mastery-1: #7fb3e8;
  --color-mastery-2: #0066cc;
  --color-mastery-3: #30b455;
  --color-mastery-4: #34c759;
}
```

### Dark mode

```css
.dark {
  --color-bg: #000000;
  --color-bg-subtle: #111113;
  --color-bg-muted: #1c1c1e;
  --color-surface: #1c1c1e;
  --color-surface-raised: #2c2c2e;
  --color-border: #38383a;
  --color-fg: #ffffff;
  --color-fg-muted: #98989d;
  --color-primary: #2997ff;
}
```

---

## 4. Spacing

Apple's base unit is 8px. The MindMap app uses the existing 4px grid, so the two systems are compatible.

| Token  | Use                              |
| ------ | -------------------------------- |
| `4px`  | inline icon ↔ text               |
| `8px`  | tight grouping                   |
| `12px` | control padding                  |
| `16px` | element ↔ element                |
| `24px` | card internal padding            |
| `32px` | section gutters                  |
| `48px` | large section gaps               |
| `80px` | full-bleed tile vertical padding |

---

## 5. Radius

Apple's grammar:

- `rounded-md` (11px) - utility buttons, inputs, segmented controls.
- `rounded-lg` (18px) - cards, utility surfaces.
- `rounded-full` (pill) - primary CTAs, secondary-pill CTAs, search inputs, chips.
- `rounded-md` (8px) - small nav controls.
- `rounded-none` - full-bleed tiles (not used in-app).

---

## 6. Components

### Buttons

Primary CTAs are **blue pills**:

```jsx
<Button size="md">Primary</Button>
```

- `primary` - blue pill, white text, hover darker blue.
- `secondary` - ghost pill, blue border, blue text.
- `outline` - pearl capsule, hairline border, near-black text.
- `ghost` - transparent, gray text, hover bg-muted.
- `danger` - red pill.
- `link` - Action Blue text.

All buttons have `active:scale-95` as the system-wide press gesture.

### Inputs

- Height 44px (`h-11`).
- `rounded-md` (11px).
- 1px hairline border.
- Focus: 2px ring in `--color-primary-focus`.

### Cards

- White background, `rounded-lg` (18px), 1px hairline border.
- No shadow.
- Internal padding 24px (`p-6`).

### Segmented controls

- Track: `rounded-full` with `bg-[var(--color-bg-muted)]`.
- Active thumb: white surface, tiny shadow, semibold text.
- Used for theme picker, language picker, and map filters.

### Navigation

- **Global nav (marketing):** 44px black bar, white text, 12px nav links, blue pill CTA.
- **App sidebar:** parchment background, subtle selection, rounded-md active items.
- **App sub-nav:** frosted glass strip (`backdrop-blur-xl backdrop-saturate-150`, parchment 80%) with pill tabs.

### Badges

- Small pill, solid color.
- `accent` = Action Blue.
- `success` = Apple green.
- `danger` = Apple red.
- `warning` = Apple orange.

### Mastery / Progress

- `CalmProgress` uses Action Blue fill on a `bg-muted` track.
- `MasteryRing` uses the mastery ramp from chip-gray → blue → green.

---

## 7. Motion

- Framer Motion for layout/enter/exit.
- Default duration 250ms, ease `ease-in-out`.
- Button press: `scale(0.95)`.
- Layout transitions: `layout` prop.
- Reduced motion: collapse to instant opacity-only transitions.

---

## 8. Layout & Responsive

- Marketing: full-bleed alternating tiles (white → parchment → white → parchment).
- App: centered max-width containers (`max-w-3xl`, `max-w-5xl`), padded sections.
- Mobile: global header collapses, bottom tab bar with blue active indicator.

---

## 9. Accessibility

- Visible focus ring: 2px `--color-primary-focus` outline, 2px offset.
- Touch targets ≥ 44px (buttons are h-11).
- Color is never the sole information carrier - mastery rings include numeric labels and node size.
- `aria-live` regions for status updates.
- Lang attribute set per locale.

---

## 10. Copy & Tone

- Expert, calm, second-person.
- Sentence case in UI. Periods at end of sentences, none in button labels.
- Apple-style: short, direct, no exclamation marks.

---

## 11. PWA / Brand Assets

- `manifest.ts`: `background_color: #ffffff`, `theme_color: #0066cc`.
- `icon.svg`: Action Blue rounded rectangle with white "M" glyph.
- OG image: white background, near-black headline, Action Blue brand mark.

---

## 12. Source of Truth

Imported Apple DESIGN.md lives at the repo root: `/root/mindmap/DESIGN.md`.

---

## 13. RTL Readiness

The layout uses logical properties where relevant. Adding `dir="rtl"` later is a flip, not a refactor.
