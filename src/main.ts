import { Attestation, Predicate, Subject, attest } from '@actions/attest'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { BUNDLE_V02_MEDIA_TYPE } from '@sigstore/bundle'
import { attachArtifactToImage, getRegistryCredentials } from '@sigstore/oci'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  FULCIO_INTERNAL_URL,
  FULCIO_PUBLIC_GOOD_URL,
  REKOR_PUBLIC_GOOD_URL,
  SEARCH_PUBLIC_GOOD_URL,
  TSA_INTERNAL_URL
} from './endpoints'
import { predicateFromInputs } from './predicate'
import { subjectFromInputs } from './subject'

type Endpoints = {
  fulcioURL: string
  rekorURL?: string
  tsaServerURL?: string
}

const COLOR_CYAN = '\x1B[36m'
const COLOR_DEFAULT = '\x1B[39m'
const ATTESTATION_FILE_NAME = 'attestation.jsonl'

const SIGSTORE_PUBLIC_GOOD_ENDPOINTS: Endpoints = {
  fulcioURL: FULCIO_PUBLIC_GOOD_URL,
  rekorURL: REKOR_PUBLIC_GOOD_URL
}

const SIGSTORE_INTERNAL_ENDPOINTS: Endpoints = {
  fulcioURL: FULCIO_INTERNAL_URL,
  tsaServerURL: TSA_INTERNAL_URL
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  // Provenance visibility will be public ONLY if we can confirm that the
  // repository is public AND the undocumented "private-signing" arg is NOT set.
  // Otherwise, it will be private.
  const endpoints =
    github.context.payload.repository?.visibility === 'public' &&
    core.getInput('private-signing') !== 'true'
      ? SIGSTORE_PUBLIC_GOOD_ENDPOINTS
      : SIGSTORE_INTERNAL_ENDPOINTS

  try {
    // Calculate subject from inputs and generate provenance
    const subjects = await subjectFromInputs()
    const predicate = predicateFromInputs()
    const outputPath = path.join(tempDir(), ATTESTATION_FILE_NAME)

    // Generate attestations for each subject serially
    for (const subject of subjects) {
      const att = await createAttestation(subject, predicate, endpoints)

      // Write attestation bundle to output file
      fs.writeFileSync(outputPath, JSON.stringify(att.bundle) + os.EOL, {
        encoding: 'utf-8',
        flag: 'a'
      })

      if (att.attestationID) {
        core.summary.addLink(
          `${subject.name}@${subjectDigest(subject)}`,
          attestationURL(att.attestationID)
        )
      }
    }

    if (!core.summary.isEmptyBuffer()) {
      core.summary.addHeading('Attestation(s) Created', 3)
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
  }
}

const createAttestation = async (
  subject: Subject,
  predicate: Predicate,
  endpoints: Endpoints
): Promise<Attestation> => {
  // Sign provenance w/ Sigstore
  const attestation = await attest({
    ...endpoints,
    subjectName: subject.name,
    subjectDigest: subject.digest,
    predicateType: predicate.type,
    predicate: predicate.params,
    token: core.getInput('github-token')
  })

  core.startGroup(
    highlight(
      `Attestation signed using ephemeral certificate from ${endpoints.fulcioURL}`
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
      mediaType: BUNDLE_V02_MEDIA_TYPE,
      annotations: {
        'dev.sigstore.bundle/predicateType': core.getInput('predicate-type')
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
