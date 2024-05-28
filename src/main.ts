import * as core from '@actions/core'
import * as github from '@actions/github'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { AttestResult, SigstoreInstance, createAttestation } from './attest'
import { SEARCH_PUBLIC_GOOD_URL } from './endpoints'
import { PredicateInputs, predicateFromInputs } from './predicate'
import * as style from './style'
import { SubjectInputs, subjectFromInputs } from './subject'

const ATTESTATION_FILE_NAME = 'attestation.jsonl'

export type RunInputs = SubjectInputs &
  PredicateInputs & {
    pushToRegistry: boolean
    githubToken: string
    privateSigning: boolean
    batchSize: number
    batchDelay: number
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
    const atts: AttestResult[] = []
    if (!process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
      throw new Error(
        'missing "id-token" permission. Please add "permissions: id-token: write" to your workflow.'
      )
    }

    const subjects = await subjectFromInputs({
      ...inputs,
      downcaseName: inputs.pushToRegistry
    })
    const predicate = predicateFromInputs(inputs)

    const outputPath = path.join(tempDir(), ATTESTATION_FILE_NAME)
    core.setOutput('bundle-path', outputPath)

    const subjectChunks = chunkArray(subjects, inputs.batchSize)
    let chunkCount = 0

    // Generate attestations for each subject serially, working in batches
    for (const subjectChunk of subjectChunks) {
      // Delay between batches (only when chunkCount > 0)
      if (chunkCount++) {
        await new Promise(resolve => setTimeout(resolve, inputs.batchDelay))
      }

      if (subjectChunks.length > 1) {
        core.info(
          `Processing subject batch ${chunkCount}/${subjectChunks.length}`
        )
      }

      for (const subject of subjectChunk) {
        const att = await createAttestation(subject, predicate, {
          sigstoreInstance,
          pushToRegistry: inputs.pushToRegistry,
          githubToken: inputs.githubToken
        })
        atts.push(att)

        logAttestation(att, sigstoreInstance)

        // Write attestation bundle to output file
        fs.writeFileSync(outputPath, JSON.stringify(att.bundle) + os.EOL, {
          encoding: 'utf-8',
          flag: 'a'
        })
      }
    }

    logSummary(atts)
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
  attestation: AttestResult,
  sigstoreInstance: SigstoreInstance
): void => {
  core.info(
    `Attestation created for ${attestation.subjectName}@${attestation.subjectDigest}`
  )

  const instanceName =
    sigstoreInstance === 'public-good' ? 'Public Good' : 'GitHub'
  core.startGroup(
    style.highlight(
      `Attestation signed using certificate from ${instanceName} Sigstore instance`
    )
  )
  core.info(attestation.certificate)
  core.endGroup()

  if (attestation.tlogID) {
    core.info(
      style.highlight(
        'Attestation signature uploaded to Rekor transparency log'
      )
    )
    core.info(`${SEARCH_PUBLIC_GOOD_URL}?logIndex=${attestation.tlogID}`)
  }

  if (attestation.attestationID) {
    core.info(style.highlight('Attestation uploaded to repository'))
    core.info(attestationURL(attestation.attestationID))
  }

  if (attestation.attestationDigest) {
    core.info(style.highlight('Attestation uploaded to registry'))
    core.info(`${attestation.subjectName}@${attestation.attestationDigest}`)
  }
}

// Attach summary information to the GitHub Actions run
const logSummary = (attestations: AttestResult[]): void => {
  if (attestations.length > 0) {
    core.summary.addHeading(
      /* istanbul ignore next */
      attestations.length > 1 ? 'Attestations Created' : 'Attestation Created',
      3
    )

    for (const { subjectName, subjectDigest, attestationID } of attestations) {
      if (attestationID) {
        core.summary.addLink(
          `${subjectName}@${subjectDigest}`,
          attestationURL(attestationID)
        )
      }
    }
    core.summary.write()
  }
}

const tempDir = (): string => {
  const basePath = process.env['RUNNER_TEMP']

  /* istanbul ignore if */
  if (!basePath) {
    throw new Error('Missing RUNNER_TEMP environment variable')
  }

  return fs.mkdtempSync(path.join(basePath, path.sep))
}

// Transforms an array into an array of arrays, each containing at most
// `chunkSize` elements.
const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
  return Array.from(
    { length: Math.ceil(array.length / chunkSize) },
    (_, index) => array.slice(index * chunkSize, (index + 1) * chunkSize)
  )
}

const attestationURL = (id: string): string =>
  `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/attestations/${id}`
