/**
 * The entrypoint for the action.
 */
import * as core from '@actions/core'
import { run, RunInputs } from './main'

const inputs: RunInputs = {
  subjectPath: core.getInput('subject-path'),
  subjectName: core.getInput('subject-name'),
  subjectDigest: core.getInput('subject-digest'),
  subjectChecksums: core.getInput('subject-checksums'),
  predicateType: core.getInput('predicate-type'),
  predicate: core.getInput('predicate'),
  predicatePath: core.getInput('predicate-path'),
  pushToRegistry: core.getBooleanInput('push-to-registry'),
  showSummary: core.getBooleanInput('show-summary'),
  githubToken: core.getInput('github-token'),
  singleSubjectAttestations: core.getBooleanInput(
    'single-subject-attestations'
  ),
  // undocumented -- not part of public interface
  privateSigning: ['true', 'True', 'TRUE', '1'].includes(
    core.getInput('private-signing')
  )
}

/* eslint-disable-next-line @typescript-eslint/no-floating-promises */
run(inputs)
