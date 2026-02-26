import { jest } from '@jest/globals'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import {
  createAttestationResult,
  createOctokitMock,
  TEST_PROVENANCE_PREDICATE
} from '../fixtures/mocks'

import type { Attestation, Predicate } from '@actions/attest'
import type { Descriptor } from '@sigstore/oci'
import type { RunInputs } from '../../src/main'

// Create persistent mock functions
const infoMock = jest.fn()
const warningMock = jest.fn()
const debugMock = jest.fn()
const startGroupMock = jest.fn()
const endGroupMock = jest.fn()
const setOutputMock = jest.fn()
const setFailedMock = jest.fn()

// Create chainable summary mock
const summaryMock = {
  write: jest.fn().mockReturnThis(),
  addRaw: jest.fn().mockReturnThis(),
  addHeading: jest.fn().mockReturnThis(),
  addLink: jest.fn().mockReturnThis(),
  addTable: jest.fn().mockReturnThis(),
  addBreak: jest.fn().mockReturnThis(),
  addSeparator: jest.fn().mockReturnThis(),
  addQuote: jest.fn().mockReturnThis(),
  addCodeBlock: jest.fn().mockReturnThis(),
  addList: jest.fn().mockReturnThis(),
  addImage: jest.fn().mockReturnThis(),
  addDetails: jest.fn().mockReturnThis(),
  addEOL: jest.fn().mockReturnThis(),
  emptyBuffer: jest.fn().mockReturnThis(),
  stringify: jest.fn().mockReturnValue(''),
  isEmptyBuffer: jest.fn().mockReturnValue(true),
  clear: jest.fn().mockReturnThis()
}

const mockGetOctokit = jest.fn()
const mockAttest = jest.fn<() => Promise<Attestation>>()
const mockBuildSLSAProvenancePredicate = jest.fn<() => Promise<Predicate>>()
const mockCreateStorageRecord = jest.fn<() => Promise<number[]>>()
const mockGetRegistryCredentials = jest.fn()
const mockAttachArtifactToImage = jest.fn<() => Promise<Descriptor>>()

// Mutable context for tests
const mockContext = {
  repo: { owner: 'test-owner', repo: 'test-repo' },
  payload: { repository: { visibility: 'private' } },
  serverUrl: 'https://github.com'
}

// Mock @actions/core
jest.unstable_mockModule('@actions/core', () => ({
  info: infoMock,
  warning: warningMock,
  debug: debugMock,
  startGroup: startGroupMock,
  endGroup: endGroupMock,
  setOutput: setOutputMock,
  setFailed: setFailedMock,
  summary: summaryMock
}))

// Mock @actions/github
jest.unstable_mockModule('@actions/github', () => ({
  getOctokit: mockGetOctokit,
  context: mockContext
}))

// Mock @actions/attest
jest.unstable_mockModule('@actions/attest', () => ({
  attest: mockAttest,
  buildSLSAProvenancePredicate: mockBuildSLSAProvenancePredicate,
  createStorageRecord: mockCreateStorageRecord
}))

// Mock @sigstore/oci
jest.unstable_mockModule('@sigstore/oci', () => ({
  getRegistryCredentials: mockGetRegistryCredentials,
  attachArtifactToImage: mockAttachArtifactToImage
}))

// Dynamic import after mocking
const { run } = await import('../../src/main')

const defaultInputs: RunInputs = {
  predicate: '',
  predicateType: '',
  predicatePath: '',
  sbomPath: '',
  subjectName: '',
  subjectDigest: '',
  subjectPath: '',
  subjectChecksums: '',
  pushToRegistry: false,
  createStorageRecord: false,
  subjectVersion: '',
  showSummary: false,
  githubToken: 'test-token',
  privateSigning: false
}

describe('run', () => {
  let tempDir: string
  const originalEnv = { ...process.env }

  beforeEach(async () => {
    jest.clearAllMocks()

    // Reset chainable summary mocks
    for (const key of Object.keys(summaryMock)) {
      if (key !== 'stringify' && key !== 'isEmptyBuffer') {
        ;(
          summaryMock[key as keyof typeof summaryMock] as jest.Mock
        ).mockReturnThis()
      }
    }

    mockAttest.mockResolvedValue(createAttestationResult())
    mockBuildSLSAProvenancePredicate.mockResolvedValue(
      TEST_PROVENANCE_PREDICATE
    )
    mockCreateStorageRecord.mockResolvedValue([12345])
    mockGetOctokit.mockReturnValue(createOctokitMock('Organization'))
    mockGetRegistryCredentials.mockReturnValue({ username: 'u', password: 'p' })
    mockAttachArtifactToImage.mockResolvedValue({
      digest: 'sha256:abc',
      mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
      size: 100
    })

    // Reset context
    mockContext.repo = { owner: 'test-owner', repo: 'test-repo' }
    mockContext.payload = { repository: { visibility: 'private' } }

    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'main-test-'))

    // Set required environment
    process.env.ACTIONS_ID_TOKEN_REQUEST_URL = 'https://token.url'
    process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = 'test-token'
    process.env.RUNNER_TEMP = tempDir
  })

  afterEach(async () => {
    process.env = { ...originalEnv }
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('environment validation', () => {
    it('should fail when ACTIONS_ID_TOKEN_REQUEST_URL is not set', async () => {
      delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL

      await run({
        ...defaultInputs,
        subjectName: 'artifact',
        subjectDigest:
          'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32',
        predicateType: 'https://example.com/predicate',
        predicate: '{}'
      })

      expect(setFailedMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('id-token')
        })
      )
    })
  })

  describe('subject validation', () => {
    it('should fail when no subject inputs are provided', async () => {
      await run(defaultInputs)

      expect(setFailedMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('subject-path')
        })
      )
    })
  })

  describe('attestation type detection', () => {
    it('should detect provenance attestation when no predicate inputs provided', async () => {
      await run({
        ...defaultInputs,
        subjectName: 'artifact',
        subjectDigest:
          'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32'
      })

      expect(infoMock).toHaveBeenCalledWith(
        'Attestation type: Build Provenance'
      )
      expect(mockBuildSLSAProvenancePredicate).toHaveBeenCalled()
    })

    it('should detect custom attestation when predicate inputs provided', async () => {
      await run({
        ...defaultInputs,
        subjectName: 'artifact',
        subjectDigest:
          'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32',
        predicateType: 'https://example.com/predicate',
        predicate: '{}'
      })

      expect(infoMock).toHaveBeenCalledWith('Attestation type: Custom')
      expect(mockBuildSLSAProvenancePredicate).not.toHaveBeenCalled()
    })

    it('should detect SBOM attestation when sbom-path provided', async () => {
      const sbomPath = path.join(tempDir, 'sbom.json')
      await fs.writeFile(
        sbomPath,
        JSON.stringify({
          spdxVersion: 'SPDX-2.3',
          SPDXID: 'SPDXRef-DOCUMENT',
          name: 'test'
        })
      )

      await run({
        ...defaultInputs,
        subjectName: 'artifact',
        subjectDigest:
          'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32',
        sbomPath
      })

      expect(infoMock).toHaveBeenCalledWith('Attestation type: SBOM')
    })

    it('should fail when sbom-path is combined with predicate inputs', async () => {
      await run({
        ...defaultInputs,
        subjectName: 'artifact',
        subjectDigest:
          'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32',
        sbomPath: '/path/to/sbom.json',
        predicateType: 'https://example.com/predicate'
      })

      expect(setFailedMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            'Cannot specify sbom-path together with'
          )
        })
      )
    })
  })

  describe('successful attestation', () => {
    const validInputs: RunInputs = {
      ...defaultInputs,
      subjectName: 'artifact',
      subjectDigest:
        'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32',
      predicateType: 'https://example.com/predicate',
      predicate: '{}'
    }

    it('should create attestation successfully', async () => {
      await run(validInputs)

      expect(setFailedMock).not.toHaveBeenCalled()
      expect(mockAttest).toHaveBeenCalled()
    })

    it('should set output for attestation-id', async () => {
      await run(validInputs)

      expect(setOutputMock).toHaveBeenCalledWith('attestation-id', 'att-123')
    })

    it('should set output for attestation-url', async () => {
      await run(validInputs)

      expect(setOutputMock).toHaveBeenCalledWith(
        'attestation-url',
        'https://github.com/test-owner/test-repo/attestations/att-123'
      )
    })

    it('should set output for bundle-path', async () => {
      await run(validInputs)

      expect(setOutputMock).toHaveBeenCalledWith(
        'bundle-path',
        expect.stringContaining('attestation.json')
      )
    })

    it('should write attestation bundle to file', async () => {
      await run(validInputs)

      const bundlePath = setOutputMock.mock.calls.find(
        (call: unknown[]) => call[0] === 'bundle-path'
      )?.[1] as string

      const content = await fs.readFile(bundlePath, 'utf-8')
      expect(content).toContain('mediaType')
    })
  })

  describe('sigstore instance selection', () => {
    const validInputs: RunInputs = {
      ...defaultInputs,
      subjectName: 'artifact',
      subjectDigest:
        'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32',
      predicateType: 'https://example.com/predicate',
      predicate: '{}'
    }

    it('should use github sigstore for private repos', async () => {
      mockContext.payload = { repository: { visibility: 'private' } }

      await run(validInputs)

      expect(mockAttest).toHaveBeenCalledWith(
        expect.objectContaining({ sigstore: 'github' })
      )
    })

    it('should use public-good sigstore for public repos', async () => {
      mockContext.payload = { repository: { visibility: 'public' } }

      await run(validInputs)

      expect(mockAttest).toHaveBeenCalledWith(
        expect.objectContaining({ sigstore: 'public-good' })
      )
    })

    it('should use github sigstore when privateSigning is true', async () => {
      mockContext.payload = { repository: { visibility: 'public' } }

      await run({ ...validInputs, privateSigning: true })

      expect(mockAttest).toHaveBeenCalledWith(
        expect.objectContaining({ sigstore: 'github' })
      )
    })
  })

  describe('multiple subjects', () => {
    it('should handle multiple subjects from glob pattern', async () => {
      // Create test files
      for (let i = 0; i < 3; i++) {
        await fs.writeFile(path.join(tempDir, `file-${i}.txt`), `content-${i}`)
      }

      await run({
        ...defaultInputs,
        subjectPath: path.join(tempDir, 'file-*.txt'),
        predicateType: 'https://example.com/predicate',
        predicate: '{}'
      })

      expect(setFailedMock).not.toHaveBeenCalled()
      expect(infoMock).toHaveBeenCalledWith(
        expect.stringContaining('3 subjects')
      )
    })

    it('should fail when subject count exceeds maximum', async () => {
      // Create too many files
      for (let i = 0; i < 1025; i++) {
        await fs.writeFile(path.join(tempDir, `file-${i}.txt`), `content-${i}`)
      }

      await run({
        ...defaultInputs,
        subjectPath: path.join(tempDir, 'file-*.txt'),
        predicateType: 'https://example.com/predicate',
        predicate: '{}'
      })

      expect(setFailedMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Too many subjects')
        })
      )
    })
  })

  describe('summary output', () => {
    const validInputs: RunInputs = {
      ...defaultInputs,
      subjectName: 'artifact',
      subjectDigest:
        'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32',
      predicateType: 'https://example.com/predicate',
      predicate: '{}',
      showSummary: true
    }

    it('should write summary when showSummary is true', async () => {
      await run(validInputs)

      expect(summaryMock.addHeading).toHaveBeenCalled()
      expect(summaryMock.write).toHaveBeenCalled()
    })

    it('should not write summary when showSummary is false', async () => {
      await run({ ...validInputs, showSummary: false })

      expect(summaryMock.write).not.toHaveBeenCalled()
    })
  })

  describe('registry push', () => {
    const registryInputs: RunInputs = {
      ...defaultInputs,
      subjectName: 'ghcr.io/test-owner/test-repo',
      subjectDigest:
        'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32',
      predicateType: 'https://example.com/predicate',
      predicate: '{}',
      pushToRegistry: true
    }

    it('should push attestation to registry when enabled', async () => {
      await run(registryInputs)

      expect(mockAttachArtifactToImage).toHaveBeenCalled()
    })

    it('should lowercase subject name for registry push', async () => {
      await run({
        ...registryInputs,
        subjectName: 'ghcr.io/TEST-OWNER/Test-Repo'
      })

      expect(mockAttest).toHaveBeenCalledWith(
        expect.objectContaining({
          subjects: [
            expect.objectContaining({
              name: 'ghcr.io/test-owner/test-repo'
            })
          ]
        })
      )
    })
  })
})
