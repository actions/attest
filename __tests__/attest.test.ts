import * as github from '@actions/github'
import * as attest from '@actions/attest'
import * as oci from '@sigstore/oci'
import * as localAttest from '../src/attest'
import { createAttestation, repoOwnerIsOrg } from '../src/attest'

const subjectName = 'ghcr.io/foo/bar'
const subjectDigest =
  'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32'

const predicate = {
  type: 'https://in-toto.io/attestation/release/v0.1',
  params: {}
}

describe('repoOwnerIsOrg', () => {
  const originalContext = { ...github.context }

  afterEach(() => {
    setGHContext(originalContext)
    jest.restoreAllMocks()
  })

  it('returns true when repo owner is an organization', async () => {
    setGHContext({
      repo: { owner: 'my-org', repo: 'my-repo' }
    })

    jest.spyOn(github, 'getOctokit').mockReturnValue({
      rest: {
        repos: {
          get: jest.fn().mockResolvedValue({
            data: { owner: { type: 'Organization' } }
          })
        }
      }
    } as unknown as ReturnType<typeof github.getOctokit>)

    const result = await repoOwnerIsOrg('gh-token')
    expect(result).toBe(true)
  })

  it('returns false when repo owner is a user', async () => {
    setGHContext({
      repo: { owner: 'my-user', repo: 'my-repo' }
    })

    jest.spyOn(github, 'getOctokit').mockReturnValue({
      rest: {
        repos: {
          get: jest.fn().mockResolvedValue({
            data: { owner: { type: 'User' } }
          })
        }
      }
    } as unknown as ReturnType<typeof github.getOctokit>)

    const result = await repoOwnerIsOrg('gh-token')
    expect(result).toBe(false)
  })
})

describe('createAttestation', () => {
  const originalEnv = process.env
  const originalContext = { ...github.context }

  beforeEach(async () => {
    jest.clearAllMocks()

    setGHContext({
      payload: { repository: { visibility: 'private' } },
      repo: { owner: 'foo', repo: 'bar' }
    })
  })

  afterEach(() => {
    process.env = originalEnv
    setGHContext(originalContext)
  })

  describe('when createStorageRecord is false', () => {
    beforeEach(() => {
      // Mock the core attest function
      jest.spyOn(attest, 'attest').mockResolvedValue({
        bundle: {
          mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json'
        },
        certificate: 'cert',
        tlogID: 'tlog-123',
        attestationID: 'att-123'
      } as attest.Attestation)

      // Mock OCI functions
      jest.spyOn(oci, 'getRegistryCredentials').mockReturnValue({
        username: 'user',
        password: 'pass'
      })
      jest.spyOn(oci, 'attachArtifactToImage').mockResolvedValue({
        digest: 'sha256:abc123',
        mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
        size: 100
      })
    })

    it('skips storage record creation', async () => {
      const createStorageRecordSpy = jest.spyOn(attest, 'createStorageRecord')
      const subjects = [{ name: subjectName, digest: { sha256: subjectDigest.replace('sha256:', '') } }]

      const result = await createAttestation(subjects, predicate, {
        sigstoreInstance: 'github',
        pushToRegistry: true,
        createStorageRecord: false,
        githubToken: 'gh-token'
      })

      expect(result.attestationDigest).toBe('sha256:abc123')
      expect(createStorageRecordSpy).not.toHaveBeenCalled()
    })
  })

  describe('when storage records are empty', () => {
    beforeEach(() => {
      jest.spyOn(attest, 'attest').mockResolvedValue({
        bundle: { mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json' },
        certificate: 'cert',
        tlogID: 'tlog-123',
        attestationID: 'att-123'
      } as attest.Attestation)

      jest.spyOn(oci, 'getRegistryCredentials').mockReturnValue({
        username: 'user',
        password: 'pass'
      })
      jest.spyOn(oci, 'attachArtifactToImage').mockResolvedValue({
        digest: 'sha256:abc123',
        mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
        size: 100
      })

      // Mock repoOwnerIsOrg
      jest.spyOn(localAttest, 'repoOwnerIsOrg').mockResolvedValue(true)

      // Mock createStorageRecord to return empty array
      jest.spyOn(attest, 'createStorageRecord').mockResolvedValue([])
    })

    it('handles empty storage records gracefully', async () => {
      const subjects = [{ name: subjectName, digest: { sha256: subjectDigest.replace('sha256:', '') } }]

      // This exercises the empty records code path for coverage
      const result = await createAttestation(subjects, predicate, {
        sigstoreInstance: 'github',
        pushToRegistry: true,
        createStorageRecord: true,
        githubToken: 'gh-token'
      })

      expect(result.attestationDigest).toBe('sha256:abc123')
    })
  })

  describe('when subject has unsupported protocol', () => {
    beforeEach(() => {
      jest.spyOn(attest, 'attest').mockResolvedValue({
        bundle: { mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json' },
        certificate: 'cert',
        tlogID: 'tlog-123',
        attestationID: 'att-123'
      } as attest.Attestation)

      jest.spyOn(oci, 'getRegistryCredentials').mockReturnValue({
        username: 'user',
        password: 'pass'
      })
      jest.spyOn(oci, 'attachArtifactToImage').mockResolvedValue({
        digest: 'sha256:abc123',
        mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
        size: 100
      })

      // Mock repoOwnerIsOrg
      jest.spyOn(localAttest, 'repoOwnerIsOrg').mockResolvedValue(true)
    })

    it('handles unsupported protocol gracefully', async () => {
      const subjects = [
        {
          name: 'http://registry.example.com/foo/bar',
          digest: { sha256: subjectDigest.replace('sha256:', '') }
        }
      ]

      // This exercises the unsupported protocol code path for coverage
      const result = await createAttestation(subjects, predicate, {
        sigstoreInstance: 'github',
        pushToRegistry: true,
        createStorageRecord: true,
        githubToken: 'gh-token'
      })

      // Should complete without throwing (error is caught and logged as warning)
      expect(result.attestationDigest).toBe('sha256:abc123')
    })
  })
})

function setGHContext(context: object): void {
  Object.defineProperty(github, 'context', { value: context })
}
