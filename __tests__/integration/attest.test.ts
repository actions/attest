import { jest } from '@jest/globals'
import {
  createAttestationResult,
  createGitHubContextMock,
  createOctokitMock,
  TEST_PREDICATE,
  TEST_SUBJECT_WITH_REGISTRY
} from '../fixtures/mocks'

import type { Attestation } from '@actions/attest'
import type { Descriptor } from '@sigstore/oci'

// Mock functions
const mockGetOctokit = jest.fn()
const mockAttest = jest.fn<() => Promise<Attestation>>()
const mockCreateStorageRecord = jest.fn<() => Promise<number[]>>()
const mockGetRegistryCredentials = jest.fn()
const mockAttachArtifactToImage = jest.fn<() => Promise<Descriptor>>()

// Mutable context for tests
const mockContext = createGitHubContextMock()

// Mock @actions/github
jest.unstable_mockModule('@actions/github', () => ({
  getOctokit: mockGetOctokit,
  context: mockContext
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
const { createAttestation, repoOwnerIsOrg } = await import('../../src/attest')

describe('repoOwnerIsOrg', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return true when repo owner is an Organization', async () => {
    mockGetOctokit.mockReturnValue(createOctokitMock('Organization'))

    const result = await repoOwnerIsOrg('test-token')

    expect(result).toBe(true)
    expect(mockGetOctokit).toHaveBeenCalledWith('test-token')
  })

  it('should return false when repo owner is a User', async () => {
    mockGetOctokit.mockReturnValue(createOctokitMock('User'))

    const result = await repoOwnerIsOrg('test-token')

    expect(result).toBe(false)
  })
})

describe('createAttestation', () => {
  const defaultOpts = {
    sigstoreInstance: 'github' as const,
    pushToRegistry: false,
    createStorageRecord: false,
    githubToken: 'test-token'
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockAttest.mockResolvedValue(createAttestationResult())
    mockGetRegistryCredentials.mockReturnValue({
      username: 'test-user',
      password: 'test-pass'
    })
    mockAttachArtifactToImage.mockResolvedValue({
      digest: 'sha256:attestation-digest',
      mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
      size: 1234
    })
    mockCreateStorageRecord.mockResolvedValue([12345])
    mockGetOctokit.mockReturnValue(createOctokitMock('Organization'))
  })

  describe('basic attestation', () => {
    it('should call attest with correct parameters', async () => {
      const subjects = [TEST_SUBJECT_WITH_REGISTRY]

      await createAttestation(subjects, TEST_PREDICATE, defaultOpts)

      expect(mockAttest).toHaveBeenCalledWith({
        subjects,
        predicateType: TEST_PREDICATE.type,
        predicate: TEST_PREDICATE.params,
        sigstore: 'github',
        token: 'test-token'
      })
    })

    it('should return attestation result', async () => {
      const subjects = [TEST_SUBJECT_WITH_REGISTRY]

      const result = await createAttestation(
        subjects,
        TEST_PREDICATE,
        defaultOpts
      )

      expect(result.attestationID).toBe('att-123')
      expect(result.certificate).toContain('BEGIN CERTIFICATE')
      expect(result.tlogID).toBe('tlog-123')
    })
  })

  describe('registry push', () => {
    const pushOpts = { ...defaultOpts, pushToRegistry: true }

    it('should push attestation to registry when enabled', async () => {
      const subjects = [TEST_SUBJECT_WITH_REGISTRY]

      const result = await createAttestation(subjects, TEST_PREDICATE, pushOpts)

      expect(mockGetRegistryCredentials).toHaveBeenCalledWith(subjects[0].name)
      expect(mockAttachArtifactToImage).toHaveBeenCalled()
      expect(result.attestationDigest).toBe('sha256:attestation-digest')
    })

    it('should skip registry push for multiple subjects', async () => {
      const subjects = [TEST_SUBJECT_WITH_REGISTRY, TEST_SUBJECT_WITH_REGISTRY]

      await createAttestation(subjects, TEST_PREDICATE, pushOpts)

      expect(mockAttachArtifactToImage).not.toHaveBeenCalled()
    })
  })

  describe('storage record creation', () => {
    const storageOpts = {
      ...defaultOpts,
      pushToRegistry: true,
      createStorageRecord: true,
      subjectVersion: '1.2.3'
    }

    it('should create storage record when enabled and owner is org', async () => {
      const subjects = [TEST_SUBJECT_WITH_REGISTRY]

      const result = await createAttestation(
        subjects,
        TEST_PREDICATE,
        storageOpts
      )

      expect(mockCreateStorageRecord).toHaveBeenCalledWith(
        expect.objectContaining({ version: '1.2.3' }),
        expect.anything(),
        expect.anything()
      )
      expect(result.storageRecordIds).toEqual([12345])
    })

    it('should omit version from storage record when subjectVersion is empty', async () => {
      const subjects = [TEST_SUBJECT_WITH_REGISTRY]
      const opts = { ...storageOpts, subjectVersion: '' }

      await createAttestation(subjects, TEST_PREDICATE, opts)

      expect(mockCreateStorageRecord).toHaveBeenCalledWith(
        expect.objectContaining({ version: undefined }),
        expect.anything(),
        expect.anything()
      )
    })

    it('should skip storage record when owner is User', async () => {
      mockGetOctokit.mockReturnValue(createOctokitMock('User'))
      const subjects = [TEST_SUBJECT_WITH_REGISTRY]

      const result = await createAttestation(
        subjects,
        TEST_PREDICATE,
        storageOpts
      )

      expect(mockCreateStorageRecord).not.toHaveBeenCalled()
      expect(result.storageRecordIds).toBeUndefined()
    })

    it('should skip storage record when createStorageRecord is false', async () => {
      const subjects = [TEST_SUBJECT_WITH_REGISTRY]
      const opts = { ...storageOpts, createStorageRecord: false }

      await createAttestation(subjects, TEST_PREDICATE, opts)

      expect(mockCreateStorageRecord).not.toHaveBeenCalled()
    })

    it('should handle empty storage records gracefully', async () => {
      mockCreateStorageRecord.mockResolvedValue([])
      const subjects = [TEST_SUBJECT_WITH_REGISTRY]

      const result = await createAttestation(
        subjects,
        TEST_PREDICATE,
        storageOpts
      )

      expect(result.storageRecordIds).toEqual([])
    })

    it('should continue when storage record creation fails', async () => {
      mockCreateStorageRecord.mockRejectedValue(new Error('Permission denied'))
      const subjects = [TEST_SUBJECT_WITH_REGISTRY]

      // Should not throw
      const result = await createAttestation(
        subjects,
        TEST_PREDICATE,
        storageOpts
      )

      expect(result.attestationID).toBe('att-123')
      expect(result.storageRecordIds).toBeUndefined()
    })
  })

  describe('sigstore instance selection', () => {
    it('should use public-good sigstore instance when specified', async () => {
      const subjects = [TEST_SUBJECT_WITH_REGISTRY]
      const opts = { ...defaultOpts, sigstoreInstance: 'public-good' as const }

      await createAttestation(subjects, TEST_PREDICATE, opts)

      expect(mockAttest).toHaveBeenCalledWith(
        expect.objectContaining({ sigstore: 'public-good' })
      )
    })
  })
})
