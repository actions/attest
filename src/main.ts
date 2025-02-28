import * as core from '@actions/core'
import * as github from '@actions/github'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  AttestResult,
  SigstoreInstance,
  createAttestation,
  CreateAttestationOptions
} from './attest'
import { SEARCH_PUBLIC_GOOD_URL } from './endpoints'
import { PredicateInputs, predicateFromInputs } from './predicate'
import * as style from './style'
import {
  SubjectInputs,
  formatSubjectDigest,
  subjectFromInputs
} from './subject'

import type { Predicate, Subject } from '@actions/attest'

const ATTESTATION_FILE_NAME = 'attestation.json'

export type RunInputs = SubjectInputs &
  PredicateInputs & {
    pushToRegistry: boolean
    githubToken: string
    showSummary: boolean
    singleSubjectAttestations: boolean
    // undocumented -- not part of public interface
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

    const subjects = await subjectFromInputs({
      ...inputs,
      downcaseName: inputs.pushToRegistry
    })
    const predicate = predicateFromInputs(inputs)

    const outputPath = path.join(tempDir(), ATTESTATION_FILE_NAME)
    core.setOutput('bundle-path', outputPath)

    const opts: CreateAttestationOptions = {
      sigstoreInstance,
      pushToRegistry: inputs.pushToRegistry,
      githubToken: inputs.githubToken
    }

    let atts: AttestResult[]
    if (inputs.singleSubjectAttestations) {
      atts = await createSingleSubjectAttestations(subjects, predicate, opts)
    } else {
      atts = await createMultiSubjectAttestation(subjects, predicate, opts)
    }

    for (const att of atts) {
      logAttestation(att, sigstoreInstance)

      // Write attestation bundle to output file
      fs.writeFileSync(outputPath, JSON.stringify(att.bundle) + os.EOL, {
        encoding: 'utf-8',
        flag: 'a'
      })
    }

    if (inputs.showSummary) {
      await logSummary(atts)
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

const createSingleSubjectAttestations = async (
  subjects: Subject[],
  predicate: Predicate,
  opts: CreateAttestationOptions
): Promise<AttestResult[]> => {
  const atts: AttestResult[] = []
  // Generate one attestation for each subject
  for (const subject of subjects) {
    const att = await createAttestation([subject], predicate, opts)
    atts.push(att)
  }
  return atts
}

const createMultiSubjectAttestation = async (
  subjects: Subject[],
  predicate: Predicate,
  opts: CreateAttestationOptions
): Promise<AttestResult[]> => {
  const att = await createAttestation(subjects, predicate, opts)

  if (att.attestationID) {
    core.setOutput('attestation-id', att.attestationID)
    core.setOutput('attestation-url', attestationURL(att.attestationID))
  }

  return [att]
}

// Log details about the attestation to the GitHub Actions run
const logAttestation = (
  attestation: AttestResult,
  sigstoreInstance: SigstoreInstance
): void => {
  const subjects = attestation.attestationSubjects
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
    core.info(`${subjects[0].name}@${attestation.attestationDigest}`)
  }
}

// Attach summary information to the GitHub Actions run
const logSummary = async (attestations: AttestResult[]): Promise<void> => {
  if (attestations.length > 0) {
    core.summary.addHeading(
      /* istanbul ignore next */
      attestations.length !== 1
        ? 'Attestations Created'
        : 'Attestation Created',
      3
    )
    const listItems: string[] = []
    for (const attestation of attestations) {
      if (attestation.attestationID) {
        const url = attestationURL(attestation.attestationID)
        for (const subject of attestation.attestationSubjects) {
          const digest = formatSubjectDigest(subject)
          listItems.push(`<a href="${url}">${subject.name}@${digest}</a>`)
        }
      }
    }
    core.summary.addList(listItems)
    await core.summary.write()
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

const attestationURL = (id: string): string =>
  `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/attestations/${id}`
