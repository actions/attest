import { jest } from '@jest/globals'
import type { Descriptor } from '@sigstore/oci'
// Mock functions
const mockGetOctokit = jest.fn()
const mockAttest = jest.fn<() => Promise<any>>()
const mockCreateStorageRecord = jest.fn<() => Promise<number[]>>()
const mockGetRegistryCredentials = jest.fn()
const mockAttachArtifactToImage = jest.fn<() => Promise<Descriptor>>()

// Mock @actions/github
jest.unstable_mockModule('@actions/github', () => ({
  getOctokit: mockGetOctokit,
  context: {
    repo: { owner: 'foo', repo: 'bar' },
    payload: { repository: { visibility: 'private' } }
  }
}))

// Mock @actions/attest
jest.unstable_mockModule('@actions/attest', () => ({
  attest: mockAttest,
  createStorageRecord: mockCreateStorageRecord
}))

// Mock @sigstore/oci
jest.unstable_mockModule('@sigstore/oci', () => ({
  getRegistryCredentials: mockGetRegistryCredentials,
  attachArtifactToImage: mockAttachArtifactToImage
}))

// Dynamic imports after mocking
const { createAttestation, repoOwnerIsOrg } = await import('../src/attest')

const subjectName = 'ghcr.io/foo/bar'
const subjectDigest =
  'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32'

const predicate = {
  type: 'https://in-toto.io/attestation/release/v0.1',
  params: {}
}

describe('repoOwnerIsOrg', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when repo owner is an organization', async () => {
    mockGetOctokit.mockReturnValue({
      rest: {
        repos: {
          get: jest
            .fn<() => Promise<{ data: { owner: { type: string } } }>>()
            .mockResolvedValue({
              data: { owner: { type: 'Organization' } }
            })
        }
      }
    })

    const result = await repoOwnerIsOrg('gh-token')
    expect(result).toBe(true)
  })

  it('returns false when repo owner is a user', async () => {
    mockGetOctokit.mockReturnValue({
      rest: {
        repos: {
          get: jest.fn<() => Promise<any>>().mockResolvedValue({
            data: { owner: { type: 'User' } }
          })
        }
      }
    })

    const result = await repoOwnerIsOrg('gh-token')
    expect(result).toBe(false)
  })
})

describe('createAttestation', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Default mock implementations
    mockAttest.mockResolvedValue({
      bundle: { mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json' },
      certificate: 'cert',
      tlogID: 'tlog-123',
      attestationID: 'att-123'
    })

    mockGetRegistryCredentials.mockReturnValue({
      username: 'user',
      password: 'pass'
    })

    mockAttachArtifactToImage.mockResolvedValue({
      digest: 'sha256:abc123',
      mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
      size: 100
    })
  })

  describe('when createStorageRecord is false', () => {
    it('skips storage record creation', async () => {
      const subjects = [
        {
          name: subjectName,
          digest: { sha256: subjectDigest.replace('sha256:', '') }
        }
      ]

      const result = await createAttestation(subjects, predicate, {
        sigstoreInstance: 'github',
        pushToRegistry: true,
        createStorageRecord: false,
        githubToken: 'gh-token'
      })

      expect(result.attestationDigest).toBe('sha256:abc123')
      expect(mockCreateStorageRecord).not.toHaveBeenCalled()
    })
  })

  describe('when storage records are empty', () => {
    beforeEach(() => {
      mockGetOctokit.mockReturnValue({
        rest: {
          repos: {
            get: jest.fn<() => Promise<any>>().mockResolvedValue({
              data: { owner: { type: 'Organization' } }
            })
          }
        }
      })
      mockCreateStorageRecord.mockResolvedValue([])
    })

    it('handles empty storage records gracefully', async () => {
      const subjects = [
        {
          name: subjectName,
          digest: { sha256: subjectDigest.replace('sha256:', '') }
        }
      ]

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
      mockGetOctokit.mockReturnValue({
        rest: {
          repos: {
            get: jest.fn<() => Promise<any>>().mockResolvedValue({
              data: { owner: { type: 'Organization' } }
            })
          }
        }
      })
      mockCreateStorageRecord.mockResolvedValue([123])
    })

    it('handles unsupported protocol gracefully', async () => {
      const subjects = [
        {
          name: 'http://registry.example.com/foo/bar',
          digest: { sha256: subjectDigest.replace('sha256:', '') }
        }
      ]

      const result = await createAttestation(subjects, predicate, {
        sigstoreInstance: 'github',
        pushToRegistry: true,
        createStorageRecord: true,
        githubToken: 'gh-token'
      })

      expect(result.attestationDigest).toBe('sha256:abc123')
    })
  })
})
