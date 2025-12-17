/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */
import * as core from '@actions/core'
import * as github from '@actions/github'
import { mockFulcio, mockRekor, mockTSA } from '@sigstore/mock'
import * as oci from '@sigstore/oci'
import fs from 'fs/promises'
import nock from 'nock'
import os from 'os'
import path from 'path'
import { MockAgent, setGlobalDispatcher } from 'undici'
import { SEARCH_PUBLIC_GOOD_URL } from '../src/endpoints'
import * as main from '../src/main'

// Mock the GitHub Actions core library
const infoMock = jest.spyOn(core, 'info')
const warningMock = jest.spyOn(core, 'warning')
const startGroupMock = jest.spyOn(core, 'startGroup')
const setOutputMock = jest.spyOn(core, 'setOutput')
const setFailedMock = jest.spyOn(core, 'setFailed')

// Ensure that setFailed doesn't set an exit code during tests
setFailedMock.mockImplementation(() => {})

const summaryWriteMock = jest.spyOn(core.summary, 'write')
summaryWriteMock.mockImplementation(async () => Promise.resolve(core.summary))

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// MockAgent for mocking @actions/github
const mockAgent = new MockAgent()
setGlobalDispatcher(mockAgent)

const defaultInputs: main.RunInputs = {
  predicate: '',
  predicateType: '',
  predicatePath: '',
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
  // Capture original environment variables and GitHub context so we can restore
  // them after each test
  const originalEnv = process.env
  const originalContext = { ...github.context }

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
    const inputs: main.RunInputs = {
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
      await main.run(inputs)

      expect(runMock).toHaveReturned()
      expect(setFailedMock).toHaveBeenCalledWith(
        new Error(
          'missing "id-token" permission. Please add "permissions: id-token: write" to your workflow.'
        )
      )
    })
  })

  describe('when no inputs are provided', () => {
    it('sets a failed status', async () => {
      await main.run(defaultInputs)

      expect(runMock).toHaveReturned()
      expect(setFailedMock).toHaveBeenCalledWith(
        new Error(
          'One of subject-path, subject-digest, or subject-checksums must be provided'
        )
      )
    })
  })

  describe('when the repository is private', () => {
    const inputs: main.RunInputs = {
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

      await mockFulcio({
        baseURL: 'https://fulcio.githubapp.com',
        strict: false
      })
      await mockTSA({ baseURL: 'https://timestamp.githubapp.com' })
    })

    it('invokes the action w/o error', async () => {
      await main.run(inputs)

      expect(runMock).toHaveReturned()
      expect(setFailedMock).not.toHaveBeenCalledWith()
      expect(infoMock).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching(
          `Attestation created for ${subjectName}@${subjectDigest}`
        )
      )
      expect(startGroupMock).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching('GitHub Sigstore')
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching('-----BEGIN CERTIFICATE-----')
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        3,
        expect.stringMatching(/attestation uploaded/i)
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        4,
        expect.stringMatching(attestationID)
      )
      expect(setOutputMock).toHaveBeenNthCalledWith(
        1,
        'bundle-path',
        expect.stringMatching('attestation.json')
      )
      expect(setOutputMock).toHaveBeenNthCalledWith(
        2,
        'attestation-id',
        expect.stringMatching(attestationID)
      )
      expect(setOutputMock).toHaveBeenNthCalledWith(
        3,
        'attestation-url',
        expect.stringContaining(`foo/bar/attestations/${attestationID}`)
      )
      expect(setFailedMock).not.toHaveBeenCalled()
    })
  })

  describe('when the repository is public', () => {
    const getRegCredsSpy = jest.spyOn(oci, 'getRegistryCredentials')
    const attachArtifactSpy = jest.spyOn(oci, 'attachArtifactToImage')

    const inputs: main.RunInputs = {
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

      await mockFulcio({
        baseURL: 'https://fulcio.sigstore.dev',
        strict: false
      })
      await mockRekor({ baseURL: 'https://rekor.sigstore.dev' })

      getRegCredsSpy.mockImplementation(() => ({
        username: 'username',
        password: 'password'
      }))
      attachArtifactSpy.mockImplementation(async () =>
        Promise.resolve({
          digest: 'sha256:123456',
          mediaType: 'application/vnd.cncf.notary.v2',
          size: 123456
        })
      )
    })

    it('invokes the action w/o error', async () => {
      await main.run(inputs)

      expect(runMock).toHaveReturned()
      expect(setFailedMock).not.toHaveBeenCalled()
      expect(getRegCredsSpy).toHaveBeenCalledWith(subjectName)
      expect(attachArtifactSpy).toHaveBeenCalled()
      expect(warningMock).not.toHaveBeenCalled()
      expect(infoMock).toHaveBeenNthCalledWith(
        9,
        expect.stringMatching('Storage record created')
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        10,
        expect.stringMatching('Storage record IDs: 987654321')
      )
      expect(setOutputMock).toHaveBeenNthCalledWith(
        4,
        'storage-record-ids',
        expect.stringMatching(storageRecordID.toString())
      )
      expect(setFailedMock).not.toHaveBeenCalled()
    })
  })

  describe('handles failure to create storage record gracefully', () => {
    const getRegCredsSpy = jest.spyOn(oci, 'getRegistryCredentials')
    const attachArtifactSpy = jest.spyOn(oci, 'attachArtifactToImage')

    const inputs: main.RunInputs = {
      ...defaultInputs,
      subjectDigest,
      subjectName,
      predicateType,
      predicate,
      githubToken: 'gh-token',
      pushToRegistry: true
    }
    
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
        .reply(404, { message: 'Artifacts not found' })

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

    it('when storage record creation fails, it logs a warning and continues', async () => {
      await main.run(inputs)

      expect(runMock).toHaveReturned()
      expect(setFailedMock).not.toHaveBeenCalled()
      expect(getRegCredsSpy).toHaveBeenCalledWith(subjectName)
      expect(attachArtifactSpy).toHaveBeenCalled()
      expect(warningMock).toHaveBeenCalled()
      expect(warningMock).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching('Failed to create storage record')
      )
      expect(setFailedMock).not.toHaveBeenCalled()
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
      const inputs: main.RunInputs = {
        ...defaultInputs,
        subjectPath: path.join(dir, `${filename}-*`),
        predicateType,
        predicate,
        githubToken: 'gh-token'
      }
      await main.run(inputs)

      expect(runMock).toHaveReturned()
      expect(setFailedMock).not.toHaveBeenCalled()
      expect(infoMock).toHaveBeenNthCalledWith(
        1,
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
      const inputs: main.RunInputs = {
        ...defaultInputs,
        subjectPath: path.join(dir, `${filename}-*`),
        predicateType,
        predicate,
        githubToken: 'gh-token'
      }
      await main.run(inputs)

      expect(runMock).toHaveReturned()
      expect(setFailedMock).toHaveBeenCalledWith(
        new Error(
          'Too many subjects specified. The maximum number of subjects is 1024.'
        )
      )
    })
  })
})

// Stubbing the GitHub context is a bit tricky. We need to use
// `Object.defineProperty` because `github.context` is read-only.
function setGHContext(context: object): void {
  Object.defineProperty(github, 'context', { value: context })
}
