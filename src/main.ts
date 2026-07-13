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
    privateSigning: boolean
  }

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

    // Generate predicate based on attestation type
    const predicate = await getPredicateForType(attestationType, inputs)

    const outputPath = path.join(await tempDir(), ATTESTATION_FILE_NAME)
    core.setOutput('bundle-path', outputPath)

    const att = await createAttestation(subjects, predicate, {
      sigstoreInstance,
      pushToRegistry: inputs.pushToRegistry,
      createStorageRecord: inputs.createStorageRecord,
      subjectVersion: inputs.subjectVersion,
      githubToken: inputs.githubToken
    })

    logAttestation(subjects, att, sigstoreInstance)

    // Write attestation bundle to output file
    await fs.writeFile(outputPath, JSON.stringify(att.bundle) + os.EOL, {
      encoding: 'utf-8',
      flag: 'a'
    })

    const baseDir = process.env.RUNNER_TEMP
    /* istanbul ignore else */
    if (baseDir) {
      const outputSummaryPath = path.join(baseDir, ATTESTATION_PATHS_FILE_NAME)
      // Append the output path to the attestations paths file
      await fs.appendFile(outputSummaryPath, outputPath + os.EOL, {
        encoding: 'utf-8',
        flag: 'a'
      })
    } else {
      core.warning(
        'RUNNER_TEMP environment variable is not set. Cannot write attestation paths file.'
      )
    }

    /* istanbul ignore else */
    if (att.attestationID) {
      core.setOutput('attestation-id', att.attestationID)
      core.setOutput('attestation-url', attestationURL(att.attestationID))
    }

    /* istanbul ignore if */
    if (att.storageRecordIds) {
      core.setOutput('storage-record-ids', att.storageRecordIds.join(','))
    }

    /* istanbul ignore else */
    if (inputs.showSummary) {
      await logSummary(att)
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
const logSummary = async (attestation: AttestResult): Promise<void> => {
  const { attestationID } = attestation

  /* istanbul ignore else */
  if (attestationID) {
    const url = attestationURL(attestationID)
    core.summary.addHeading('Attestation Created', 3)
    core.summary.addList([`<a href="${url}">${url}</a>`])
    await core.summary.write()
  }
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
