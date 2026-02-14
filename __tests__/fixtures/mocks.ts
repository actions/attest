import type { Attestation, Predicate, Subject } from '@actions/attest'
import { jest } from '@jest/globals'
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'
import type { Descriptor } from '@sigstore/oci'

// =============================================================================
// @actions/core mock factory
// =============================================================================

export type CoreMock = {
  info: jest.Mock
  warning: jest.Mock
  debug: jest.Mock
  startGroup: jest.Mock
  endGroup: jest.Mock
  setOutput: jest.Mock
  setFailed: jest.Mock
  summary: SummaryMock
}

export type SummaryMock = {
  write: jest.Mock
  addRaw: jest.Mock
  addHeading: jest.Mock
  addLink: jest.Mock
  addTable: jest.Mock
  addBreak: jest.Mock
  addSeparator: jest.Mock
  addQuote: jest.Mock
  addCodeBlock: jest.Mock
  addList: jest.Mock
  addImage: jest.Mock
  addDetails: jest.Mock
  addEOL: jest.Mock
  emptyBuffer: jest.Mock
  stringify: jest.Mock
  isEmptyBuffer: jest.Mock
  clear: jest.Mock
}

export const createSummaryMock = (): SummaryMock => {
  const mock: SummaryMock = {
    write: jest.fn(),
    addRaw: jest.fn(),
    addHeading: jest.fn(),
    addLink: jest.fn(),
    addTable: jest.fn(),
    addBreak: jest.fn(),
    addSeparator: jest.fn(),
    addQuote: jest.fn(),
    addCodeBlock: jest.fn(),
    addList: jest.fn(),
    addImage: jest.fn(),
    addDetails: jest.fn(),
    addEOL: jest.fn(),
    emptyBuffer: jest.fn(),
    stringify: jest.fn().mockReturnValue(''),
    isEmptyBuffer: jest.fn().mockReturnValue(true),
    clear: jest.fn()
  }
  // Make chainable
  for (const key of Object.keys(mock) as (keyof SummaryMock)[]) {
    if (key !== 'stringify' && key !== 'isEmptyBuffer') {
      mock[key].mockReturnThis()
    }
  }
  return mock
}

export const createCoreMock = (): CoreMock => ({
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  summary: createSummaryMock()
})

// =============================================================================
// @actions/github mock factory
// =============================================================================

export type GitHubContextMock = {
  repo: { owner: string; repo: string }
  payload: { repository?: { visibility: string } }
  serverUrl: string
}

export const createGitHubContextMock = (
  overrides: Partial<GitHubContextMock> = {}
): GitHubContextMock => ({
  repo: { owner: 'test-owner', repo: 'test-repo' },
  payload: { repository: { visibility: 'public' } },
  serverUrl: 'https://github.com',
  ...overrides
})

export type OctokitMock = {
  rest: {
    repos: {
      get: jest.Mock
    }
  }
}

export const createOctokitMock = (
  ownerType: 'Organization' | 'User' = 'Organization'
): OctokitMock => ({
  rest: {
    repos: {
      get: jest
        .fn<RestEndpointMethodTypes['repos']['get']['response']>()
        .mockResolvedValue({
          data: { owner: { type: ownerType } }
        })
    }
  }
})

// =============================================================================
// @actions/attest mock factory
// =============================================================================

export type AttestMock = {
  attest: jest.Mock
  buildSLSAProvenancePredicate: jest.Mock
  createStorageRecord: jest.Mock
}

export const createAttestMock = (): AttestMock => ({
  attest: jest.fn(),
  buildSLSAProvenancePredicate: jest.fn(),
  createStorageRecord: jest.fn()
})

export const createAttestationResult = (
  overrides: Partial<Attestation> = {}
): Attestation => ({
  bundle: {
    mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json' as const,
    verificationMaterial: {
      certificate: { rawBytes: '' },
      publicKey: undefined,
      x509CertificateChain: undefined,
      tlogEntries: [],
      timestampVerificationData: undefined
    },
    dsseEnvelope: {
      payload: '',
      payloadType: '',
      signatures: []
    },
    messageSignature: undefined
  },
  certificate: '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
  tlogID: 'tlog-123',
  attestationID: 'att-123',
  ...overrides
})

// =============================================================================
// @sigstore/oci mock factory
// =============================================================================

export type OciMock = {
  getRegistryCredentials: jest.Mock
  attachArtifactToImage: jest.Mock
}

export const createOciMock = (): OciMock => ({
  getRegistryCredentials: jest.fn().mockReturnValue({
    username: 'test-user',
    password: 'test-pass'
  }),
  attachArtifactToImage: jest
    .fn<() => Promise<Descriptor>>()
    .mockResolvedValue({
      digest: 'sha256:abc123def456',
      mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
      size: 1234
    })
})

// =============================================================================
// Common test data
// =============================================================================

export const TEST_SUBJECT: Subject = {
  name: 'test-artifact',
  digest: {
    sha256: '7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32'
  }
}

export const TEST_SUBJECT_WITH_REGISTRY: Subject = {
  name: 'ghcr.io/test-owner/test-repo',
  digest: {
    sha256: '7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32'
  }
}

export const TEST_PREDICATE: Predicate = {
  type: 'https://example.com/predicate/v1',
  params: { foo: 'bar' }
}

export const TEST_PROVENANCE_PREDICATE: Predicate = {
  type: 'https://slsa.dev/provenance/v1',
  params: {
    buildDefinition: {
      buildType: 'https://actions.github.io/buildtypes/workflow/v1'
    },
    runDetails: {
      builder: { id: 'https://github.com/actions/runner' }
    }
  }
}

// =============================================================================
// Environment helpers
// =============================================================================

export const setupTestEnvironment = (
  env: Record<string, string> = {}
): (() => void) => {
  const originalEnv = { ...process.env }

  process.env = {
    ...process.env,
    ACTIONS_ID_TOKEN_REQUEST_URL: 'https://token.url',
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'test-token',
    RUNNER_TEMP: '/tmp',
    ...env
  }

  return () => {
    process.env = originalEnv
  }
}

// =============================================================================
// OIDC token helpers
// =============================================================================

export const createOidcToken = (subject = 'test@example.com'): string => {
  const payload = {
    sub: subject,
    iss: 'https://token.actions.githubusercontent.com'
  }
  return `.${Buffer.from(JSON.stringify(payload)).toString('base64')}.`
}
