# ADR-0003: IRT-based adaptive evaluation

**Status:** Accepted  
**Date:** 2026-07-24

## Context

MindMap needs an adaptive questioning engine that selects the next question to maximize information about the learner's knowledge state. The engine must work in real-time (sub-second question selection), support both MCQ and open-ended questions, and produce per-concept mastery and confidence estimates.

## Decision

Use Item Response Theory (IRT) 1-PL (one-parameter logistic) model for next-question selection, combined with Bayesian grid updates for the knowledge state.

- **Question selection:** Fisher information criterion — pick the question that maximizes information about the concept's mastery parameter.
- **State update:** Bayesian posterior update on a discretized grid (mastery × confidence).
- **Stopping rule:** Three conditions — max questions reached, global confidence above threshold, or stagnant information gain.
- **Neighbor propagation:** When a concept's mastery changes, propagate a dampened update to neighboring concepts in the dependency graph.

## Rationale

- IRT is a well-established psychometric model with decades of research backing its validity.
- The 1-PL model (one difficulty parameter per item) is sufficient for our use case — we don't need discrimination parameters for MVP.
- Bayesian grid updates are computationally cheap (O(grid_size²) per update) and avoid the complexity of full Bayesian inference.
- Fisher information provides a principled way to select the most informative next question, minimizing the total number of questions needed.
- Neighbor propagation leverages the dependency graph to infer knowledge about related concepts without directly probing them.

## Alternatives considered

- **Computerized Adaptive Testing (CAT) with 2/3-PL:** Rejected. More parameters require more data to estimate reliably; 1-PL is sufficient for 12-30 question sessions.
- **Knowledge Tracing (BKT/DKT):** Rejected. Requires training data we don't have; IRT works from first principles.
- **Simple spaced repetition (SM-2):** Rejected. Doesn't adapt to the learner's actual knowledge state — only tracks review intervals.
- **Random question selection:** Rejected. Wastes the learner's time with uninformative questions.

## Consequences

- The mastery grid must be large enough for meaningful differentiation (we use 20×20 = 400 cells).
- Questions must be calibrated with a difficulty parameter; uncalibrated questions default to medium difficulty.
- The engine produces per-concept `(mastery, confidence, attempts, correct, lastDelta)` — five numbers that fully describe the knowledge state.
- The stopping rule must be tuned to balance session length vs. confidence; we target ≤12 questions (Free) or ≤30 (Pro) with global confidence ≥ 0.7.
