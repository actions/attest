import fs from 'fs'

import type { Predicate } from '@actions/attest'

export type PredicateInputs = {
  predicateType: string
  predicate: string
  predicatePath: string
}

const MAX_PREDICATE_SIZE_BYTES = 16 * 1024 * 1024

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

  let params: string = predicate

  if (predicatePath) {
    if (!fs.existsSync(predicatePath)) {
      throw new Error(`predicate file not found: ${predicatePath}`)
    }

    /* istanbul ignore next */
    if (fs.statSync(predicatePath).size > MAX_PREDICATE_SIZE_BYTES) {
      throw new Error(
        `predicate file exceeds maximum allowed size: ${MAX_PREDICATE_SIZE_BYTES} bytes`
      )
    }

    params = fs.readFileSync(predicatePath, 'utf-8')
  } else {
    if (predicate.length > MAX_PREDICATE_SIZE_BYTES) {
      throw new Error(
        `predicate string exceeds maximum allowed size: ${MAX_PREDICATE_SIZE_BYTES} bytes`
      )
    }

    params = predicate
  }

  return { type: predicateType, params: JSON.parse(params) }
}
