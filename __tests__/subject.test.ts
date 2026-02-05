import crypto from 'crypto'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import {
  formatSubjectDigest,
  subjectFromInputs,
  SubjectInputs
} from '../src/subject.js'

describe('subjectFromInputs', () => {
  const blankInputs: SubjectInputs = {
    subjectPath: '',
    subjectName: '',
    subjectDigest: '',
    subjectChecksums: ''
  }

  describe('when no inputs are provided', () => {
    it('throws an error', async () => {
      await expect(subjectFromInputs(blankInputs)).rejects.toThrow(
        /one of subject-path, subject-digest, or subject-checksums must be provided/i
      )
    })
  })

  describe('when both subject path and subject digest are provided', () => {
    it('throws an error', async () => {
      const inputs: SubjectInputs = {
        subjectName: 'foo',
        subjectPath: 'path/to/subject',
        subjectDigest: 'digest',
        subjectChecksums: ''
      }

      await expect(subjectFromInputs(inputs)).rejects.toThrow(
        /only one of subject-path, subject-digest, or subject-checksums may be provided/i
      )
    })
  })

  describe('when both subject path and subject checksums are provided', () => {
    it('throws an error', async () => {
      const inputs: SubjectInputs = {
        subjectName: '',
        subjectPath: 'path/to/subject',
        subjectDigest: '',
        subjectChecksums: 'path/to/checksums'
      }

      await expect(subjectFromInputs(inputs)).rejects.toThrow(
        /only one of subject-path, subject-digest, or subject-checksums may be provided/i
      )
    })
  })

  describe('when both subject digest and subject checksums are provided', () => {
    it('throws an error', async () => {
      const inputs: SubjectInputs = {
        subjectName: 'foo',
        subjectPath: '',
        subjectDigest: 'digest',
        subjectChecksums: 'path/to/checksums'
      }

      await expect(subjectFromInputs(inputs)).rejects.toThrow(
        /only one of subject-path, subject-digest, or subject-checksums may be provided/i
      )
    })
  })

  describe('when subject digest is provided but not the name', () => {
    it('throws an error', async () => {
      const inputs: SubjectInputs = {
        ...blankInputs,
        subjectDigest: 'digest'
      }

      await expect(subjectFromInputs(inputs)).rejects.toThrow(
        /subject-name must be provided when using subject-digest/i
      )
    })
  })

  describe('when specifying a subject digest', () => {
    const name = 'Subject'

    describe('when the digest is malformed', () => {
      it('throws an error', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectDigest: 'digest',
          subjectName: name
        }

        await expect(subjectFromInputs(inputs)).rejects.toThrow(
          /subject-digest must be in the format "sha256:<hex-digest>"/i
        )
      })
    })

    describe('when the algorithm is not supported', () => {
      it('throws an error', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectDigest: 'md5:deadbeef',
          subjectName: name
        }

        await expect(subjectFromInputs(inputs)).rejects.toThrow(
          /subject-digest must be in the format "sha256:<hex-digest>"/i
        )
      })
    })

    describe('when the sha256 digest is malformed', () => {
      it('throws an error', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectDigest: 'sha256:deadbeef',
          subjectName: name
        }

        await expect(subjectFromInputs(inputs)).rejects.toThrow(
          /subject-digest must be in the format "sha256:<hex-digest>"/i
        )
      })
    })

    describe('when the sha256 digest is valid', () => {
      const alg = 'sha256'
      const digest =
        '7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32'

      it('returns the subject', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectDigest: `${alg}:${digest}`,
          subjectName: name
        }

        const subject = await subjectFromInputs(inputs)

        expect(subject).toBeDefined()
        expect(subject).toHaveLength(1)
        expect(subject[0].name).toEqual(name)
        expect(subject[0].digest).toEqual({ [alg]: digest })
      })
    })

    describe('when the downcaseName is true', () => {
      const imageName = 'ghcr.io/FOO/bar'
      const alg = 'sha256'
      const digest =
        '7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32'

      it('returns the subject (with name downcased)', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectDigest: `${alg}:${digest}`,
          subjectName: imageName,
          downcaseName: true
        }

        const subject = await subjectFromInputs(inputs)

        expect(subject).toBeDefined()
        expect(subject).toHaveLength(1)
        expect(subject[0].name).toEqual(imageName.toLowerCase())
        expect(subject[0].digest).toEqual({ [alg]: digest })
      })
    })
  })

  describe('when specifying a subject path', () => {
    describe('when the file does NOT exist', () => {
      it('throws an error', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectPath: '/f/a/k/e'
        }

        await expect(subjectFromInputs(inputs)).rejects.toThrow(
          /could not find subject at path/i
        )
      })
    })
  })

  describe('when the file exists', () => {
    let dir = ''
    const filename = 'subject'
    const content = 'file content'

    const expectedDigest = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex')

    beforeEach(async () => {
      // Set-up temp directory
      const tmpDir = await fs.realpath(os.tmpdir())
      dir = await fs.mkdtemp(tmpDir + path.sep)

      // Write file to temp directory
      await fs.writeFile(path.join(dir, filename), content)

      // Add files for glob testing
      for (let i = 0; i < 3; i++) {
        await fs.writeFile(path.join(dir, `${filename}-${i}`), content)
        await fs.writeFile(path.join(dir, `other-${i}`), content)
      }
    })

    afterEach(async () => {
      // Clean-up temp directory
      await fs.rm(dir, { recursive: true })
    })

    describe('when no name is provided', () => {
      it('returns the subject', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectPath: path.join(dir, filename)
        }

        const subject = await subjectFromInputs(inputs)

        expect(subject).toBeDefined()
        expect(subject).toHaveLength(1)
        expect(subject[0].name).toEqual(filename)
        expect(subject[0].digest).toEqual({ sha256: expectedDigest })
      })
    })

    describe('when a name is provided', () => {
      const name = 'mysubject'

      it('returns the subject', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectPath: path.join(dir, filename),
          subjectName: name
        }

        const subject = await subjectFromInputs(inputs)

        expect(subject).toBeDefined()
        expect(subject).toHaveLength(1)
        expect(subject[0].name).toEqual(name)
        expect(subject[0].digest).toEqual({ sha256: expectedDigest })
      })
    })

    describe('when a file glob is supplied', () => {
      it('returns the multiple subjects', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectPath: path.join(dir, 'subject-*')
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toBeDefined()
        expect(subjects).toHaveLength(3)

        subjects.forEach(
          (
            subject: { name: string; digest: Record<string, string> },
            i: number
          ) => {
            expect(subject.name).toEqual(`${filename}-${i}`)
            expect(subject.digest).toEqual({ sha256: expectedDigest })
          }
        )
      })
    })

    describe('when a file glob is supplied which also matches non-files', () => {
      it('returns the subjects (excluding non-files)', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectPath: `${dir}*`
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toBeDefined()
        expect(subjects).toHaveLength(7)
      })
    })

    describe('when a comma-separated list is supplied', () => {
      it('returns the multiple subjects', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectPath: `${path.join(dir, 'subject-1')},${path.join(dir, 'subject-2')}`
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toBeDefined()
        expect(subjects).toHaveLength(2)

        expect(subjects).toContainEqual({
          name: 'subject-1',
          digest: { sha256: expectedDigest }
        })
        expect(subjects).toContainEqual({
          name: 'subject-2',
          digest: { sha256: expectedDigest }
        })
      })
    })

    describe('when a multi-line list is supplied', () => {
      it('returns the multiple subjects', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectPath: `${path.join(dir, 'subject-0')}\n${path.join(dir, 'subject-2')}`
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toBeDefined()
        expect(subjects).toHaveLength(2)

        expect(subjects).toContainEqual({
          name: 'subject-0',
          digest: { sha256: expectedDigest }
        })
        expect(subjects).toContainEqual({
          name: 'subject-2',
          digest: { sha256: expectedDigest }
        })
      })
    })

    describe('when an excluding glob is supplied', () => {
      it('returns the multiple subjects', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectPath: `${path.join(dir, 'subject-*')},!${path.join(dir, 'subject-1')}`
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toBeDefined()
        expect(subjects).toHaveLength(2)

        expect(subjects).toContainEqual({
          name: 'subject-0',
          digest: { sha256: expectedDigest }
        })
        expect(subjects).toContainEqual({
          name: 'subject-2',
          digest: { sha256: expectedDigest }
        })
      })
    })

    describe('when a multi-line glob list is supplied', () => {
      it('returns the multiple subjects', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectPath: `${path.join(dir, 'subject-*')}\n  ${path.join(dir, 'other-*')} `
        }

        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toBeDefined()
        expect(subjects).toHaveLength(6)

        expect(subjects).toContainEqual({
          name: 'subject-0',
          digest: { sha256: expectedDigest }
        })
        expect(subjects).toContainEqual({
          name: 'subject-1',
          digest: { sha256: expectedDigest }
        })
        expect(subjects).toContainEqual({
          name: 'subject-2',
          digest: { sha256: expectedDigest }
        })

        expect(subjects).toContainEqual({
          name: 'other-0',
          digest: { sha256: expectedDigest }
        })
        expect(subjects).toContainEqual({
          name: 'other-1',
          digest: { sha256: expectedDigest }
        })
        expect(subjects).toContainEqual({
          name: 'other-2',
          digest: { sha256: expectedDigest }
        })
      })
    })

    describe('when duplicate subjects are supplied', () => {
      let otherDir = ''

      // Add duplicate subject in alternate directory
      beforeEach(async () => {
        // Set-up temp directory
        const tmpDir = await fs.realpath(os.tmpdir())
        otherDir = await fs.mkdtemp(tmpDir + path.sep)

        // Write file to temp directory
        await fs.writeFile(path.join(otherDir, filename), content)
      })

      it('returns de-duplicated subjects', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectPath: `${path.join(dir, 'subject')}, ${path.join(otherDir, 'subject')} `
        }
        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toBeDefined()
        expect(subjects).toHaveLength(1)
      })
    })
  })

  describe('when specifying a subject checksums file', () => {
    const checksums = `
187dcd1506a170337415589ff00c8743f19d41cc31fca246c2739dfd450d0b9d  demo_0.0.1_linux_amd64
badline
5d8b4751ef31f9440d843fcfa4e53ca2e25b1cb1f13fd355fdc7c24b41fe645293291ea9297ba3989078abb77ebbaac66be073618a9e4974dbd0361881d4c718 demo_0.0.1_darwin_arm64`

    let dir = ''
    const filename = 'checksums'

    beforeEach(async () => {
      // Set-up temp directory
      const tmpDir = await fs.realpath(os.tmpdir())
      dir = await fs.mkdtemp(tmpDir + path.sep)

      // Write file to temp directory
      await fs.writeFile(path.join(dir, filename), checksums)
    })

    afterEach(async () => {
      // Clean-up temp directory
      await fs.rm(dir, { recursive: true })
    })

    describe('when the specified path is NOT a file', () => {
      it('throws an error', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectChecksums: dir
        }
        await expect(subjectFromInputs(inputs)).rejects.toThrow(
          /subject checksums file not found/i
        )
      })
    })

    describe('when the specific path is a file', () => {
      it('returns the multiple subjects', async () => {
        const inputs: SubjectInputs = {
          ...blankInputs,
          subjectChecksums: path.join(dir, filename)
        }
        const subjects = await subjectFromInputs(inputs)

        expect(subjects).toBeDefined()
        expect(subjects).toHaveLength(2)

        expect(subjects).toContainEqual({
          name: 'demo_0.0.1_linux_amd64',
          digest: {
            sha256:
              '187dcd1506a170337415589ff00c8743f19d41cc31fca246c2739dfd450d0b9d'
          }
        })
        expect(subjects).toContainEqual({
          name: 'demo_0.0.1_darwin_arm64',
          digest: {
            sha512:
              '5d8b4751ef31f9440d843fcfa4e53ca2e25b1cb1f13fd355fdc7c24b41fe645293291ea9297ba3989078abb77ebbaac66be073618a9e4974dbd0361881d4c718'
          }
        })
      })
    })
  })

  describe('when specifying a subject checksums string', () => {
    const checksums = `
f861e68a080799ca83104630b56abb90d8dbcc5f8b5a8639cb691e269838f29e  demo_0.0.1_linux_386
187dcd1506a170337415589ff00c8743f19d41cc31fca246c2739dfd450d0b9d *demo_0.0.1_linux_amd64
9ecbf449e286a8a8748c161c52aa28b6b2fc64ab86f94161c5d1b3abc18156c5 demo_0.0.1_linux_arm64`

    it('returns the multiple subjects', async () => {
      const inputs: SubjectInputs = {
        ...blankInputs,
        subjectChecksums: checksums
      }
      const subjects = await subjectFromInputs(inputs)

      expect(subjects).toBeDefined()
      expect(subjects).toHaveLength(3)

      expect(subjects).toContainEqual({
        name: 'demo_0.0.1_linux_386',
        digest: {
          sha256:
            'f861e68a080799ca83104630b56abb90d8dbcc5f8b5a8639cb691e269838f29e'
        }
      })
      expect(subjects).toContainEqual({
        name: 'demo_0.0.1_linux_amd64',
        digest: {
          sha256:
            '187dcd1506a170337415589ff00c8743f19d41cc31fca246c2739dfd450d0b9d'
        }
      })
      expect(subjects).toContainEqual({
        name: 'demo_0.0.1_linux_arm64',
        digest: {
          sha256:
            '9ecbf449e286a8a8748c161c52aa28b6b2fc64ab86f94161c5d1b3abc18156c5'
        }
      })
    })
  })

  describe('when specifying a subject checksums string with an unrecognized digest', () => {
    const checksums = `f861e  demo_0.0.1_linux_386`

    it('throws an error', async () => {
      const inputs: SubjectInputs = {
        ...blankInputs,
        subjectChecksums: checksums
      }

      await expect(subjectFromInputs(inputs)).rejects.toThrow(
        /unknown digest algorithm/i
      )
    })
  })

  describe('when specifying a subject checksums string with an invalid digest', () => {
    const checksums =
      '!!!!e68a080799ca83104630b56abb90d8dbcc5f8b5a8639cb691e269838f29e  demo_0.0.1_linux_386'

    it('throws an error', async () => {
      const inputs: SubjectInputs = {
        ...blankInputs,
        subjectChecksums: checksums
      }

      await expect(subjectFromInputs(inputs)).rejects.toThrow(/invalid digest/i)
    })
  })
})

describe('subjectDigest', () => {
  it('returns the digest', () => {
    const subject = {
      name: 'foo',
      digest: { sha1: 'deadbeef' }
    }

    const digest = formatSubjectDigest(subject)
    expect(digest).toEqual('sha1:deadbeef')
  })
})
