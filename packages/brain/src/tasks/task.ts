import type { TaskType } from '@mindmap/types'

/**
 * Tasks the Brain performs. Each one maps to a prompt id, a default
 * provider/model in the router policy, and an output schema in
 * `packages/brain/src/schemas/`.
 *
 * Phase 4 implements the knowledge pipeline tasks. The `reason.*` and
 * `schedule.review` tasks are placeholders until phase 5.
 */
export const TASKS: readonly TaskType[] = [
  'classify.language',
  'classify.topic',
  'extract.structure',
  'extract.relationships',
  'extract.metadata',
  'reason.diagnose',
  'reason.evaluate',
  'reason.clarify',
  'summarize.concept',
  'schedule.review',
] as const

export interface TaskDescriptor {
  id: TaskType
  promptId: string
  outputSchema:
    | 'classifyLanguage'
    | 'extractStructure'
    | 'extractMetadata'
    | 'extractRelationships'
    | 'summarizeConcept'
}

export const TASK_TABLE: Record<TaskType, TaskDescriptor> = {
  'classify.language': {
    id: 'classify.language',
    promptId: 'classify.language',
    outputSchema: 'classifyLanguage',
  },
  'classify.topic': {
    id: 'classify.topic',
    promptId: 'classify.language',
    outputSchema: 'classifyLanguage',
  },
  'extract.structure': {
    id: 'extract.structure',
    promptId: 'extract.structure',
    outputSchema: 'extractStructure',
  },
  'extract.relationships': {
    id: 'extract.relationships',
    promptId: 'extract.relationships',
    outputSchema: 'extractRelationships',
  },
  'extract.metadata': {
    id: 'extract.metadata',
    promptId: 'extract.metadata',
    outputSchema: 'extractMetadata',
  },
  'summarize.concept': {
    id: 'summarize.concept',
    promptId: 'summarize.concept',
    outputSchema: 'summarizeConcept',
  },
  'reason.diagnose': {
    id: 'reason.diagnose',
    promptId: 'extract.structure',
    outputSchema: 'extractStructure',
  },
  'reason.evaluate': {
    id: 'reason.evaluate',
    promptId: 'extract.structure',
    outputSchema: 'extractStructure',
  },
  'reason.clarify': {
    id: 'reason.clarify',
    promptId: 'extract.structure',
    outputSchema: 'extractStructure',
  },
  'schedule.review': {
    id: 'schedule.review',
    promptId: 'extract.structure',
    outputSchema: 'extractStructure',
  },
}
