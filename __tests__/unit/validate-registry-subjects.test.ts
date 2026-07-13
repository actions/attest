import { validateRegistrySubjects } from '../../src/main'

import type { Subject } from '@actions/attest'

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
