import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { readArtifactsList, parseArtifactsList } from '../../src/artifacts'

const ENV_KEY = 'GITHUB_ARTIFACTS_LIST'

describe('readArtifactsList', () => {
  const originalEnv = process.env

  let tempDir: string

  beforeEach(async () => {
    process.env = { ...originalEnv }
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'artifacts-test-'))
  })

  afterEach(async () => {
    process.env = originalEnv
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('env var handling', () => {
    it('should return undefined when env var is unset', async () => {
      delete process.env[ENV_KEY]
      expect(await readArtifactsList()).toBeUndefined()
    })

    it('should return undefined when env var is empty string', async () => {
      process.env[ENV_KEY] = ''
      expect(await readArtifactsList()).toBeUndefined()
    })

    it('should return undefined when env var is blank/whitespace', async () => {
      process.env[ENV_KEY] = '   '
      expect(await readArtifactsList()).toBeUndefined()
    })
  })

  describe('file reading', () => {
    it('should throw when file is unreadable', async () => {
      process.env[ENV_KEY] = path.join(tempDir, 'nonexistent.json')
      await expect(readArtifactsList()).rejects.toThrow(
        /Failed to read artifacts list/
      )
    })

    it('should parse valid file content', async () => {
      const filePath = path.join(tempDir, 'artifacts.json')
      const data = {
        version: 1,
        subjects: [
          {
            name: 'my-binary',
            digest: `sha256:${'a'.repeat(64)}`,
            kind: 'file'
          }
        ]
      }
      await fs.writeFile(filePath, JSON.stringify(data))
      process.env[ENV_KEY] = filePath

      const subjects = await readArtifactsList()

      expect(subjects).toBeDefined()
      expect(subjects).toHaveLength(1)
      expect(subjects?.[0].name).toBe('my-binary')
      expect(subjects?.[0].digest).toEqual({ sha256: 'a'.repeat(64) })
    })
  })
})

describe('parseArtifactsList', () => {
  describe('structural validation', () => {
    it('should return empty array on empty string', () => {
      expect(parseArtifactsList('')).toEqual([])
    })

    it('should return empty array on whitespace-only content', () => {
      expect(parseArtifactsList('   \n  ')).toEqual([])
    })

    it('should throw on UTF-8 BOM', () => {
      const content = '\uFEFF{"version":1,"subjects":[]}'
      expect(() => parseArtifactsList(content)).toThrow(
        /UTF-8 BOM/
      )
    })

    it('should throw on invalid JSON', () => {
      expect(() => parseArtifactsList('{not json}')).toThrow(
        /invalid JSON/
      )
    })

    it('should throw when content is a JSON array', () => {
      expect(() => parseArtifactsList('[]')).toThrow(
        /must be a JSON object/
      )
    })

    it('should throw when content is a JSON string', () => {
      expect(() => parseArtifactsList('"hello"')).toThrow(
        /must be a JSON object/
      )
    })

    it('should throw when content is null', () => {
      expect(() => parseArtifactsList('null')).toThrow(
        /must be a JSON object/
      )
    })
  })

  describe('version validation', () => {
    it('should throw for version 0', () => {
      expect(() =>
        parseArtifactsList(JSON.stringify({ version: 0, subjects: [] }))
      ).toThrow(/Unsupported artifacts list version.*0.*expected 1/)
    })

    it('should throw for version 2', () => {
      expect(() =>
        parseArtifactsList(JSON.stringify({ version: 2, subjects: [] }))
      ).toThrow(/Unsupported artifacts list version.*2.*expected 1/)
    })

    it('should throw for string version', () => {
      expect(() =>
        parseArtifactsList(JSON.stringify({ version: '1', subjects: [] }))
      ).toThrow(/Unsupported artifacts list version/)
    })

    it('should throw for missing version', () => {
      expect(() =>
        parseArtifactsList(JSON.stringify({ subjects: [] }))
      ).toThrow(/Unsupported artifacts list version/)
    })
  })

  describe('subjects array validation', () => {
    it('should throw when subjects is missing', () => {
      expect(() =>
        parseArtifactsList(JSON.stringify({ version: 1 }))
      ).toThrow(/missing a "subjects" array/)
    })

    it('should throw when subjects is not an array', () => {
      expect(() =>
        parseArtifactsList(
          JSON.stringify({ version: 1, subjects: 'not-array' })
        )
      ).toThrow(/missing a "subjects" array/)
    })

    it('should return empty array for empty subjects', () => {
      const result = parseArtifactsList(
        JSON.stringify({ version: 1, subjects: [] })
      )
      expect(result).toEqual([])
    })
  })

  describe('entry validation', () => {
    const wrap = (subjects: unknown[]): string =>
      JSON.stringify({ version: 1, subjects })

    it('should throw when entry is not an object', () => {
      expect(() => parseArtifactsList(wrap(['not-an-object']))).toThrow(
        /entry 0: must be a JSON object/
      )
    })

    it('should throw when entry is an array', () => {
      expect(() => parseArtifactsList(wrap([[]]))).toThrow(
        /entry 0: must be a JSON object/
      )
    })

    it('should throw when entry is null', () => {
      expect(() => parseArtifactsList(wrap([null]))).toThrow(
        /entry 0: must be a JSON object/
      )
    })

    describe('name validation', () => {
      it('should throw when name is missing', () => {
        expect(() =>
          parseArtifactsList(
            wrap([{ kind: 'file', digest: `sha256:${'a'.repeat(64)}` }])
          )
        ).toThrow(/entry 0: "name" must be a non-empty string/)
      })

      it('should throw when name is empty', () => {
        expect(() =>
          parseArtifactsList(
            wrap([
              { name: '', kind: 'file', digest: `sha256:${'a'.repeat(64)}` }
            ])
          )
        ).toThrow(/entry 0: "name" must be a non-empty string/)
      })

      it('should throw when name is not a string', () => {
        expect(() =>
          parseArtifactsList(
            wrap([
              { name: 42, kind: 'file', digest: `sha256:${'a'.repeat(64)}` }
            ])
          )
        ).toThrow(/entry 0: "name" must be a non-empty string/)
      })
    })

    describe('kind validation', () => {
      it('should throw when kind is missing', () => {
        expect(() =>
          parseArtifactsList(
            wrap([{ name: 'a', digest: `sha256:${'a'.repeat(64)}` }])
          )
        ).toThrow(/entry 0: "kind" must be a string/)
      })

      it('should throw for unsupported kind', () => {
        expect(() =>
          parseArtifactsList(
            wrap([
              {
                name: 'a',
                kind: 'npm',
                digest: `sha256:${'a'.repeat(64)}`
              }
            ])
          )
        ).toThrow(/entry 0: unsupported kind "npm".*"file" or "oci"/)
      })
    })

    describe('digest validation', () => {
      it('should throw when digest is missing', () => {
        expect(() =>
          parseArtifactsList(wrap([{ name: 'a', kind: 'file' }]))
        ).toThrow(/entry 0: "digest" must be a non-empty string/)
      })

      it('should throw when digest is empty', () => {
        expect(() =>
          parseArtifactsList(
            wrap([{ name: 'a', kind: 'file', digest: '' }])
          )
        ).toThrow(/entry 0: "digest" must be a non-empty string/)
      })

      it('should throw when digest has no colon', () => {
        expect(() =>
          parseArtifactsList(
            wrap([
              { name: 'a', kind: 'file', digest: `sha256${'a'.repeat(64)}` }
            ])
          )
        ).toThrow(/entry 0: digest must be in the format "algorithm:hex"/)
      })

      it('should throw when algorithm is not allowed for kind', () => {
        expect(() =>
          parseArtifactsList(
            wrap([
              {
                name: 'a',
                kind: 'file',
                digest: `sha512:${'a'.repeat(128)}`
              }
            ])
          )
        ).toThrow(
          /entry 0: algorithm "sha512" is not allowed for kind "file"/
        )
      })

      it('should throw when hex contains invalid characters', () => {
        expect(() =>
          parseArtifactsList(
            wrap([
              {
                name: 'a',
                kind: 'file',
                digest: `sha256:${'g'.repeat(64)}`
              }
            ])
          )
        ).toThrow(/entry 0: digest contains invalid hex characters/)
      })

      it('should throw when hex has wrong length', () => {
        expect(() =>
          parseArtifactsList(
            wrap([
              { name: 'a', kind: 'file', digest: 'sha256:abcd' }
            ])
          )
        ).toThrow(
          /entry 0: digest has 4 hex characters but "sha256" requires exactly 64/
        )
      })
    })
  })

  describe('kind-specific algorithm rules', () => {
    const wrap = (subjects: unknown[]): string =>
      JSON.stringify({ version: 1, subjects })

    describe('file kind', () => {
      it('should accept sha256 (64 hex chars)', () => {
        const result = parseArtifactsList(
          wrap([
            {
              name: 'binary',
              kind: 'file',
              digest: `sha256:${'a'.repeat(64)}`
            }
          ])
        )
        expect(result).toHaveLength(1)
        expect(result[0].digest).toEqual({ sha256: 'a'.repeat(64) })
      })

      it('should reject sha384 for file kind', () => {
        expect(() =>
          parseArtifactsList(
            wrap([
              {
                name: 'binary',
                kind: 'file',
                digest: `sha384:${'a'.repeat(96)}`
              }
            ])
          )
        ).toThrow(/algorithm "sha384" is not allowed for kind "file"/)
      })

      it('should reject sha512 for file kind', () => {
        expect(() =>
          parseArtifactsList(
            wrap([
              {
                name: 'binary',
                kind: 'file',
                digest: `sha512:${'a'.repeat(128)}`
              }
            ])
          )
        ).toThrow(/algorithm "sha512" is not allowed for kind "file"/)
      })
    })

    describe('oci kind', () => {
      it('should accept sha256 (64 hex chars)', () => {
        const result = parseArtifactsList(
          wrap([
            {
              name: 'ghcr.io/owner/image',
              kind: 'oci',
              digest: `sha256:${'b'.repeat(64)}`
            }
          ])
        )
        expect(result).toHaveLength(1)
        expect(result[0].digest).toEqual({ sha256: 'b'.repeat(64) })
      })

      it('should accept sha384 (96 hex chars)', () => {
        const result = parseArtifactsList(
          wrap([
            {
              name: 'ghcr.io/owner/image',
              kind: 'oci',
              digest: `sha384:${'c'.repeat(96)}`
            }
          ])
        )
        expect(result).toHaveLength(1)
        expect(result[0].digest).toEqual({ sha384: 'c'.repeat(96) })
      })

      it('should accept sha512 (128 hex chars)', () => {
        const result = parseArtifactsList(
          wrap([
            {
              name: 'ghcr.io/owner/image',
              kind: 'oci',
              digest: `sha512:${'d'.repeat(128)}`
            }
          ])
        )
        expect(result).toHaveLength(1)
        expect(result[0].digest).toEqual({ sha512: 'd'.repeat(128) })
      })
    })
  })

  describe('valid entries', () => {
    const wrap = (subjects: unknown[]): string =>
      JSON.stringify({ version: 1, subjects })

    it('should parse a single file entry', () => {
      const result = parseArtifactsList(
        wrap([
          {
            name: 'my-binary-linux-amd64',
            kind: 'file',
            digest: `sha256:${'ab'.repeat(32)}`
          }
        ])
      )

      expect(result).toEqual([
        {
          name: 'my-binary-linux-amd64',
          digest: { sha256: 'ab'.repeat(32) }
        }
      ])
    })

    it('should parse a single OCI entry', () => {
      const result = parseArtifactsList(
        wrap([
          {
            name: 'ghcr.io/owner/app',
            kind: 'oci',
            digest: `sha256:${'cd'.repeat(32)}`
          }
        ])
      )

      expect(result).toEqual([
        {
          name: 'ghcr.io/owner/app',
          digest: { sha256: 'cd'.repeat(32) }
        }
      ])
    })

    it('should parse multiple mixed entries', () => {
      const result = parseArtifactsList(
        wrap([
          {
            name: 'binary-linux',
            kind: 'file',
            digest: `sha256:${'a'.repeat(64)}`
          },
          {
            name: 'binary-darwin',
            kind: 'file',
            digest: `sha256:${'b'.repeat(64)}`
          },
          {
            name: 'ghcr.io/owner/app',
            kind: 'oci',
            digest: `sha512:${'c'.repeat(128)}`
          }
        ])
      )

      expect(result).toHaveLength(3)
      expect(result[0].name).toBe('binary-linux')
      expect(result[1].name).toBe('binary-darwin')
      expect(result[2].name).toBe('ghcr.io/owner/app')
    })

    it('should accept uppercase hex characters', () => {
      const result = parseArtifactsList(
        wrap([
          {
            name: 'binary',
            kind: 'file',
            digest: `sha256:${'ABCDEF01'.repeat(8)}`
          }
        ])
      )

      expect(result).toHaveLength(1)
      expect(result[0].digest).toEqual({ sha256: 'ABCDEF01'.repeat(8) })
    })
  })

  describe('deduplication and conflicts', () => {
    const wrap = (subjects: unknown[]): string =>
      JSON.stringify({ version: 1, subjects })

    it('should deduplicate exact (name, kind, digest) duplicates', () => {
      const entry = {
        name: 'my-binary',
        kind: 'file',
        digest: `sha256:${'a'.repeat(64)}`
      }

      const result = parseArtifactsList(wrap([entry, entry]))

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('my-binary')
    })

    it('should preserve runner order after dedup', () => {
      const result = parseArtifactsList(
        wrap([
          {
            name: 'second',
            kind: 'file',
            digest: `sha256:${'b'.repeat(64)}`
          },
          {
            name: 'first',
            kind: 'file',
            digest: `sha256:${'a'.repeat(64)}`
          },
          {
            name: 'second',
            kind: 'file',
            digest: `sha256:${'b'.repeat(64)}`
          }
        ])
      )

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('second')
      expect(result[1].name).toBe('first')
    })

    it('should throw on conflicting digest for same name', () => {
      expect(() =>
        parseArtifactsList(
          wrap([
            {
              name: 'my-binary',
              kind: 'file',
              digest: `sha256:${'a'.repeat(64)}`
            },
            {
              name: 'my-binary',
              kind: 'file',
              digest: `sha256:${'b'.repeat(64)}`
            }
          ])
        )
      ).toThrow(
        /entry 1: duplicate name "my-binary" with conflicting kind or digest/
      )
    })

    it('should throw on conflicting kind for same name', () => {
      expect(() =>
        parseArtifactsList(
          wrap([
            {
              name: 'my-artifact',
              kind: 'file',
              digest: `sha256:${'a'.repeat(64)}`
            },
            {
              name: 'my-artifact',
              kind: 'oci',
              digest: `sha256:${'a'.repeat(64)}`
            }
          ])
        )
      ).toThrow(
        /entry 1: duplicate name "my-artifact" with conflicting kind or digest/
      )
    })
  })

  describe('downcaseOCI option', () => {
    const wrap = (subjects: unknown[]): string =>
      JSON.stringify({ version: 1, subjects })

    it('should lowercase OCI names when downcaseOCI is true', () => {
      const result = parseArtifactsList(
        wrap([
          {
            name: 'ghcr.io/Owner/My-Image',
            kind: 'oci',
            digest: `sha256:${'a'.repeat(64)}`
          }
        ]),
        { downcaseOCI: true }
      )

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('ghcr.io/owner/my-image')
    })

    it('should NOT lowercase file names when downcaseOCI is true', () => {
      const result = parseArtifactsList(
        wrap([
          {
            name: 'My-Binary-Linux',
            kind: 'file',
            digest: `sha256:${'b'.repeat(64)}`
          }
        ]),
        { downcaseOCI: true }
      )

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('My-Binary-Linux')
    })

    it('should lowercase OCI but not file in mixed list', () => {
      const result = parseArtifactsList(
        wrap([
          {
            name: 'My-Binary',
            kind: 'file',
            digest: `sha256:${'a'.repeat(64)}`
          },
          {
            name: 'ghcr.io/Owner/APP',
            kind: 'oci',
            digest: `sha256:${'b'.repeat(64)}`
          }
        ]),
        { downcaseOCI: true }
      )

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('My-Binary')
      expect(result[1].name).toBe('ghcr.io/owner/app')
    })

    it('should NOT lowercase OCI names when downcaseOCI is false', () => {
      const result = parseArtifactsList(
        wrap([
          {
            name: 'ghcr.io/Owner/My-Image',
            kind: 'oci',
            digest: `sha256:${'a'.repeat(64)}`
          }
        ]),
        { downcaseOCI: false }
      )

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('ghcr.io/Owner/My-Image')
    })

    it('should NOT lowercase OCI names when options are omitted', () => {
      const result = parseArtifactsList(
        wrap([
          {
            name: 'ghcr.io/Owner/My-Image',
            kind: 'oci',
            digest: `sha256:${'a'.repeat(64)}`
          }
        ])
      )

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('ghcr.io/Owner/My-Image')
    })

    it('should deduplicate case-only duplicate OCI names after normalization', () => {
      const result = parseArtifactsList(
        wrap([
          {
            name: 'ghcr.io/Owner/APP',
            kind: 'oci',
            digest: `sha256:${'a'.repeat(64)}`
          },
          {
            name: 'ghcr.io/owner/app',
            kind: 'oci',
            digest: `sha256:${'a'.repeat(64)}`
          }
        ]),
        { downcaseOCI: true }
      )

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('ghcr.io/owner/app')
    })

    it('should reject case-colliding OCI names with conflicting digest after normalization', () => {
      expect(() =>
        parseArtifactsList(
          wrap([
            {
              name: 'ghcr.io/Owner/APP',
              kind: 'oci',
              digest: `sha256:${'a'.repeat(64)}`
            },
            {
              name: 'ghcr.io/owner/app',
              kind: 'oci',
              digest: `sha256:${'b'.repeat(64)}`
            }
          ]),
          { downcaseOCI: true }
        )
      ).toThrow(
        /entry 1: duplicate name "ghcr.io\/owner\/app" with conflicting kind or digest/
      )
    })
  })

  describe('requireSingleOCI option', () => {
    const wrap = (subjects: unknown[]): string =>
      JSON.stringify({ version: 1, subjects })

    it('should accept a single OCI subject', () => {
      const result = parseArtifactsList(
        wrap([
          {
            name: 'ghcr.io/owner/app',
            kind: 'oci',
            digest: `sha256:${'a'.repeat(64)}`
          }
        ]),
        { requireSingleOCI: true }
      )

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('ghcr.io/owner/app')
    })

    it('should reject when discovered subjects contain file-kind entries', () => {
      expect(() =>
        parseArtifactsList(
          wrap([
            {
              name: 'my-binary',
              kind: 'file',
              digest: `sha256:${'a'.repeat(64)}`
            }
          ]),
          { requireSingleOCI: true }
        )
      ).toThrow(
        /push-to-registry requires an OCI subject but the discovered artifacts list contains file-kind subjects/
      )
    })

    it('should reject when discovered subjects include a mix of file and OCI', () => {
      expect(() =>
        parseArtifactsList(
          wrap([
            {
              name: 'ghcr.io/owner/app',
              kind: 'oci',
              digest: `sha256:${'a'.repeat(64)}`
            },
            {
              name: 'my-binary',
              kind: 'file',
              digest: `sha256:${'b'.repeat(64)}`
            }
          ]),
          { requireSingleOCI: true }
        )
      ).toThrow(
        /push-to-registry requires an OCI subject but the discovered artifacts list contains file-kind subjects/
      )
    })

    it('should reject multiple OCI subjects', () => {
      expect(() =>
        parseArtifactsList(
          wrap([
            {
              name: 'ghcr.io/owner/app1',
              kind: 'oci',
              digest: `sha256:${'a'.repeat(64)}`
            },
            {
              name: 'ghcr.io/owner/app2',
              kind: 'oci',
              digest: `sha256:${'b'.repeat(64)}`
            }
          ]),
          { requireSingleOCI: true }
        )
      ).toThrow(
        /push-to-registry requires exactly one subject but the discovered artifacts list contains multiple subjects/
      )
    })

    it('should allow empty subjects (no-op for empty list)', () => {
      const result = parseArtifactsList(
        wrap([]),
        { requireSingleOCI: true }
      )

      expect(result).toEqual([])
    })

    it('should not enforce requireSingleOCI when option is false', () => {
      const result = parseArtifactsList(
        wrap([
          {
            name: 'my-binary',
            kind: 'file',
            digest: `sha256:${'a'.repeat(64)}`
          }
        ]),
        { requireSingleOCI: false }
      )

      expect(result).toHaveLength(1)
    })

    it('should not enforce requireSingleOCI when options are omitted', () => {
      const result = parseArtifactsList(
        wrap([
          {
            name: 'my-binary',
            kind: 'file',
            digest: `sha256:${'a'.repeat(64)}`
          },
          {
            name: 'other-binary',
            kind: 'file',
            digest: `sha256:${'b'.repeat(64)}`
          }
        ])
      )

      expect(result).toHaveLength(2)
    })
  })
})
