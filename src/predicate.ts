import * as core from '@actions/core'
import fs from 'fs'

import type { Predicate } from '@actions/attest'

// Returns the predicate specified by the action's inputs. The predicate value
// may be specified as a path to a file or as a string.
export const predicateFromInputs = (): Predicate => {
  const predicateType = core.getInput('predicate-type', { required: true })
  const predicateStr = core.getInput('predicate', { required: false })
  const predicatePath = core.getInput('predicate-path', { required: false })

  if (!predicatePath && !predicateStr) {
    throw new Error('One of predicate-path or predicate must be provided')
  }

  if (predicatePath && predicateStr) {
    throw new Error('Only one of predicate-path or predicate may be provided')
  }

  const params = predicatePath
    ? fs.readFileSync(predicatePath, 'utf-8')
    : predicateStr

  return { type: predicateType, params: JSON.parse(params) }
}
