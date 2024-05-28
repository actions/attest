/**
 * The entrypoint for the action.
 */
import * as core from '@actions/core'
import { run, RunInputs } from './main'

const DEFAULT_BATCH_SIZE = 50
const DEFAULT_BATCH_DELAY = 5000

const inputs: RunInputs = {
  subjectPath: core.getInput('subject-path'),
  subjectName: core.getInput('subject-name'),
  subjectDigest: core.getInput('subject-digest'),
  predicateType: core.getInput('predicate-type'),
  predicate: core.getInput('predicate'),
  predicatePath: core.getInput('predicate-path'),
  pushToRegistry: core.getBooleanInput('push-to-registry'),
  githubToken: core.getInput('github-token'),
  // undocumented -- not part of public interface
  privateSigning: ['true', 'True', 'TRUE', '1'].includes(
    core.getInput('private-signing')
  ),
  // internal only
  batchSize: DEFAULT_BATCH_SIZE,
  batchDelay: DEFAULT_BATCH_DELAY
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run(inputs)
