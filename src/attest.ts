import {
  Attestation,
  Predicate,
  Subject,
  attest,
  createStorageRecord
} from '@actions/attest'
import { attachArtifactToImage, getRegistryCredentials } from '@sigstore/oci'
import { formatSubjectDigest } from './subject'
import * as core from '@actions/core'

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
        let subjectName = subject.name
        const hasProtocol = /^[\w+.-]+:\/\//.test(subjectName)
        const isHttps = subjectName.startsWith('https://')
        if (hasProtocol && !isHttps) {
          throw new Error(`Unsupported protocol in subject name`)
        } else {
          // if the subject name does not start with a protocol, prefix with "https://"
          subjectName = `https://${subjectName}`
        }
        const registryUrl = new URL(subjectName).origin

        const artifactOpts = {
          name: subject.name,
          digest: subjectDigest
        }
        const packageRegistryOpts = {
          registryUrl
        }
        const records = await createStorageRecord(
          artifactOpts,
          packageRegistryOpts,
          opts.githubToken
        )

        if (!records || records.length === 0) {
          throw new Error('No storage records were created')
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
