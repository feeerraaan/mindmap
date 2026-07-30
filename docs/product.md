# MindMap - Product Requirements Document

> Status: v0.1 (hackathon baseline + 6-month stretch). Each section cross-references
> acceptance criteria under `## Acceptance Criteria` and phased delivery in `roadmap.md`.

---

## 1. Personas

### P1 - "Marta" - the high-stakes self-learner

28, medical resident. Has 400-page PDFs. Studies nights. Hates Anki because curating
cards is a second job. Wants: _tell me what I don't know before the exam tells me._

### P2 - "David" - the curious professional

34, software architect. Reads 2 books / month. Forgets 80%. Wants: _a map of what
actually stuck, not what I felt stuck._

### P3 - "The Judge" - hackathon evaluator

Time-boxed. Will abandon if anything feels broken, slow, or confusing in the first 60 seconds.

---

## 2. End-to-End User Journey

```
Landing ─────────────────────────────────────────────► Authentication (Google / magic email)
   │                                                              │
   │  Calm hero. One CTA. No pricing wall.                        ▼
   │                                                  Onboarding (3 delightful steps)
   │                                                              │
   │                                                              ▼
   │                                                  Workspace (= "Your Mind")
   │                                                              │
   │                                                              ▼
   │                                                  Upload documents (PDF/PPTX/DOCX)
   │                                                              │
   │                                                              ▼
   │                                                  AI Processing  (extraction → graph build)
   │                                                              │
   │                                                              ▼
   │                                                  Adaptive Diagnosis  (SSE, IRT-driven)
   │                                                              │
   │                                                              ▼
   │                                                  Knowledge Map  (interactive graph)
   │                                                              │
   │                                                              ▼
   │                                                  Review Timeline  (personalized SRS)
```

---

## 3. Functional Requirements by Feature

Priorities use **Must / Should / Could / Won't** (MoSCoW). Each feature has an ID
(`F-XX`) referenced by `roadmap.md` and `architecture.md`.

### F-01 Authentication

- **Must** Google OAuth
- **Must** Magic-link email (Resend) - no passwords ever
- **Must** Session is httpOnly cookie, Better Auth
- **Should** Remember "where I was going" post-login (`?callbackPath=`)
- **Won't** Username/password; SMS; SSO enterprise

**Acceptance** A new user can sign in via Google in ≤2 clicks and land on onboarding or
their last workspace without ever typing a password.

### F-02 Onboarding

- **Must** 3 steps: ① what are you studying for? ② pick a friendly confidence level
  (visual slider mapped to a calibration prior) ③ name your Mind (workspace)
- **Must** Skippable - every step has a "Not now" path with sensible defaults
- **Must** Page transitions animated with Framer Motion; progress bar is a thin line,
  not a 12-dot stepper
- **Should** Copy adapts to the chosen use-case ("retiring resident" vs "curious dev")
- **Won't** A form with labels. This is a _moment_, not data entry.

**Acceptance** A P3 (judge) completes onboarding in <40s and lands on an empty Workspace
that already feels personalized by name.

### F-03 Workspace ("Your Mind")

- **Must** Empty state is a _destination_, not an error. Copy + single upload affordance.
- **Must** Lists documents with status badges: `Queued → Parsing → Graphing → Ready → Diagnosing → Mapped`
- **Must** Each doc card opens its Knowledge Map
- **Should** Aggregate "Overview Map" merges concepts across docs (Horizon 2)

**Acceptance** Status badges reflect real backend state via React Query polling (≤2s
intervals during active transitions, paused when tab hidden).

### F-04 Document Upload & Processing

- **Must** Drag-drop + click-browse, multi-file, max 25 MB / file, max 5 concurrent
- **Must** Formats: `.pdf`, `.pptx`, `.docx` - rejected others with a calm inline message
- **Must** Extraction → chapter/topic/concept identification → relationship graph,
  fully server-side, never touching the UI components
- **Should** Re-use parser for `.txt`, `.md`, `.html`, `.epub` (architecture must allow
  it; enable flag in phase 3)
- **Won't** OCR of scanned PDFs in MVP (flagged + graceful "we can't read this" message)

**Acceptance** Uploading a 30-page textbook PDF reaches `Ready` (graph built) in ≤90s
median on the hackathon infra; user sees a streaming progress narrative, not a spinner.

### F-05 Brain - Knowledge Graph Construction

- **Must** For each document, produce a DAG of: `Chapter → Topic → Concept`
- **Must** Each `Concept` carries: `id`, `title`, `summary`, `importance ∈ [0,1]`,
  `dependencies: ConceptId[]`, `estimatedDifficulty ∈ [0,1]`
- **Must** Stored in Postgres (`Concept`, `ConceptDependency`) - not in the LLM output blob
- **Must** Cheap-model task (Zen + DeepSeek-Flash) - see `brain.md`
- **Won't** Ask any questions during this phase. Pure understanding.

**Acceptance** A 50-concept graph uploads; ≥90% of concepts parse to a valid title +
summary; the dependency set is acyclic (validator rejects cycles, retries silently).

### F-06 Brain - Adaptive Diagnosis

- **Must** Driven by item-response theory (IRT 1PL) selecting the next concept to probe
  for **maximum information gain**
- **Must** Easy concepts → simple validation MCQs; hard concepts → open reasoning prompts
  graded by the powerful model
- **Must** Each answer updates the per-concept `(mastery, confidence, attempts, lastSeen)`
- **Must** Each answer updates the _neighbor_ concepts via dependencies (Bayesian-ish propagation)
- **Must** Streaming UI via SSE, with automatic fallback to polling on 2x connection loss
- **Must** Stopping rule: terminate when global `confidence ≥ τ_conf` (default 0.7) OR
  `questionsAsked ≥ q_max` (default 20) - both admin-tunable
- **Should** "I don't know" / "Skip" are first-class answers and carry information
  (lower confidence _and_ lower mastery estimate)
- **Won't** Fixed question banks. **Every question is generated.**

**Acceptance** A 30-concept doc completes diagnosis in ≤12 questions median; the map's
mastery values for probed vs unprobed concepts differ by ≥0.15 (probing has signal).

### F-07 Knowledge Map

- **Must** Interactive DAG rendered with `react-flow`
- **Must** Each node shows: mastery (color/size), confidence (ring opacity),
  priority (badge), dependencies (edges)
- **Must** Click a node → side panel with full state + "Review recommendation"
- **Must** Filter: "What I know", "What I think I know", "What I don't", "About to forget"
- **Should** Re-layout animation when filters change (Framer Motion layout transitions)
- **Won't** 3D, WebGL, or physics-based hair-pulling - clarity over flash

**Acceptance** A 60-concept map draws in ≤1.5s; pan/zoom stays ≥60fps on a 2020 mid-range
laptop; the four filters visually partition with no overlapping clutter.

### F-08 Review Timeline

- **Must** Generate per-concept review sessions at spaced intervals
- **Must** Interval adapts to user history (`attempts`, `lastMasteryDelta`),
  **not** a generic SM-2 curve
- **Must** Each session is a short (≤10 question) adaptive re-diagnosis
- **Must** Daily view: "Today's review" + "Upcoming"
- **Should** PWA push reminder (opt-in only, calm copy)
- **Won't** Streaks, XP, badges, leaderboards - violates `vision.md` §5.4

**Acceptance** After diagnosis, the engine schedules ≥1 review within 24h; missed reviews
do not "double" punitively - intervals soften, never stack.

### F-09 Settings

- **Must** Account (email, sign out, delete account + data export - GDPR-ready)
- **Must** Language: EN / ES
- **Should** Theme: system / light / dark
- **Should** Calibration prior editing (advanced users)
- **Won't** Notification rules UI in MVP

### F-10 PWA

- **Must** Installable; manifest + service worker (next-pwa)
- **Must** Offline-cached: Workspace list, last opened Knowledge Map (read-only)
- **Must** App icon, theme color, maskable
- **Won't** Offline upload or offline diagnosis

### F-11 Landing Page

- **Must** Hero + 3-step explainer + a single CTA → auth
- **Must** SEO-tuned: OG image, JSON-LD `SoftwareApplication`, static-rendered
- **Should** Live mini-demo embed (an animated knowledge map loop, no auth)

---

## 4. Non-Functional Requirements

| Category      | Requirement                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Performance   | LCP ≤2.5s on Landing (4G slow); TTI Knowledge Map ≤3s; upload→ready ≤90s median                |
| Accessibility | WCAG 2.2 AA; keyboard-navigable map; color-blind-safe palette                                  |
| Security      | All AI calls server-side; no provider key touches client ever; uploads signed-URL only         |
| Privacy       | Document text never persisted to third-party LLM provider logs; enable provider "no-log" flags |
| i18n          | EN default, ES secondary, unlimited-ready (next-intl ICU)                                      |
| Mobile        | Mobile-first design, but upload/diagnosis recommended on desktop                               |
| Resilience    | SSE falls back to polling; parser failures are transparent, not hidden                         |
| Observability | Structured logs + error tracking (Sentry-ish, provider TBD by phase 7)                         |

---

## 5. MVP Definition (hackathon scope)

**In:** F-01, F-02 (desktop), F-03, F-04, F-05, F-06, F-07, F-08, F-09,
F-10, F-11.

**Out of MVP (deferred to roadmap Horizon 2+):** collaborator maps, mobile-native,
OCR, multi-doc aggregate maps, billing / subscriptions, push notifications.

---

## 6. Acceptance Criteria - Compiled Across Features

The deliverable is "done" when, on a fresh Vercel preview deploy + fresh Neon branch,
a brand-new Google account can:

1. Sign in <5s, complete onboarding <40s.
2. Upload a 20–50pp PDF and watch a streaming progress narrative (no spinners alone).
3. Within 90s, see a Knowledge Map with ≥20 nodes.
4. Complete an adaptive diagnosis in ≤12 questions median.
5. See the map's mastery values shift visibly post-diagnosis.
6. See one scheduled review in the Timeline within 24h.
7. Toggle ES UI; all strings localize.
8. Install as PWA; relaunch offline shows Workspace list.
9. Read no console errors and no `any` types during `pnpm typecheck && pnpm lint && pnpm build`.

---

## 7. Future Ideas (parking lot - not built in MVP)

- "Diagnose together": peer comparison of knowledge states, privacy-preserving
- Embed-and-ask: bring any YouTube video / podcast transcript as a doc
- "Reverse map": given a target job description, diagnose gap to it
- Plugin marketplace for educator-authored diagnostic packs
- Knowledge state portability: export → import across MindMap accounts / institutions
