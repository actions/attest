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
const startGroupMock = jest.spyOn(core, 'startGroup')
const getInputMock = jest.spyOn(core, 'getInput')
const getBooleanInputMock = jest.spyOn(core, 'getBooleanInput')
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

describe('action', () => {
  // Capture original environment variables and GitHub context so we can restore
  // them after each test
  const originalEnv = process.env
  const originalContext = { ...github.context }

  // Fake an OIDC token
  const oidcSubject = 'foo@bar.com'
  const oidcPayload = { sub: oidcSubject, iss: '' }
  const oidcToken = `.${Buffer.from(JSON.stringify(oidcPayload)).toString(
    'base64'
  )}.}`

  const subjectName = 'registry/foo/bar'
  const subjectDigest =
    'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32'
  const predicate = '{}'
  const predicateType = 'https://in-toto.io/attestation/release/v0.1'

  const attestationID = '1234567890'

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock OIDC token endpoint
    const tokenURL = 'https://token.url'

    nock(tokenURL)
      .get('/')
      .query({ audience: 'sigstore' })
      .reply(200, { value: oidcToken })

    mockAgent
      .get('https://api.github.com')
      .intercept({
        path: /^\/repos\/.*\/.*\/attestations$/,
        method: 'post'
      })
      .reply(201, { id: attestationID })

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
    const inputs = {
      'subject-digest': subjectDigest,
      'subject-name': subjectName,
      'predicate-type': predicateType,
      predicate,
      'github-token': 'gh-token'
    }

    beforeEach(() => {
      // Nullify the OIDC token URL
      process.env.ACTIONS_ID_TOKEN_REQUEST_URL = ''

      getInputMock.mockImplementation(mockInput(inputs))
      getBooleanInputMock.mockImplementation(() => false)
    })

    it('sets a failed status', async () => {
      await main.run()

      expect(runMock).toHaveReturned()
      expect(setFailedMock).toHaveBeenCalledWith(
        new Error(
          'missing "id-token" permission. Please add "permissions: id-token: write" to your workflow.'
        )
      )
    })
  })

  describe('when no inputs are provided', () => {
    beforeEach(() => {
      getInputMock.mockImplementation(() => '')
    })

    it('sets a failed status', async () => {
      await main.run()

      expect(runMock).toHaveReturned()
      expect(setFailedMock).toHaveBeenCalledWith(
        new Error('One of subject-path or subject-digest must be provided')
      )
    })
  })

  describe('when the repository is private', () => {
    const inputs = {
      'subject-digest': subjectDigest,
      'subject-name': subjectName,
      'predicate-type': predicateType,
      predicate,
      'github-token': 'gh-token'
    }

    beforeEach(async () => {
      // Set the GH context with private repository visibility and a repo owner.
      setGHContext({
        payload: { repository: { visibility: 'private' } },
        repo: { owner: 'foo', repo: 'bar' }
      })

      getInputMock.mockImplementation(mockInput(inputs))
      getBooleanInputMock.mockImplementation(() => false)

      await mockFulcio({
        baseURL: 'https://fulcio.githubapp.com',
        strict: false
      })
      await mockTSA({ baseURL: 'https://timestamp.githubapp.com' })
    })

    it('invokes the action w/o error', async () => {
      await main.run()

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
        expect.stringMatching('attestation.jsonl')
      )
      expect(setFailedMock).not.toHaveBeenCalled()
    })
  })

  describe('when the repository is public', () => {
    const getRegCredsSpy = jest.spyOn(oci, 'getRegistryCredentials')
    const attachArtifactSpy = jest.spyOn(oci, 'attachArtifactToImage')

    const inputs = {
      'subject-digest': subjectDigest,
      'subject-name': subjectName,
      'predicate-type': predicateType,
      predicate,
      'github-token': 'gh-token'
    }

    beforeEach(async () => {
      // Set the GH context with public repository visibility and a repo owner.
      setGHContext({
        payload: { repository: { visibility: 'public' } },
        repo: { owner: 'foo', repo: 'bar' }
      })

      // Mock the action's inputs
      getInputMock.mockImplementation(mockInput(inputs))
      // This is where we mock the push-to-registry input
      getBooleanInputMock.mockImplementation(() => true)

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
      await main.run()

      expect(runMock).toHaveReturned()
      expect(setFailedMock).not.toHaveBeenCalled()
      expect(getRegCredsSpy).toHaveBeenCalledWith(subjectName)
      expect(attachArtifactSpy).toHaveBeenCalled()
      expect(infoMock).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching(
          `Attestation created for ${subjectName}@${subjectDigest}`
        )
      )
      expect(startGroupMock).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching('Public Good Sigstore')
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching('-----BEGIN CERTIFICATE-----')
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        3,
        expect.stringMatching(/signature uploaded/i)
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        4,
        expect.stringMatching(SEARCH_PUBLIC_GOOD_URL)
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        5,
        expect.stringMatching(/attestation uploaded/i)
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        6,
        expect.stringMatching(attestationID)
      )
      expect(setOutputMock).toHaveBeenNthCalledWith(
        1,
        'bundle-path',
        expect.stringMatching('attestation.jsonl')
      )
      expect(setFailedMock).not.toHaveBeenCalled()
    })
  })

  describe('when too many subjects are specified', () => {
    let dir = ''

    beforeEach(async () => {
      const filename = 'subject'
      const content = 'file content'

      // Set-up temp directory
      const tmpDir = await fs.realpath(os.tmpdir())
      dir = await fs.mkdtemp(tmpDir + path.sep)

      // Add files for glob testing
      for (let i = 0; i < 65; i++) {
        await fs.writeFile(path.join(dir, `${filename}-${i}`), content)
      }

      // Set the GH context with private repository visibility and a repo owner.
      setGHContext({
        payload: { repository: { visibility: 'private' } },
        repo: { owner: 'foo', repo: 'bar' }
      })

      // Mock the action's inputs
      getInputMock.mockImplementation(
        mockInput({
          predicate: '{}',
          'subject-path': path.join(dir, `${filename}-*`)
        })
      )
    })

    afterEach(async () => {
      // Clean-up temp directory
      await fs.rm(dir, { recursive: true })
    })

    it('sets a failed status', async () => {
      await main.run()

      expect(runMock).toHaveReturned()
      expect(setFailedMock).toHaveBeenCalledWith(
        new Error(
          'Too many subjects specified. The maximum number of subjects is 64.'
        )
      )
    })
  })
})

function mockInput(inputs: Record<string, string>): typeof core.getInput {
  return (name: string): string => {
    if (name in inputs) {
      return inputs[name]
    }
    return ''
  }
}

// Stubbing the GitHub context is a bit tricky. We need to use
// `Object.defineProperty` because `github.context` is read-only.
function setGHContext(context: object): void {
  Object.defineProperty(github, 'context', { value: context })
}
