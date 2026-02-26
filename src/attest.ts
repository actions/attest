import {
  Attestation,
  Predicate,
  Subject,
  attest,
  createStorageRecord
} from '@actions/attest'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { attachArtifactToImage, getRegistryCredentials } from '@sigstore/oci'
import { formatSubjectDigest } from './subject'

const OCI_TIMEOUT = 30000
const OCI_RETRY = 3

export type SigstoreInstance = 'public-good' | 'github'
export type AttestResult = Attestation & {
  attestationDigest?: string
  storageRecordIds?: number[]
}

export const createAttestation = async (
  subjects: Subject[],
  predicate: Predicate,
  opts: {
    sigstoreInstance: SigstoreInstance
    pushToRegistry: boolean
    createStorageRecord: boolean
    subjectVersion?: string
    githubToken: string
  }
): Promise<AttestResult> => {
  // Sign provenance w/ Sigstore
  const attestation = await attest({
    subjects,
    predicateType: predicate.type,
    predicate: predicate.params,
    sigstore: opts.sigstoreInstance,
    token: opts.githubToken
  })

  const result: AttestResult = attestation

  if (subjects.length === 1 && opts.pushToRegistry) {
    const subject = subjects[0]
    const credentials = getRegistryCredentials(subject.name)
    const subjectDigest = formatSubjectDigest(subject)
    const artifact = await attachArtifactToImage({
      credentials,
      imageName: subject.name,
      imageDigest: subjectDigest,
      artifact: Buffer.from(JSON.stringify(attestation.bundle)),
      mediaType: attestation.bundle.mediaType,
      annotations: {
        'dev.sigstore.bundle.content': 'dsse-envelope',
        'dev.sigstore.bundle.predicateType': predicate.type
      },
      fetchOpts: { timeout: OCI_TIMEOUT, retry: OCI_RETRY }
    })

    // Add the attestation's digest to the result
    result.attestationDigest = artifact.digest

    // Because creating a storage record requires the 'artifact-metadata:write'
    // permission, we wrap this in a try/catch to avoid failing the entire
    // attestation process if the token does not have the correct permissions.
    if (opts.createStorageRecord) {
      try {
        const token = opts.githubToken
        const isOrg = await repoOwnerIsOrg(token)
        if (!isOrg) {
          // The Artifact Metadata Storage Record API is only available to
          // organizations. So if the repo owner is not an organization,
          // storage record creation should not be attempted.
          return result
        }

        const registryUrl = getRegistryURL(subject.name)
        const artifactOpts = {
          name: subject.name,
          digest: subjectDigest,
          version: opts.subjectVersion || undefined
        }
        const packageRegistryOpts = {
          registryUrl
        }
        const records = await createStorageRecord(
          artifactOpts,
          packageRegistryOpts,
          token
        )

        if (!records || records.length === 0) {
          core.warning('No storage records were created.')
        }

        result.storageRecordIds = records
      } catch (error) {
        core.warning(`Failed to create storage record: ${error}`)
        core.warning(
          'Please check that the "artifact-metadata:write" permission has been included'
        )
      }
    }
  }

  return result
}

// Call the GET /repos/{owner}/{repo} endpoint to determine if the repo
// owner is an organization. This is used to determine if storage
// record creation should be attempted.
export const repoOwnerIsOrg = async (githubToken: string): Promise<boolean> => {
  const octokit = github.getOctokit(githubToken)
  const { data: repo } = await octokit.rest.repos.get({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo
  })
  return repo.owner?.type === 'Organization'
}

function getRegistryURL(subjectName: string): string {
  let url: URL

  try {
    url = new URL(subjectName)
  } catch {
    url = new URL(`https://${subjectName}`)
  }

  /* istanbul ignore if */
  if (url.protocol !== 'https:') {
    throw new Error(
      `Unsupported protocol ${url.protocol} in subject name ${subjectName}`
    )
  }

  return url.origin
}
