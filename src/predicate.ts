import * as core from '@actions/core'
import fs from 'fs'
import * as path from 'path'
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

  const params = predicatePath
    ? fs.readFileSync(predicatePath, 'utf-8')
    : predicateStr

  return { type: predicateType, params: JSON.parse(params) }
}

export const storePredicate = (predicate: Predicate): string => {
  // random tempfile
  const basePath = process.env['RUNNER_TEMP']

  if (!basePath) {
    throw new Error('Missing RUNNER_TEMP environment variable')
  }

  const tmpDir = fs.mkdtempSync(path.join(basePath, path.sep))
  const tempFile = path.join(tmpDir, 'predicate.json')

  // write predicate to file
  fs.writeFileSync(tempFile, JSON.stringify(predicate.params))
  return tempFile
}
