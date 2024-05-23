import fs from 'fs'

import type { Predicate } from '@actions/attest'

export type PredicateInputs = {
  predicateType: string
  predicate: string
  predicatePath: string
}
// Returns the predicate specified by the action's inputs. The predicate value
// may be specified as a path to a file or as a string.
export const predicateFromInputs = (inputs: PredicateInputs): Predicate => {
  const { predicateType, predicate, predicatePath } = inputs

  if (!predicateType) {
    throw new Error('predicate-type must be provided')
  }

  if (!predicatePath && !predicate) {
    throw new Error('One of predicate-path or predicate must be provided')
  }

  if (predicatePath && predicate) {
    throw new Error('Only one of predicate-path or predicate may be provided')
  }

  const params = predicatePath
    ? fs.readFileSync(predicatePath, 'utf-8')
    : predicate

  return { type: predicateType, params: JSON.parse(params) }
}
