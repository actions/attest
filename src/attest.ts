import { Attestation, Predicate, Subject, attest } from '@actions/attest'
import { attachArtifactToImage, getRegistryCredentials } from '@sigstore/oci'
import { formatSubjectDigest } from './subject'

const OCI_TIMEOUT = 30000
const OCI_RETRY = 3

export type SigstoreInstance = 'public-good' | 'github'
export type CreateAttestationOptions = {
  sigstoreInstance: SigstoreInstance
  pushToRegistry: boolean
  githubToken: string
}
export type AttestResult = Attestation & {
  attestationDigest?: string
  attestationSubjects: Subject[]
}

export const createAttestation = async (
  subjects: Subject[],
  predicate: Predicate,
  opts: CreateAttestationOptions
): Promise<AttestResult> => {
  // Sign provenance w/ Sigstore
  const attestation: Attestation = await attest({
    subjects,
    predicateType: predicate.type,
    predicate: predicate.params,
    sigstore: opts.sigstoreInstance,
    token: opts.githubToken
  })

  const result: AttestResult = {
    ...attestation,
    attestationSubjects: subjects
  }

  if (subjects.length === 1 && opts.pushToRegistry) {
    const subject = subjects[0]
    const credentials = getRegistryCredentials(subject.name)
    const artifact = await attachArtifactToImage({
      credentials,
      imageName: subject.name,
      imageDigest: formatSubjectDigest(subject),
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
  }

  return result
}
