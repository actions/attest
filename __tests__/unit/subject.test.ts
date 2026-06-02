import crypto from 'crypto'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { ARTIFACTS_LIST_ENV } from '../../src/artifacts'
import {
  subjectFromInputs,
  formatSubjectDigest,
  SubjectInputs
} from '../../src/subject'

describe('subjectFromInputs', () => {
  const blankInputs: SubjectInputs = {
    subjectPath: '',
    subjectName: '',
    subjectDigest: '',
    subjectChecksums: ''
  }

  let tempDir: string
  const originalArtifactsListEnv = process.env[ARTIFACTS_LIST_ENV]

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subject-test-'))
    // Each test starts with the runner-injected env var cleared so the
    // legacy "no inputs provided" failure path is exercised without
    // pollution from prior tests or the host environment.
    delete process.env[ARTIFACTS_LIST_ENV]
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
    if (originalArtifactsListEnv === undefined) {
      delete process.env[ARTIFACTS_LIST_ENV]
    } else {
      process.env[ARTIFACTS_LIST_ENV] = originalArtifactsListEnv
    }
  })

  describe('input validation', () => {
    it('should throw when no inputs are provided', async () => {
      await expect(subjectFromInputs(blankInputs)).rejects.toThrow(
        /one of subject-path, subject-digest, or subject-checksums must be provided/i
      )
    })

    it('should throw when multiple subject inputs are provided', async () => {
      const inputs: SubjectInputs = {
        ...blankInputs,
        subjectPath: '/some/path',
        subjectDigest: 'sha256:abc123'
      }
      await expect(subjectFromInputs(inputs)).rejects.toThrow(
        /only one of subject-path, subject-digest, or subject-checksums may be provided/i
      )
    })

    it('should throw when subject-digest is provided without subject-name', async () => {
      const inputs: SubjectInputs = {
        ...blankInputs,
        subjectDigest: 'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32'
      }
      await expect(subjectFromInputs(inputs)).rejects.toThrow(
        /subject-name must be provided when using subject-digest/i
      )
    })
  })

  describe('with subject-digest', () => {
    const validDigest = 'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32'

    it('should return subject with provided name and digest', async () => {
      const inputs: SubjectInputs = {
        ...blankInputs,
        subjectName: 'my-artifact',
        subjectDigest: validDigest
      }

      const subjects = await subjectFromInputs(inputs)

      expect(subjects).toHaveLength(1)
      expect(subjects[0].name).toBe('my-artifact')
      expect(subjects[0].digest).toEqual({
        sha256: '7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32'
      })
    })

    it('should lowercase name when downcaseName is true', async () => {
      const inputs: SubjectInputs = {
        ...blankInputs,
        subjectName: 'ghcr.io/FOO/Bar',
        subjectDigest: validDigest,
        downcaseName: true
      }

      const subjects = await subjectFromInputs(inputs)

      expect(subjects[0].name).toBe('ghcr.io/foo/bar')
    })

    it('should throw for malformed digest format', async () => {
      const inputs: SubjectInputs = {
        ...blankInputs,
        subjectName: 'artifact',
        subjectDigest: 'invalid-digest'
      }

      await expect(subjectFromInputs(inputs)).rejects.toThrow(
        /subject-digest must be in the format/
      )
    })

    it('should throw for unsupported hash algorithm', async () => {
      const inputs: SubjectInputs = {
        ...blankInputs,
        subjectName: 'artifact',
        subjectDigest: 'md5:d41d8cd98f00b204e9800998ecf8427e'
      }

      await expect(subjectFromInputs(inputs)).rejects.toThrow(
        /subject-digest must be in the format/
      )
    })

    it('should throw for incorrect sha256 digest length', async () => {
      const inputs: SubjectInputs = {
        ...blankInputs,
        subjectName: 'artifact',
        subjectDigest: 'sha256:deadbeef'
      }

      await expect(subjectFromInputs(inputs)).rejects.toThrow(
        /subject-digest must be in the format/
      )
    })
  })

  describe('with subject-path', () => {
    const fileContent = 'test file content'
    const expectedDigest = crypto.createHash('sha256').update(fileContent).digest('hex')

    it('should calculate digest from file', async () => {
      const filePath = path.join(tempDir, 'artifact.bin')
      await fs.writeFile(filePath, fileContent)

      const inputs: SubjectInputs = {
        ...blankInputs,
        subjectPath: filePath
      }

      const subjects = await subjectFromInputs(inputs)

      expect(subjects).toHaveLength(1)
      expect(subjects[0].name).toBe('artifact.bin')
      expect(subjects[0].digest).toEqual({ sha256: expectedDigest })
    })

    it('should use provided name instead of filename', async () => {
      const filePath = path.join(tempDir, 'artifact.bin')
      await fs.writeFile(filePath, fileContent)

      const inputs: SubjectInputs = {
        ...blankInputs,
        subjectPath: filePath,
        subjectName: 'custom-name'
      }

      const subjects = await subjectFromInputs(inputs)

      expect(subjects[0].name).toBe('custom-name')
    })

    it('should throw when file does not exist', async () => {
      const inputs: SubjectInputs = {
        ...blankInputs,
        subjectPath: '/nonexistent/file'
      }

      await expect(subjectFromInputs(inputs)).rejects.toThrow(
        /could not find subject at path/i
      )
    })

    describe('glob patterns', () => {
      beforeEach(async () => {
        for (let i = 0; i < 3; i++) {
          await fs.writeFile(path.join(tempDir, `file-${i}.txt`), fileContent)
        }
      })

      it('should expand glob pattern to multiple subjects', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectPath: path.join(tempDir, 'file-*.txt')
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toHaveLength(3)
        expect(subjects.map(s => s.name).sort()).toEqual([
          'file-0.txt',
          'file-1.txt',
          'file-2.txt'
        ])
      })

      it('should handle comma-separated paths', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectPath: `${path.join(tempDir, 'file-0.txt')},${path.join(tempDir, 'file-1.txt')}`
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toHaveLength(2)
      })

      it('should handle newline-separated paths', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectPath: `${path.join(tempDir, 'file-0.txt')}\n${path.join(tempDir, 'file-2.txt')}`
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toHaveLength(2)
      })

      it('should support exclusion patterns', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectPath: `${path.join(tempDir, 'file-*.txt')},!${path.join(tempDir, 'file-1.txt')}`
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toHaveLength(2)
        expect(subjects.map(s => s.name)).not.toContain('file-1.txt')
      })

      it('should deduplicate subjects with same name and digest', async () => {
        // Create another directory with same file
        const otherDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subject-dup-'))
        await fs.writeFile(path.join(otherDir, 'file-0.txt'), fileContent)

        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectPath: `${path.join(tempDir, 'file-0.txt')},${path.join(otherDir, 'file-0.txt')}`
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toHaveLength(1)

        await fs.rm(otherDir, { recursive: true, force: true })
      })
    })

    it('should exclude directories from glob results', async () => {
      await fs.mkdir(path.join(tempDir, 'subdir'))
      await fs.writeFile(path.join(tempDir, 'file.txt'), fileContent)

      const inputs: SubjectInputs = {
        ...blankInputs,
        subjectPath: path.join(tempDir, '*')
      }

      const subjects = await subjectFromInputs(inputs)

      expect(subjects).toHaveLength(1)
      expect(subjects[0].name).toBe('file.txt')
    })

    it('should throw when too many subjects are specified', async () => {
      // Create 1025 files (exceeds MAX_SUBJECT_COUNT of 1024)
      for (let i = 0; i < 1025; i++) {
        await fs.writeFile(path.join(tempDir, `file-${i}.txt`), `content-${i}`)
      }

      const inputs: SubjectInputs = {
        ...blankInputs,
        subjectPath: path.join(tempDir, 'file-*.txt')
      }

      await expect(subjectFromInputs(inputs)).rejects.toThrow(/too many subjects/i)
    })
  })

  describe('with subject-checksums', () => {
    describe('from string', () => {
      it('should parse sha256 checksums', async () => {
        const checksums = `187dcd1506a170337415589ff00c8743f19d41cc31fca246c2739dfd450d0b9d  artifact-linux
9ecbf449e286a8a8748c161c52aa28b6b2fc64ab86f94161c5d1b3abc18156c5  artifact-darwin`

        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectChecksums: checksums
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toHaveLength(2)
        expect(subjects).toContainEqual({
          name: 'artifact-linux',
          digest: { sha256: '187dcd1506a170337415589ff00c8743f19d41cc31fca246c2739dfd450d0b9d' }
        })
        expect(subjects).toContainEqual({
          name: 'artifact-darwin',
          digest: { sha256: '9ecbf449e286a8a8748c161c52aa28b6b2fc64ab86f94161c5d1b3abc18156c5' }
        })
      })

      it('should parse sha512 checksums', async () => {
        const sha512 = '5d8b4751ef31f9440d843fcfa4e53ca2e25b1cb1f13fd355fdc7c24b41fe645293291ea9297ba3989078abb77ebbaac66be073618a9e4974dbd0361881d4c718'
        const checksums = `${sha512}  artifact-amd64`

        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectChecksums: checksums
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toHaveLength(1)
        expect(subjects[0].digest).toEqual({ sha512 })
      })

      it('should handle binary mode flag (*)', async () => {
        const checksums = `187dcd1506a170337415589ff00c8743f19d41cc31fca246c2739dfd450d0b9d *artifact.bin`

        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectChecksums: checksums
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects[0].name).toBe('artifact.bin')
      })

      it('should handle text mode flag (space)', async () => {
        const checksums = `187dcd1506a170337415589ff00c8743f19d41cc31fca246c2739dfd450d0b9d  artifact.txt`

        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectChecksums: checksums
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects[0].name).toBe('artifact.txt')
      })

      it('should handle checksums without mode flag', async () => {
        // Single space between digest and name (no flag character)
        const checksums = `187dcd1506a170337415589ff00c8743f19d41cc31fca246c2739dfd450d0b9d artifact-no-flag`

        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectChecksums: checksums
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects[0].name).toBe('artifact-no-flag')
      })

      it('should skip malformed lines', async () => {
        const checksums = `187dcd1506a170337415589ff00c8743f19d41cc31fca246c2739dfd450d0b9d  valid-artifact
badline
9ecbf449e286a8a8748c161c52aa28b6b2fc64ab86f94161c5d1b3abc18156c5  another-artifact`

        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectChecksums: checksums
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toHaveLength(2)
      })

      it('should deduplicate identical entries', async () => {
        const checksums = `187dcd1506a170337415589ff00c8743f19d41cc31fca246c2739dfd450d0b9d  artifact
187dcd1506a170337415589ff00c8743f19d41cc31fca246c2739dfd450d0b9d  artifact`

        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectChecksums: checksums
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toHaveLength(1)
      })

      it('should throw for invalid digest characters', async () => {
        const checksums = `!!!!e68a080799ca83104630b56abb90d8dbcc5f8b5a8639cb691e269838f29e  artifact`

        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectChecksums: checksums
        }

        await expect(subjectFromInputs(inputs)).rejects.toThrow(/invalid digest/i)
      })

      it('should throw for unknown digest algorithm', async () => {
        const checksums = `f861e  artifact`

        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectChecksums: checksums
        }

        await expect(subjectFromInputs(inputs)).rejects.toThrow(/unknown digest algorithm/i)
      })
    })

    describe('from file', () => {
      it('should read checksums from file', async () => {
        const checksumFile = path.join(tempDir, 'SHA256SUMS')
        const checksums = `187dcd1506a170337415589ff00c8743f19d41cc31fca246c2739dfd450d0b9d  artifact-linux
9ecbf449e286a8a8748c161c52aa28b6b2fc64ab86f94161c5d1b3abc18156c5  artifact-darwin`

        await fs.writeFile(checksumFile, checksums)

        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectChecksums: checksumFile
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toHaveLength(2)
      })

      it('should throw when checksums path is a directory', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectChecksums: tempDir
        }

        await expect(subjectFromInputs(inputs)).rejects.toThrow(
          /subject checksums file not found/i
        )
      })
    })
  })

  describe('with $GITHUB_ARTIFACTS_LIST', () => {
    const setArtifactsList = async (body: object): Promise<string> => {
      const listPath = path.join(tempDir, 'artifacts_list')
      await fs.writeFile(listPath, JSON.stringify(body))
      process.env[ARTIFACTS_LIST_ENV] = listPath
      return listPath
    }

    it('returns subjects from the runner-emitted list when no explicit input is provided', async () => {
      const hex = 'a'.repeat(64)
      await setArtifactsList({
        version: 1,
        subjects: [{ name: 'myapp', digest: `sha256:${hex}`, kind: 'file' }]
      })

      const subjects = await subjectFromInputs(blankInputs)
      expect(subjects).toEqual([{ name: 'myapp', digest: { sha256: hex } }])
    })

    it('lowercases subject names when downcaseName is true', async () => {
      const hex = 'b'.repeat(64)
      await setArtifactsList({
        version: 1,
        subjects: [
          { name: 'GHCR.io/FOO/Bar', digest: `sha256:${hex}`, kind: 'oci' }
        ]
      })

      const subjects = await subjectFromInputs({
        ...blankInputs,
        downcaseName: true
      })
      expect(subjects[0].name).toBe('ghcr.io/foo/bar')
    })

    it('throws a helpful error when the list is empty', async () => {
      await setArtifactsList({ version: 1, subjects: [] })

      await expect(subjectFromInputs(blankInputs)).rejects.toThrow(
        /no artifact subjects were declared via \$GITHUB_ARTIFACTS/i
      )
    })

    it('explicit subject-path wins over the runner-emitted list', async () => {
      const hex = 'a'.repeat(64)
      await setArtifactsList({
        version: 1,
        subjects: [
          { name: 'from-runner', digest: `sha256:${hex}`, kind: 'file' }
        ]
      })

      // Use an explicit file subject; runner list should be ignored.
      const fileBody = Buffer.from('hello world')
      const explicitPath = path.join(tempDir, 'explicit-artifact')
      await fs.writeFile(explicitPath, fileBody)
      const expectedDigest = crypto
        .createHash('sha256')
        .update(fileBody)
        .digest('hex')

      const subjects = await subjectFromInputs({
        ...blankInputs,
        subjectPath: explicitPath
      })

      expect(subjects).toHaveLength(1)
      expect(subjects[0].name).toBe('explicit-artifact')
      expect(subjects[0].digest.sha256).toBe(expectedDigest)
    })
  })
})

describe('formatSubjectDigest', () => {
  it('should format digest as algorithm:hash', () => {
    const subject = {
      name: 'artifact',
      digest: { sha256: 'abc123def456' }
    }

    expect(formatSubjectDigest(subject)).toBe('sha256:abc123def456')
  })

  it('should use first algorithm alphabetically when multiple exist', () => {
    const subject = {
      name: 'artifact',
      digest: {
        sha512: 'longer-hash',
        sha256: 'shorter-hash'
      }
    }

    expect(formatSubjectDigest(subject)).toBe('sha256:shorter-hash')
  })
})
