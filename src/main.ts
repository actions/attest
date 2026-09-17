import * as core from '@actions/core'
import * as github from '@actions/github'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { AttestResult, SigstoreInstance, createAttestation } from './attest'
import {
  AttestationType,
  DetectionInputs,
  detectAttestationType,
  validateAttestationInputs
} from './detect'
import { SEARCH_PUBLIC_GOOD_URL } from './endpoints'
import { PredicateInputs, predicateFromInputs } from './predicate'
import { generateProvenancePredicate } from './provenance'
import { generateSBOMPredicate, parseSBOMFromPath } from './sbom'
import * as style from './style'
import {
  SubjectInputs,
  formatSubjectDigest,
  subjectFromInputs
} from './subject'

import type { Predicate, Subject } from '@actions/attest'

const ATTESTATION_FILE_NAME = 'attestation.json'
const ATTESTATION_PATHS_FILE_NAME = 'created_attestation_paths.txt'
const ATTESTATION_RESULTS_FILE_NAME = 'attestation-results.json'
const ATTESTATION_WRITE_DELAY_MS = 1000
const MAX_SINGLE_SUBJECT_ATTESTATIONS = 100

export type SBOMInputs = {
  sbomPath: string
}

export type RunInputs = SubjectInputs &
  PredicateInputs &
  SBOMInputs & {
    pushToRegistry: boolean
    createStorageRecord: boolean
    subjectVersion: string
    githubToken: string
    showSummary: boolean
    singleSubjectAttestations: boolean
    privateSigning: boolean
  }

type SuccessfulAttestationResult = {
  subjects: Subject[]
  status: 'success'
  bundleLine: number
  attestationId?: string
  attestationUrl?: string
  attestationDigest?: string
  storageRecordIds?: number[]
}

type FailedAttestationResult = {
  subjects: Subject[]
  status: 'failure'
  error: string
}

type AttestationRunResult =
  SuccessfulAttestationResult | FailedAttestationResult

const sleep = async (milliseconds: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, milliseconds))

/* istanbul ignore next */
const logHandler = (level: string, ...args: unknown[]): void => {
  // Send any HTTP-related log events to the GitHub Actions debug log
  if (level === 'http') {
    core.debug(args.join(' '))
  }
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(inputs: RunInputs): Promise<void> {
  process.on('log', logHandler)

  // Provenance visibility will be public ONLY if we can confirm that the
  // repository is public AND the undocumented "private-signing" arg is NOT set.
  // Otherwise, it will be private.
  const sigstoreInstance: SigstoreInstance =
    github.context.payload.repository?.visibility === 'public' &&
    !inputs.privateSigning
      ? 'public-good'
      : 'github'

  try {
    if (!process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
      throw new Error(
        'missing "id-token" permission. Please add "permissions: id-token: write" to your workflow.'
      )
    }

    // Detect attestation type and validate inputs
    const detectionInputs: DetectionInputs = {
      sbomPath: inputs.sbomPath,
      predicateType: inputs.predicateType,
      predicate: inputs.predicate,
      predicatePath: inputs.predicatePath
    }
    validateAttestationInputs(detectionInputs)
    const attestationType = detectAttestationType(detectionInputs)
    logAttestationType(attestationType)

    const subjects = await subjectFromInputs({
      ...inputs,
      downcaseName: inputs.pushToRegistry
    })

    // Validate single-subject attestation count limit
    if (
      inputs.singleSubjectAttestations &&
      subjects.length > MAX_SINGLE_SUBJECT_ATTESTATIONS
    ) {
      throw new Error(
        `single-subject-attestations supports at most ${MAX_SINGLE_SUBJECT_ATTESTATIONS} subjects but ${subjects.length} subjects were resolved`
      )
    }

    // Validate subjects are compatible with registry push requirements
    if (inputs.pushToRegistry) {
      validateRegistrySubjects(subjects, inputs.singleSubjectAttestations)
    }

    // Generate predicate based on attestation type
    const predicate = await getPredicateForType(attestationType, inputs)

    const outputDir = await tempDir()
    const bundlePath = path.join(outputDir, ATTESTATION_FILE_NAME)
    const resultsPath = path.join(outputDir, ATTESTATION_RESULTS_FILE_NAME)

    // Initialize both output files before network activity
    await Promise.all([
      fs.writeFile(bundlePath, '', 'utf-8'),
      fs.writeFile(resultsPath, `[]${os.EOL}`, 'utf-8')
    ])

    core.setOutput('bundle-path', bundlePath)
    core.setOutput('results-path', resultsPath)

    const opts = {
      sigstoreInstance,
      pushToRegistry: inputs.pushToRegistry,
      createStorageRecord: inputs.createStorageRecord,
      subjectVersion: inputs.subjectVersion,
      githubToken: inputs.githubToken
    }

    const subjectGroups = inputs.singleSubjectAttestations
      ? subjects.map(subject => [subject])
      : [subjects]

    const results: AttestationRunResult[] = []
    let bundleLineCount = 0

    for (const [index, attestationSubjects] of subjectGroups.entries()) {
      if (index > 0) {
        await sleep(ATTESTATION_WRITE_DELAY_MS)
      }

      try {
        const att = await createAttestation(
          attestationSubjects,
          predicate,
          opts
        )

        logAttestation(attestationSubjects, att, sigstoreInstance)

        // Append bundle to JSONL file
        await fs.writeFile(bundlePath, JSON.stringify(att.bundle) + os.EOL, {
          encoding: 'utf-8',
          flag: 'a'
        })
        bundleLineCount++

        const result: SuccessfulAttestationResult = {
          subjects: attestationSubjects,
          status: 'success',
          bundleLine: bundleLineCount
        }

        /* istanbul ignore else */
        if (att.attestationID) {
          result.attestationId = att.attestationID
          result.attestationUrl = attestationURL(att.attestationID)
        }

        if (att.attestationDigest) {
          result.attestationDigest = att.attestationDigest
        }

        /* istanbul ignore next */
        if (att.storageRecordIds && att.storageRecordIds.length > 0) {
          result.storageRecordIds = att.storageRecordIds
        }

        results.push(result)
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : /* istanbul ignore next */ `${err}`
        results.push({
          subjects: attestationSubjects,
          status: 'failure',
          error: message
        })

        // Log the cause of per-subject errors
        /* istanbul ignore if */
        if (err instanceof Error && 'cause' in err) {
          const innerErr = err.cause
          core.info(
            style.mute(
              innerErr instanceof Error ? innerErr.toString() : `${innerErr}`
            )
          )
        }
      }

      // Persist results after every attempt
      await writeResults(resultsPath, results)
    }

    // Record the shared bundle path for cross-job discovery
    const baseDir = process.env.RUNNER_TEMP
    /* istanbul ignore else */
    if (baseDir) {
      const outputSummaryPath = path.join(baseDir, ATTESTATION_PATHS_FILE_NAME)
      await fs.appendFile(outputSummaryPath, bundlePath + os.EOL, {
        encoding: 'utf-8',
        flag: 'a'
      })
    } else {
      core.warning(
        'RUNNER_TEMP environment variable is not set. Cannot write attestation paths file.'
      )
    }

    // Set singular outputs only when exactly one logical attestation was
    // attempted and it succeeded
    const successResults = results.filter(
      (r): r is SuccessfulAttestationResult => r.status === 'success'
    )
    if (subjectGroups.length === 1 && successResults.length === 1) {
      const result = successResults[0]

      /* istanbul ignore else */
      if (result.attestationId) {
        core.setOutput('attestation-id', result.attestationId)
        core.setOutput('attestation-url', result.attestationUrl)
      }

      /* istanbul ignore if */
      if (result.storageRecordIds && result.storageRecordIds.length > 0) {
        core.setOutput('storage-record-ids', result.storageRecordIds.join(','))
      }
    }

    /* istanbul ignore else */
    if (inputs.showSummary) {
      await logSummary(results)
    }

    // Fail the step after all subjects have been processed
    const failureCount = results.filter(r => r.status === 'failure').length
    if (failureCount > 0) {
      throw new Error(
        `${failureCount} of ${results.length} attestations failed; see ${resultsPath} for details`
      )
    }
  } catch (err) {
    // Fail the workflow run if an error occurs
    core.setFailed(
      err instanceof Error ? err : /* istanbul ignore next */ `${err}`
    )

    // Log the cause of the error if one is available
    /* istanbul ignore if */
    if (err instanceof Error && 'cause' in err) {
      const innerErr = err.cause
      core.info(
        style.mute(
          innerErr instanceof Error ? innerErr.toString() : `${innerErr}`
        )
      )
    }
  } finally {
    process.removeListener('log', logHandler)
  }
}

// Log details about the attestation to the GitHub Actions run
const logAttestation = (
  subjects: Subject[],
  attestation: AttestResult,
  sigstoreInstance: SigstoreInstance
): void => {
  if (subjects.length === 1) {
    core.info(
      `Attestation created for ${subjects[0].name}@${formatSubjectDigest(subjects[0])}`
    )
  } else {
    core.info(`Attestation created for ${subjects.length} subjects`)
  }

  const instanceName =
    sigstoreInstance === 'public-good' ? 'Public Good' : 'GitHub'
  core.startGroup(
    style.highlight(
      `Attestation signed using certificate from ${instanceName} Sigstore instance`
    )
  )
  core.info(attestation.certificate)
  core.endGroup()

  /* istanbul ignore if */
  if (attestation.tlogID) {
    core.info(
      style.highlight(
        'Attestation signature uploaded to Rekor transparency log'
      )
    )
    core.info(`${SEARCH_PUBLIC_GOOD_URL}?logIndex=${attestation.tlogID}`)
  }

  /* istanbul ignore else */
  if (attestation.attestationID) {
    core.info(style.highlight('Attestation uploaded to repository'))
    core.info(attestationURL(attestation.attestationID))
  }

  if (attestation.attestationDigest) {
    core.info(style.highlight('Attestation uploaded to registry'))
    core.info(`${subjects[0].name}@${attestation.attestationDigest}`)
  }

  /* istanbul ignore next */
  if (attestation.storageRecordIds && attestation.storageRecordIds.length > 0) {
    core.info(style.highlight('Storage record created'))
    core.info(`Storage record IDs: ${attestation.storageRecordIds.join(',')}`)
  }
}

// Attach summary information to the GitHub Actions run
const logSummary = async (results: AttestationRunResult[]): Promise<void> => {
  core.summary.addHeading(
    results.length === 1 ? 'Attestation Created' : 'Attestations Created',
    3
  )
  core.summary.addTable([
    [
      { data: 'Subject', header: true },
      { data: 'Status', header: true },
      { data: 'Attestation', header: true },
      { data: 'Error', header: true }
    ],
    ...results.map(result => [
      result.subjects
        .map(subject => `${subject.name}@${formatSubjectDigest(subject)}`)
        .join('<br>'),
      result.status,
      result.status === 'success' && result.attestationUrl
        ? `<a href="${result.attestationUrl}">${result.attestationId}</a>`
        : '',
      result.status === 'failure' ? result.error : ''
    ])
  ])
  await core.summary.write()
}

const writeResults = async (
  resultsPath: string,
  results: AttestationRunResult[]
): Promise<void> => {
  const temporaryPath = `${resultsPath}.tmp`
  await fs.writeFile(
    temporaryPath,
    `${JSON.stringify(results, null, 2)}${os.EOL}`,
    'utf-8'
  )
  await fs.rename(temporaryPath, resultsPath)
}

const tempDir = async (): Promise<string> => {
  const basePath = process.env['RUNNER_TEMP']

  /* istanbul ignore if */
  if (!basePath) {
    throw new Error('Missing RUNNER_TEMP environment variable')
  }

  return fs.mkdtemp(path.join(basePath, path.sep))
}

const attestationURL = (id: string): string =>
  `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/attestations/${id}`

// Log the detected attestation type
const logAttestationType = (type: AttestationType): void => {
  const typeLabels: Record<AttestationType, string> = {
    provenance: 'Build Provenance',
    sbom: 'SBOM',
    custom: 'Custom'
  }
  core.info(`Attestation type: ${typeLabels[type]}`)
}

// Generate predicate based on attestation type
const getPredicateForType = async (
  type: AttestationType,
  inputs: RunInputs
): Promise<Predicate> => {
  switch (type) {
    case 'provenance':
      return generateProvenancePredicate()
    case 'sbom': {
      const sbom = await parseSBOMFromPath(inputs.sbomPath)
      return generateSBOMPredicate(sbom)
    }
    case 'custom':
      return predicateFromInputs(inputs)
  }
}

// Validate that resolved subjects meet registry push requirements.
// In default mode: exactly one subject with a SHA-256 digest.
// In single-subject mode: each subject must have only a SHA-256 digest.
export const validateRegistrySubjects = (
  subjects: Subject[],
  singleSubjectAttestations = false
): void => {
  if (!singleSubjectAttestations && subjects.length !== 1) {
    throw new Error(
      `push-to-registry requires exactly one subject but ${subjects.length} subjects were resolved`
    )
  }

  const invalid = subjects.find(subject => {
    const algorithms = Object.keys(subject.digest)
    return algorithms.length !== 1 || algorithms[0] !== 'sha256'
  })

  if (invalid) {
    throw new Error(
      `push-to-registry requires each subject to have only a SHA-256 digest but "${invalid.name}" has: ${Object.keys(invalid.digest).join(', ')}`
    )
  }
}
