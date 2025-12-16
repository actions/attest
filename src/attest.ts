import {
  Attestation,
  Predicate,
  Subject,
  attest,
  createStorageRecord
} from '@actions/attest'
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

    if (opts.createStorageRecord) {
      try {
        let subjectName = subject.name
        if (
          !subject.name.startsWith('https://') &&
          !subject.name.startsWith('http://')
        ) {
          subjectName = `https://${subject.name}`
        }

        const artifactOpts = {
          name: subjectName,
          digest: subjectDigest
        }
        const urlObject = new URL(subjectName)
        const registryUrl = urlObject.origin
        const packageRegistryOpts = {
          registryUrl,
          artifactUrl: subjectName
        }

        const records = await createStorageRecord(
          artifactOpts,
          packageRegistryOpts,
          opts.githubToken
        )
        result.storageRecordIds = records
      } catch (error) {
        console.warn(`Failed to create storage record: ${error}`)
        console.warn(
          'Please check that the "artifact-metadata:write" permission has been included'
        )
      }
    }
  }

  return result
}
