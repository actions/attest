import { Attestation, Predicate, Subject, attest } from '@actions/attest'
import { attachArtifactToImage, getRegistryCredentials } from '@sigstore/oci'

const OCI_TIMEOUT = 30000
const OCI_RETRY = 3

export type SigstoreInstance = 'public-good' | 'github'
export type AttestResult = Attestation & {
  subjectName: string
  subjectDigest: string
  attestationDigest?: string
}

export const createAttestation = async (
  subject: Subject,
  predicate: Predicate,
  opts: {
    sigstoreInstance: SigstoreInstance
    pushToRegistry: boolean
    githubToken: string
  }
): Promise<AttestResult> => {
  // Sign provenance w/ Sigstore
  const attestation = await attest({
    subjectName: subject.name,
    subjectDigest: subject.digest,
    predicateType: predicate.type,
    predicate: predicate.params,
    sigstore: opts.sigstoreInstance,
    token: opts.githubToken
  })

  const subDigest = subjectDigest(subject)
  const result: AttestResult = {
    ...attestation,
    subjectName: subject.name,
    subjectDigest: subDigest
  }

  if (opts.pushToRegistry) {
    const credentials = getRegistryCredentials(subject.name)
    const artifact = await attachArtifactToImage({
      credentials,
      imageName: subject.name,
      imageDigest: subDigest,
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

// Returns the subject's digest as a formatted string of the form
// "<algorithm>:<digest>".
const subjectDigest = (subject: Subject): string => {
  const alg = Object.keys(subject.digest).sort()[0]
  return `${alg}:${subject.digest[alg]}`
}
