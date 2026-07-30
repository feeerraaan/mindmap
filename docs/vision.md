# MindMap - Product Vision

> An MRI scan for knowledge. Not an assistant. Not a summarizer. A diagnostic.

---

## 1. Mission

MindMap helps people **discover the truth about what they know**.

Most learning tools optimize for _producing_ - more flashcards, more summaries, more
quizzes. MindMap optimizes for _understanding_ - building a precise, honest model of a
learner's knowledge state, then making that model visible and actionable.

We believe the highest-leverage moment in learning is not the moment you study.
It is the moment you realize **you didn't actually know what you thought you knew**.
MindMap manufactures that moment, repeatedly, calmly, and with beauty.

---

## 2. Why Now

| Force                            | Signal                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| LLM cost collapse                | DeepSeek-class models make per-user adaptive diagnosis economically viable for the first time |
| Reasoning models (MiMo 2.5 tier) | Adaptive Socratic probing is finally good enough to feel human, not robotic                   |
| AI-fatigue among learners        | The market is saturated with summarizers; users distrust "AI that does the work for me"       |
| Spaced-repetition stagnation     | Anki/Quizlet still use a 1985 forgetting curve applied identically to every item              |
| Visual thinking renaissance      | Tools like Linear, Notion, Arc proved that calm, premium, visual UIs retain serious users     |

MindMap sits at the intersection: **diagnostic AI meets premium visual UX**.

---

## 3. Target Audience

### Primary

**Autonomous adult learners** (22–40) preparing for high-stakes exams - medical
residents, bar candidates, CFA candidates, software engineers studying for system
design / leetcode interviews, language learners at B2+ plateau.

### Secondary

**Curious professionals** who read books, take courses, and want a honest map of what
actually stuck - not what they _feel_ stuck.

### Tertiary (post-MVP)

**Educators and teams** who want a diagnostic layer over their existing material.

### Explicitly NOT the audience (phase 1)

- Children / K-12 (compliance burden, parent-gating)
- Enterprise LMS replacement (wrong sales motion for a hackathon-born product)

---

## 4. Competitive Landscape

| Tool                    | What they do                     | Where MindMap wins                                                       |
| ----------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| Anki / Quizlet          | User-curated SRS flashcards      | MindMap auto-builds _and_ diagnoses; no manual card authoring            |
| ChatGPT / NotebookLM    | Summarize / chat about documents | MindMap is diagnostic, not generative - it never "does the work for you" |
| Quizgecko / Vaia        | Generate quizzes from uploads    | MindMap's questions adapt per-answer (IRT), not static MCQs              |
| Khanmigo / Duolingo Max | Tutor inside a closed curriculum | MindMap is open-input: bring _your_ material                             |
| Rosebud / Reflect       | Knowledge-graph note tools       | MindMap is diagnostic-first, not note-taking-first                       |

### Defensible moats (in order of importance)

1. **The Knowledge State Model** - proprietary per-concept `(mastery, confidence, lastSeen)`
   representation updated via IRT + Bayesian updates. Compounds with usage. Hard to copy
   without rebuilding the evaluation engine.
2. **Diagnostic prompt library** - months of iteration on Socratic probing prompts that
   elicit honest reasoning, not bluffing. Lives in `packages/brain` + `packages/prompts`.
3. **Provider-independent routing** - switching from Zen/DeepSeek-Flash to a future
   cheaper/better model is a config change, not a rewrite.
4. **Premium UX as distribution** - beautiful products earn organic shares. Anki doesn't.

---

## 5. Core Principles

These principles are non-negotiable. Any feature that violates one is rejected at the
design stage, no matter how requested.

1. **Diagnosis, not generation.** MindMap never writes the answer for the user. It
   reveals what they know. (Anti-pattern: "generate a model answer" buttons.)
2. **Minimum questions, maximum confidence.** Every question must increase information
   about the knowledge state. If it doesn't, the engine must suppress it.
3. **Honesty over flattery.** Mastery estimates trends downward when warranted. We
   never inflate to make the user feel good. Trust is the product.
4. **Calm by default.** No streaks shaming, no red urgency, no notifications at 11pm.
   The product should feel like a clinic, not a casino.
5. **Premium in every detail.** Animation, type, spacing, copy, empty states - all must
   feel intentional. A rushed empty state undermines the entire trust contract.
6. **Provider-independent intelligence.** No provider is special. The Brain never leaks
   "OpenAI" or "DeepSeek" semantics into business code.
7. **Open input.** Bring your own material - PDF, PPTX, DOCX now; anything parseable later.
8. **Architecture before code.** Document the decision. Justify the trade-off. Then build.

---

## 6. Long-Term Roadmap (vision-level - see `roadmap.md` for execution detail)

### Horizon 1 - "It works" (hackathon → 3 months post)

- Single-user diagnosis on PDF/PPTX/DOCX
- Knowledge map + adaptive review timeline
- Single-tier access (billing deferred until product-market fit)

### Horizon 2 - "It compounds" (3–12 months)

- Multi-document workspaces (a learner's whole corpus as one graph)
- Collaborative maps (share a snapshot, mentor reviews your gaps)
- Native mobile (PWA done first; React Native only if PWA fails to retain)
- API for educators: "diagnose my cohort on _this_ material"

### Horizon 3 - "It is the standard" (12+ months)

- Federated knowledge graphs across institutions
- B2B offering: corporate L&D diagnostic layer
- Open Knowledge Graph Protocol - MindMap as the "OAuth for knowledge state"
- Marketplace: verified diagnostic packs authored by domain experts

### Non-goals (explicitly, for the foreseeable future)

- Becoming a full LMS
- Authoring curricula
- Replacing human teachers
- Games / leaderboards / social learning
- A consumer mobile app store launch before PWA proves retention

---

## 7. Success Definition

| Horizon   | Metric                                                    | Target |
| --------- | --------------------------------------------------------- | ------ |
| Hackathon | Judges complete a full diagnose cycle on a sample doc     | 100%   |
| 90 days   | Weekly retention (W4) of users who completed ≥1 diagnosis | ≥35%   |
| 6 months  | Pro conversion of users with ≥3 diagnosed docs            | ≥8%    |
| 12 months | NPS among paying users                                    | ≥50    |

A diagnosis is "complete" when the Knowledge Map renders with at least one concept at
`mastery ≥ 0.5` and `confidence ≥ 0.6`. Below that, the state is too noisy to ship.

---

## 8. The One Sentence

> **MindMap is the calmest, most honest way to discover what you actually know - and
> what only feels like knowing - by diagnosing, not summarizing, your mind.**
