import { jest } from '@jest/globals'

import type { Subject } from '@actions/attest'

// src/main pulls in ESM-only dependencies (e.g. @actions/attest, @sigstore/oci)
// which, when statically imported, load asynchronously under Jest's
// experimental VM modules. On Node < 24.9 that async import resolves after the
// test environment is torn down and crashes the suite. Mock those modules and
// import main dynamically so the heavy graph never loads.
jest.unstable_mockModule('@actions/core', () => ({}))
jest.unstable_mockModule('@actions/github', () => ({ context: {} }))
jest.unstable_mockModule('@actions/attest', () => ({
  attest: jest.fn(),
  buildSLSAProvenancePredicate: jest.fn(),
  createStorageRecord: jest.fn()
}))
jest.unstable_mockModule('@sigstore/oci', () => ({
  getRegistryCredentials: jest.fn(),
  attachArtifactToImage: jest.fn()
}))

const { validateRegistrySubjects } = await import('../../src/main')

describe('validateRegistrySubjects', () => {
  it('should pass for a single subject with SHA-256 digest', () => {
    const subjects: Subject[] = [
      {
        name: 'ghcr.io/owner/repo',
        digest: { sha256: 'a'.repeat(64) }
      }
    ]

    expect(() => validateRegistrySubjects(subjects)).not.toThrow()
  })

  it('should fail when no subjects are provided', () => {
    expect(() => validateRegistrySubjects([])).toThrow(
      /push-to-registry requires exactly one subject but 0 subjects were resolved/
    )
  })

  it('should fail when multiple subjects are provided', () => {
    const subjects: Subject[] = [
      {
        name: 'ghcr.io/owner/app1',
        digest: { sha256: 'a'.repeat(64) }
      },
      {
        name: 'ghcr.io/owner/app2',
        digest: { sha256: 'b'.repeat(64) }
      }
    ]

    expect(() => validateRegistrySubjects(subjects)).toThrow(
      /push-to-registry requires exactly one subject but 2 subjects were resolved/
    )
  })

  it('should fail when subject has SHA-512 digest', () => {
    const subjects: Subject[] = [
      {
        name: 'ghcr.io/owner/repo',
        digest: { sha512: 'a'.repeat(128) }
      }
    ]

    expect(() => validateRegistrySubjects(subjects)).toThrow(
      /push-to-registry requires a subject with a SHA-256 digest/
    )
  })

  it('should fail when subject has both SHA-256 and SHA-512 digests', () => {
    const subjects: Subject[] = [
      {
        name: 'ghcr.io/owner/repo',
        digest: { sha256: 'a'.repeat(64), sha512: 'b'.repeat(128) }
      }
    ]

    expect(() => validateRegistrySubjects(subjects)).toThrow(
      /push-to-registry requires a subject with a SHA-256 digest/
    )
  })
})
