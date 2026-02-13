/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */
import type { Predicate } from '@actions/attest'
import { jest } from '@jest/globals'
import type { RunInputs } from '../src/main'

// Create mock functions before mocking modules
const infoMock = jest.fn()
const warningMock = jest.fn()
const startGroupMock = jest.fn()
const endGroupMock = jest.fn()
const setOutputMock = jest.fn()
const setFailedMock = jest.fn()

// OCI mocks
const getRegCredsMock = jest.fn()
const attachArtifactMock = jest.fn()

// Attest mocks
const attestMock = jest.fn()
const createStorageRecordMock = jest.fn()

// Local attest mocks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createAttestationMock = jest.fn<() => Promise<any>>()
const repoOwnerIsOrgMock = jest.fn()

// Provenance mock
const generateProvenancePredicateMock = jest.fn<() => Promise<Predicate>>()

// GitHub context mock
const mockContext = {
  repo: { owner: 'foo', repo: 'bar' },
  payload: { repository: { visibility: 'private' } }
}
const mockGetOctokit = jest.fn()

// Summary mock with chainable methods
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

// Mock @actions/core
jest.unstable_mockModule('@actions/core', () => ({
  info: infoMock,
  warning: warningMock,
  startGroup: startGroupMock,
  endGroup: endGroupMock,
  setOutput: setOutputMock,
  setFailed: setFailedMock,
  summary: summaryMock
}))

// Mock @actions/github
jest.unstable_mockModule('@actions/github', () => ({
  context: mockContext,
  getOctokit: mockGetOctokit
}))

// Mock @sigstore/oci
jest.unstable_mockModule('@sigstore/oci', () => ({
  getRegistryCredentials: getRegCredsMock,
  attachArtifactToImage: attachArtifactMock
}))

// Mock @actions/attest
jest.unstable_mockModule('@actions/attest', () => ({
  attest: attestMock,
  createStorageRecord: createStorageRecordMock
}))

// Mock ../src/attest
jest.unstable_mockModule('../src/attest', () => ({
  createAttestation: createAttestationMock,
  repoOwnerIsOrg: repoOwnerIsOrgMock
}))

// Mock ../src/provenance
jest.unstable_mockModule('../src/provenance', () => ({
  generateProvenancePredicate: generateProvenancePredicateMock
}))

// Dynamic imports after mocking
const { mockFulcio, mockRekor, mockTSA } = await import('@sigstore/mock')
const fs = (await import('fs/promises')).default
const nock = (await import('nock')).default
const os = (await import('os')).default
const path = (await import('path')).default
const { MockAgent, setGlobalDispatcher } = await import('undici')
const { run } = await import('../src/main')

// MockAgent for mocking @actions/github
const mockAgent = new MockAgent()
setGlobalDispatcher(mockAgent)

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
  createStorageRecord: true,
  showSummary: true,
  githubToken: '',
  privateSigning: false
}

describe('action', () => {
  // Capture original environment variables so we can restore after each test
  const originalEnv = process.env
  const originalContext = {
    repo: { owner: 'foo', repo: 'bar' },
    payload: { repository: { visibility: 'private' } }
  }

  // Mock OIDC token endpoint
  const tokenURL = 'https://token.url'

  // Fake an OIDC token
  const oidcSubject = 'foo@bar.com'
  const oidcPayload = { sub: oidcSubject, iss: '' }
  const oidcToken = `.${Buffer.from(JSON.stringify(oidcPayload)).toString(
    'base64'
  )}.}`

  const subjectName = 'ghcr.io/registry/foo/bar'
  const subjectDigest =
    'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32'
  const predicate = '{}'
  const predicateType = 'https://in-toto.io/attestation/release/v0.1'

  const attestationID = '1234567890'
  const storageRecordID = 987654321

  beforeEach(() => {
    jest.clearAllMocks()

    nock(tokenURL)
      .get('/')
      .query({ audience: 'sigstore' })
      .reply(200, { value: oidcToken })

    const pool = mockAgent.get('https://api.github.com')
    pool
      .intercept({
        path: /^\/repos\/.*\/.*\/attestations$/,
        method: 'post'
      })
      .reply(201, { id: attestationID })

    pool
      .intercept({
        path: /^\/orgs\/.*\/artifacts\/metadata\/storage-record$/,
        method: 'post'
      })
      .reply(200, { storage_records: [{ id: storageRecordID }] })

    process.env = {
      ...originalEnv,
      ACTIONS_ID_TOKEN_REQUEST_URL: tokenURL,
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'token',
      RUNNER_TEMP: process.env.RUNNER_TEMP || '/tmp'
    }
  })

  afterEach(() => {
    // Restore the original environment
    process.env = originalEnv

    // Restore the original github.context
    setGHContext(originalContext)
  })

  describe('when ACTIONS_ID_TOKEN_REQUEST_URL is not set', () => {
    const inputs: RunInputs = {
      ...defaultInputs,
      subjectDigest,
      subjectName,
      predicateType,
      predicate,
      githubToken: 'gh-token'
    }

    beforeEach(() => {
      // Nullify the OIDC token URL
      process.env.ACTIONS_ID_TOKEN_REQUEST_URL = ''
    })

    it('sets a failed status', async () => {
      await run(inputs)

      expect(setFailedMock).toHaveBeenCalledWith(
        new Error(
          'missing "id-token" permission. Please add "permissions: id-token: write" to your workflow.'
        )
      )
    })
  })

  describe('when no inputs are provided', () => {
    it('sets a failed status', async () => {
      await run(defaultInputs)

      expect(setFailedMock).toHaveBeenCalledWith(
        new Error(
          'One of subject-path, subject-digest, or subject-checksums must be provided'
        )
      )
    })
  })

  describe('when the repository is private', () => {
    const inputs: RunInputs = {
      ...defaultInputs,
      subjectDigest,
      subjectName,
      predicateType,
      predicate,
      githubToken: 'gh-token'
    }

    beforeEach(async () => {
      // Set the GH context with private repository visibility and a repo owner.
      setGHContext({
        payload: { repository: { visibility: 'private' } },
        repo: { owner: 'foo', repo: 'bar' }
      })

      // Mock createAttestation to return expected values
      createAttestationMock.mockResolvedValue({
        attestationID,
        certificate:
          '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
        tlogID: 'tlog-123',
        attestationDigest: 'sha256:123456',
        bundle: { mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json' }
      })

      await mockFulcio({
        baseURL: 'https://fulcio.githubapp.com',
        strict: false
      })
      await mockTSA({ baseURL: 'https://timestamp.githubapp.com' })
    })

    it('invokes the action w/o error', async () => {
      await run(inputs)

      expect(setFailedMock).not.toHaveBeenCalled()
      expect(infoMock).toHaveBeenCalledWith('Attestation type: Custom')
      expect(infoMock).toHaveBeenCalledWith(
        expect.stringMatching(
          `Attestation created for ${subjectName}@${subjectDigest}`
        )
      )
      expect(createAttestationMock).toHaveBeenCalled()
    })
  })

  describe('when the repository is public', () => {
    const inputs: RunInputs = {
      ...defaultInputs,
      subjectDigest,
      subjectName,
      predicateType,
      predicate,
      githubToken: 'gh-token',
      pushToRegistry: true
    }

    beforeEach(async () => {
      // Set the GH context with public repository visibility and a repo owner.
      setGHContext({
        payload: { repository: { visibility: 'public' } },
        repo: { owner: 'foo', repo: 'bar' }
      })

      // Setup createAttestation mock
      createAttestationMock.mockResolvedValue({
        attestationID,
        certificate:
          '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
        tlogID: 'tlog-123',
        attestationDigest: 'sha256:123456',
        bundle: { mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json' },
        storageRecordIds: [storageRecordID]
      })

      await mockFulcio({
        baseURL: 'https://fulcio.sigstore.dev',
        strict: false
      })
      await mockRekor({ baseURL: 'https://rekor.sigstore.dev' })

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
    })

    it('invokes the action w/o error', async () => {
      await run(inputs)

      expect(setFailedMock).not.toHaveBeenCalled()
      expect(createAttestationMock).toHaveBeenCalled()
      expect(infoMock).toHaveBeenCalledWith('Attestation type: Custom')
      expect(infoMock).toHaveBeenCalledWith(
        expect.stringMatching(
          `Attestation created for ${subjectName}@${subjectDigest}`
        )
      )
    })

    it('catches error when storage record creation fails and continues', async () => {
      // Mock createAttestation to simulate storage record failure (but still succeed overall)
      createAttestationMock.mockResolvedValue({
        attestationID,
        certificate:
          '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
        tlogID: 'tlog-123',
        attestationDigest: 'sha256:123456',
        bundle: { mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json' }
        // No storageRecordIDs - simulates empty/failed storage record
      })

      await run(inputs)

      expect(createAttestationMock).toHaveBeenCalled()
      expect(setFailedMock).not.toHaveBeenCalled()
    })

    it('does not create a storage record when the repo is owned by a user', async () => {
      // Mock createAttestation to not return storage record IDs
      createAttestationMock.mockResolvedValue({
        attestationID,
        certificate:
          '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
        tlogID: 'tlog-123',
        attestationDigest: 'sha256:123456',
        bundle: { mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json' }
      })

      await run(inputs)

      expect(setFailedMock).not.toHaveBeenCalled()
      expect(createAttestationMock).toHaveBeenCalled()
      expect(infoMock).toHaveBeenCalledWith(
        expect.stringMatching(
          `Attestation created for ${subjectName}@${subjectDigest}`
        )
      )
    })
  })

  describe('when the subject count is greater than 1', () => {
    let dir = ''
    const filename = 'subject'

    beforeEach(async () => {
      const subjectCount = 5
      const content = 'file content'

      // Set-up temp directory
      const tmpDir = await fs.realpath(os.tmpdir())
      dir = await fs.mkdtemp(tmpDir + path.sep)

      // Add files for glob testing
      for (let i = 0; i < subjectCount; i++) {
        await fs.writeFile(path.join(dir, `${filename}-${i}`), content)
      }

      // Set the GH context with private repository visibility and a repo owner.
      setGHContext({
        payload: { repository: { visibility: 'private' } },
        repo: { owner: 'foo', repo: 'bar' }
      })

      // Set-up a Fulcio mock for each subject
      await mockFulcio({
        baseURL: 'https://fulcio.githubapp.com',
        strict: false
      })

      // Set-up a TSA mock for each subject
      await mockTSA({ baseURL: 'https://timestamp.githubapp.com' })
    })

    afterEach(async () => {
      // Clean-up temp directory
      await fs.rm(dir, { recursive: true })
    })

    it('invokes the action w/o error', async () => {
      const inputs: RunInputs = {
        ...defaultInputs,
        subjectPath: path.join(dir, `${filename}-*`),
        predicateType,
        predicate,
        githubToken: 'gh-token'
      }
      await run(inputs)

      expect(setFailedMock).not.toHaveBeenCalled()
      expect(infoMock).toHaveBeenNthCalledWith(1, 'Attestation type: Custom')
      expect(infoMock).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching('Attestation created for 5 subjects')
      )
    })
  })

  describe('when the subject count exceeds the max', () => {
    let dir = ''
    const filename = 'subject'

    beforeEach(async () => {
      const subjectCount = 1025
      const content = 'file content'

      // Set-up temp directory
      const tmpDir = await fs.realpath(os.tmpdir())
      dir = await fs.mkdtemp(tmpDir + path.sep)

      // Add files for glob testing
      for (let i = 0; i < subjectCount; i++) {
        await fs.writeFile(path.join(dir, `${filename}-${i}`), content)
      }

      // Set the GH context with private repository visibility and a repo owner.
      setGHContext({
        payload: { repository: { visibility: 'private' } },
        repo: { owner: 'foo', repo: 'bar' }
      })
    })

    afterEach(async () => {
      // Clean-up temp directory
      await fs.rm(dir, { recursive: true })
    })

    it('sets a failed status', async () => {
      const inputs: RunInputs = {
        ...defaultInputs,
        subjectPath: path.join(dir, `${filename}-*`),
        predicateType,
        predicate,
        githubToken: 'gh-token'
      }
      await run(inputs)

      expect(setFailedMock).toHaveBeenCalledWith(
        new Error(
          'Too many subjects specified (1025). The maximum number of subjects is 1024.'
        )
      )
    })
  })

  describe('attestation type detection', () => {
    describe('when sbom-path is provided with predicate inputs', () => {
      it('sets a failed status for conflicting inputs', async () => {
        const inputs: RunInputs = {
          ...defaultInputs,
          subjectDigest,
          subjectName,
          sbomPath: '/path/to/sbom.json',
          predicateType: 'https://example.com/predicate',
          githubToken: 'gh-token'
        }

        await run(inputs)

        expect(setFailedMock).toHaveBeenCalledWith(
          new Error(
            'Cannot specify sbom-path together with predicate-type, predicate, or predicate-path'
          )
        )
      })
    })

    describe('when predicate is provided without predicate-type', () => {
      it('sets a failed status for missing predicate-type', async () => {
        const inputs: RunInputs = {
          ...defaultInputs,
          subjectDigest,
          subjectName,
          predicate: '{}',
          githubToken: 'gh-token'
        }

        await run(inputs)

        expect(setFailedMock).toHaveBeenCalledWith(
          new Error(
            'predicate-type is required when using predicate or predicate-path'
          )
        )
      })
    })

    describe('when custom attestation inputs are provided', () => {
      const inputs: RunInputs = {
        ...defaultInputs,
        subjectDigest,
        subjectName,
        predicateType,
        predicate,
        githubToken: 'gh-token'
      }

      beforeEach(async () => {
        setGHContext({
          payload: { repository: { visibility: 'private' } },
          repo: { owner: 'foo', repo: 'bar' }
        })

        await mockFulcio({
          baseURL: 'https://fulcio.githubapp.com',
          strict: false
        })
        await mockTSA({ baseURL: 'https://timestamp.githubapp.com' })
      })

      it('logs the attestation type as Custom', async () => {
        await run(inputs)

        expect(setFailedMock).not.toHaveBeenCalled()
        expect(infoMock).toHaveBeenCalledWith('Attestation type: Custom')
      })
    })

    describe('when provenance attestation is detected', () => {
      const inputs: RunInputs = {
        ...defaultInputs,
        subjectDigest,
        subjectName,
        githubToken: 'gh-token'
      }

      const mockProvPredicate = {
        type: 'https://slsa.dev/provenance/v1',
        params: { buildDefinition: {}, runDetails: {} }
      }

      beforeEach(async () => {
        // Configure mock for provenance predicate
        generateProvenancePredicateMock.mockResolvedValue(mockProvPredicate)

        // Configure mock for createAttestation
        createAttestationMock.mockResolvedValue({
          attestationID: '1234567890',
          certificate:
            '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
          tlogID: 'tlog-123',
          attestationDigest: 'sha256:123456',
          bundle: { mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json' }
        })

        setGHContext({
          payload: { repository: { visibility: 'private' } },
          repo: { owner: 'foo', repo: 'bar' }
        })

        await mockFulcio({
          baseURL: 'https://fulcio.githubapp.com',
          strict: false
        })
        await mockTSA({ baseURL: 'https://timestamp.githubapp.com' })
      })

      it('logs the attestation type as Build Provenance and generates predicate', async () => {
        await run(inputs)

        expect(setFailedMock).not.toHaveBeenCalled()
        expect(infoMock).toHaveBeenCalledWith(
          'Attestation type: Build Provenance'
        )
      })
    })

    describe('when sbom attestation is detected', () => {
      let tmpDir: string
      let sbomFilePath: string

      const spdxSBOM = {
        spdxVersion: 'SPDX-2.3',
        SPDXID: 'SPDXRef-DOCUMENT',
        name: 'test-package',
        packages: []
      }

      beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'main-test-'))
        sbomFilePath = path.join(tmpDir, 'sbom.spdx.json')
        await fs.writeFile(sbomFilePath, JSON.stringify(spdxSBOM))

        setGHContext({
          payload: { repository: { visibility: 'private' } },
          repo: { owner: 'foo', repo: 'bar' }
        })

        await mockFulcio({
          baseURL: 'https://fulcio.githubapp.com',
          strict: false
        })
        await mockTSA({ baseURL: 'https://timestamp.githubapp.com' })
      })

      afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true })
      })

      it('logs the attestation type as SBOM and generates predicate', async () => {
        const inputs: RunInputs = {
          ...defaultInputs,
          subjectDigest,
          subjectName,
          sbomPath: sbomFilePath,
          githubToken: 'gh-token'
        }

        await run(inputs)

        expect(setFailedMock).not.toHaveBeenCalled()
        expect(infoMock).toHaveBeenCalledWith('Attestation type: SBOM')
      })
    })
  })
})

// Helper to update the mock context
function setGHContext(context: {
  repo?: { owner: string; repo: string }
  payload?: { repository?: { visibility: string } }
}): void {
  if (context.repo) {
    mockContext.repo = context.repo
  }
  if (context.payload) {
    mockContext.payload = context.payload as typeof mockContext.payload
  }
}
