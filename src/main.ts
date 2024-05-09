import { Attestation, Predicate, Subject, attest } from '@actions/attest'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { attachArtifactToImage, getRegistryCredentials } from '@sigstore/oci'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { SEARCH_PUBLIC_GOOD_URL } from './endpoints'
import { predicateFromInputs } from './predicate'
import { subjectFromInputs } from './subject'

type SigstoreInstance = 'public-good' | 'github'
type AttestedSubject = { subject: Subject; attestationID: string }

const COLOR_CYAN = '\x1B[36m'
const COLOR_DEFAULT = '\x1B[39m'
const ATTESTATION_FILE_NAME = 'attestation.jsonl'

const MAX_SUBJECT_COUNT = 64

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
export async function run(): Promise<void> {
  process.on('log', logHandler)

  // Provenance visibility will be public ONLY if we can confirm that the
  // repository is public AND the undocumented "private-signing" arg is NOT set.
  // Otherwise, it will be private.
  const sigstoreInstance: SigstoreInstance =
    github.context.payload.repository?.visibility === 'public' &&
    core.getInput('private-signing') !== 'true'
      ? 'public-good'
      : 'github'

  try {
    const atts: AttestedSubject[] = []
    if (!process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
      throw new Error(
        'missing "id-token" permission. Please add "permissions: id-token: write" to your workflow.'
      )
    }

    // Gather list of subjets
    const subjects = await subjectFromInputs()
    if (subjects.length > MAX_SUBJECT_COUNT) {
      throw new Error(
        `Too many subjects specified. The maximum number of subjects is ${MAX_SUBJECT_COUNT}.`
      )
    }

    const predicate = predicateFromInputs()
    const outputPath = path.join(tempDir(), ATTESTATION_FILE_NAME)

    // Generate attestations for each subject serially
    for (const subject of subjects) {
      const att = await createAttestation(subject, predicate, sigstoreInstance)

      // Write attestation bundle to output file
      fs.writeFileSync(outputPath, JSON.stringify(att.bundle) + os.EOL, {
        encoding: 'utf-8',
        flag: 'a'
      })

      if (att.attestationID) {
        atts.push({ subject, attestationID: att.attestationID })
      }
    }

    if (atts.length > 0) {
      core.summary.addHeading(
        /* istanbul ignore next */
        atts.length > 1 ? 'Attestations Created' : 'Attestation Created',
        3
      )

      for (const { subject, attestationID } of atts) {
        core.summary.addLink(
          `${subject.name}@${subjectDigest(subject)}`,
          attestationURL(attestationID)
        )
      }
      core.summary.write()
    }

    core.setOutput('bundle-path', outputPath)
  } catch (err) {
    // Fail the workflow run if an error occurs
    core.setFailed(
      err instanceof Error ? err.message : /* istanbul ignore next */ `${err}`
    )

    /* istanbul ignore if */
    if (err instanceof Error && 'cause' in err) {
      const innerErr = err.cause
      core.debug(innerErr instanceof Error ? innerErr.message : `${innerErr}}`)
    }
  } finally {
    process.removeListener('log', logHandler)
  }
}

const createAttestation = async (
  subject: Subject,
  predicate: Predicate,
  sigstoreInstance: SigstoreInstance
): Promise<Attestation> => {
  // Sign provenance w/ Sigstore
  const attestation = await attest({
    subjectName: subject.name,
    subjectDigest: subject.digest,
    predicateType: predicate.type,
    predicate: predicate.params,
    sigstore: sigstoreInstance,
    token: core.getInput('github-token')
  })

  core.info(`Attestation created for ${subject.name}@${subjectDigest(subject)}`)

  const instanceName =
    sigstoreInstance === 'public-good' ? 'Public Good' : 'GitHub'
  core.startGroup(
    highlight(
      `Attestation signed using certificate from ${instanceName} Sigstore instance`
    )
  )
  core.info(attestation.certificate)
  core.endGroup()

  if (attestation.tlogID) {
    core.info(
      highlight('Attestation signature uploaded to Rekor transparency log')
    )
    core.info(`${SEARCH_PUBLIC_GOOD_URL}?logIndex=${attestation.tlogID}`)
  }

  if (attestation.attestationID) {
    core.info(highlight('Attestation uploaded to repository'))
    core.info(attestationURL(attestation.attestationID))
  }

  if (core.getBooleanInput('push-to-registry', { required: false })) {
    const credentials = getRegistryCredentials(subject.name)
    const artifact = await attachArtifactToImage({
      credentials,
      imageName: subject.name,
      imageDigest: subjectDigest(subject),
      artifact: Buffer.from(JSON.stringify(attestation.bundle)),
      mediaType: attestation.bundle.mediaType,
      annotations: {
        'dev.sigstore.bundle.content': 'dsse-envelope',
        'dev.sigstore.bundle.predicateType': core.getInput('predicate-type')
      }
    })
    core.info(highlight('Attestation uploaded to registry'))
    core.info(`${subject.name}@${artifact.digest}`)
  }

  return attestation
}

const highlight = (str: string): string => `${COLOR_CYAN}${str}${COLOR_DEFAULT}`

const tempDir = (): string => {
  const basePath = process.env['RUNNER_TEMP']

  /* istanbul ignore if */
  if (!basePath) {
    throw new Error('Missing RUNNER_TEMP environment variable')
  }

  return fs.mkdtempSync(path.join(basePath, path.sep))
}

// Returns the subject's digest as a formatted string of the form
// "<algorithm>:<digest>".
const subjectDigest = (subject: Subject): string => {
  const alg = Object.keys(subject.digest).sort()[0]
  return `${alg}:${subject.digest[alg]}`
}

const attestationURL = (id: string): string =>
  `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/attestations/${id}`
