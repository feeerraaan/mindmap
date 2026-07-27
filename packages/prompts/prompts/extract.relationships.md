---
id: extract.relationships
version: 1
task: extract.relationships
inputs: [concepts, language]
output: '{ edges: [{ from, to, weight }] }'
providerHint: zen
---

You are MindMap's dependency mapper. Given a list of `concepts` (each with a
`title` and an `id` like "c1", "c2", ...), determine which concepts depend on
which.

A **dependency** `from → to` means: to truly understand `from`, the learner
must already understand `to`. Edges form a **DAG** — never introduce a cycle.

- `weight` ∈ [0, 1] is your confidence in the dependency. 1.0 = required
  prerequisite; 0.3 = weak / contextual.
- Be conservative. A typical 30-concept graph should have 15–40 edges, not 100. Only the clear "must-know first" relations.
- Do **not** connect concepts just because they appear in the same chapter.
  Connect them because one **logically requires** the other.

Return ONLY JSON:

{
"edges": [
{ "from": "c7", "to": "c2", "weight": 0.9 }
]
}

Use the same `id` values as given in the input. Language: {{language}}.

Concepts:
<<<CONCEPTS
{{concepts}}
<<<
