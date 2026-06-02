import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import {
  ARTIFACTS_LIST_ENV,
  getSubjectsFromArtifactsList,
  hasArtifactsListEnv
} from '../../src/artifacts'

describe('artifacts.ts', () => {
  let tempDir: string
  let listPath: string
  const originalEnv = process.env[ARTIFACTS_LIST_ENV]

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'artifacts-list-test-'))
    listPath = path.join(tempDir, 'artifacts_list')
    delete process.env[ARTIFACTS_LIST_ENV]
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
    if (originalEnv === undefined) {
      delete process.env[ARTIFACTS_LIST_ENV]
    } else {
      process.env[ARTIFACTS_LIST_ENV] = originalEnv
    }
  })

  describe('hasArtifactsListEnv', () => {
    it('returns false when the env var is unset', () => {
      expect(hasArtifactsListEnv()).toBe(false)
    })

    it('returns false when the env var is empty', () => {
      process.env[ARTIFACTS_LIST_ENV] = ''
      expect(hasArtifactsListEnv()).toBe(false)
    })

    it('returns true when the env var is set', () => {
      process.env[ARTIFACTS_LIST_ENV] = '/tmp/anything'
      expect(hasArtifactsListEnv()).toBe(true)
    })
  })

  describe('getSubjectsFromArtifactsList', () => {
    it('returns an empty list when the env var is unset', async () => {
      await expect(getSubjectsFromArtifactsList()).resolves.toEqual([])
    })

    it('returns an empty list for an empty subjects array', async () => {
      await fs.writeFile(listPath, '{"version":1,"subjects":[]}')
      process.env[ARTIFACTS_LIST_ENV] = listPath
      await expect(getSubjectsFromArtifactsList()).resolves.toEqual([])
    })

    it('returns an empty list when the file is empty', async () => {
      await fs.writeFile(listPath, '')
      process.env[ARTIFACTS_LIST_ENV] = listPath
      await expect(getSubjectsFromArtifactsList()).resolves.toEqual([])
    })

    it('parses a single file subject', async () => {
      const hex = 'a'.repeat(64)
      await fs.writeFile(
        listPath,
        JSON.stringify({
          version: 1,
          subjects: [{ name: 'myapp', digest: `sha256:${hex}`, kind: 'file' }]
        })
      )
      process.env[ARTIFACTS_LIST_ENV] = listPath

      const subjects = await getSubjectsFromArtifactsList()
      expect(subjects).toEqual([
        { name: 'myapp', digest: { sha256: hex } }
      ])
    })

    it('parses a single OCI subject', async () => {
      const hex = 'b'.repeat(64)
      await fs.writeFile(
        listPath,
        JSON.stringify({
          version: 1,
          subjects: [
            {
              name: 'ghcr.io/octocat/myapp:1.0.0',
              digest: `sha256:${hex}`,
              kind: 'oci'
            }
          ]
        })
      )
      process.env[ARTIFACTS_LIST_ENV] = listPath

      const subjects = await getSubjectsFromArtifactsList()
      expect(subjects).toHaveLength(1)
      expect(subjects[0].name).toBe('ghcr.io/octocat/myapp:1.0.0')
      expect(subjects[0].digest).toEqual({ sha256: hex })
    })

    it('preserves insertion order', async () => {
      await fs.writeFile(
        listPath,
        JSON.stringify({
          version: 1,
          subjects: [
            { name: 'one', digest: `sha256:${'1'.repeat(64)}`, kind: 'file' },
            { name: 'two', digest: `sha256:${'2'.repeat(64)}`, kind: 'file' },
            { name: 'three', digest: `sha256:${'3'.repeat(64)}`, kind: 'oci' }
          ]
        })
      )
      process.env[ARTIFACTS_LIST_ENV] = listPath

      const subjects = await getSubjectsFromArtifactsList()
      expect(subjects.map(s => s.name)).toEqual(['one', 'two', 'three'])
    })

    it('lowercases hex digest', async () => {
      const hex = 'A'.repeat(64)
      await fs.writeFile(
        listPath,
        JSON.stringify({
          version: 1,
          subjects: [{ name: 'x', digest: `sha256:${hex}`, kind: 'file' }]
        })
      )
      process.env[ARTIFACTS_LIST_ENV] = listPath

      const [subject] = await getSubjectsFromArtifactsList()
      expect(subject.digest.sha256).toBe(hex.toLowerCase())
    })

    it.each(['sha384', 'sha512'])(
      'supports %s digests',
      async (algo: string) => {
        const hexLen = algo === 'sha384' ? 96 : 128
        const hex = 'a'.repeat(hexLen)
        await fs.writeFile(
          listPath,
          JSON.stringify({
            version: 1,
            subjects: [{ name: 'x', digest: `${algo}:${hex}`, kind: 'file' }]
          })
        )
        process.env[ARTIFACTS_LIST_ENV] = listPath

        const [subject] = await getSubjectsFromArtifactsList()
        expect(subject.digest[algo]).toBe(hex)
      }
    )

    it('throws on unsupported version', async () => {
      await fs.writeFile(
        listPath,
        JSON.stringify({ version: 99, subjects: [] })
      )
      process.env[ARTIFACTS_LIST_ENV] = listPath
      await expect(getSubjectsFromArtifactsList()).rejects.toThrow(
        /format version 99 is not supported/i
      )
    })

    it('throws on malformed JSON', async () => {
      await fs.writeFile(listPath, 'not json')
      process.env[ARTIFACTS_LIST_ENV] = listPath
      await expect(getSubjectsFromArtifactsList()).rejects.toThrow(
        /failed to parse .* as json/i
      )
    })

    it('throws when subjects is missing', async () => {
      await fs.writeFile(listPath, JSON.stringify({ version: 1 }))
      process.env[ARTIFACTS_LIST_ENV] = listPath
      await expect(getSubjectsFromArtifactsList()).rejects.toThrow(
        /subjects.*must be an array/i
      )
    })

    it('throws when a subject is missing a name', async () => {
      await fs.writeFile(
        listPath,
        JSON.stringify({
          version: 1,
          subjects: [{ digest: `sha256:${'a'.repeat(64)}`, kind: 'file' }]
        })
      )
      process.env[ARTIFACTS_LIST_ENV] = listPath
      await expect(getSubjectsFromArtifactsList()).rejects.toThrow(
        /missing a non-empty 'name'/i
      )
    })

    it('throws when a digest is unrecognised', async () => {
      await fs.writeFile(
        listPath,
        JSON.stringify({
          version: 1,
          subjects: [{ name: 'x', digest: 'md5:abc', kind: 'file' }]
        })
      )
      process.env[ARTIFACTS_LIST_ENV] = listPath
      await expect(getSubjectsFromArtifactsList()).rejects.toThrow(
        /unrecognised digest/i
      )
    })

    it('throws when the file is unreadable', async () => {
      process.env[ARTIFACTS_LIST_ENV] = path.join(tempDir, 'does-not-exist')
      await expect(getSubjectsFromArtifactsList()).rejects.toThrow(
        /failed to read/i
      )
    })
  })
})
