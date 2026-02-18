import { jest } from '@jest/globals'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { parseSBOMFromPath, generateSBOMPredicate, SBOM } from '../../src/sbom'

describe('parseSBOMFromPath', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sbom-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('file handling', () => {
    it('should throw when file does not exist', async () => {
      await expect(parseSBOMFromPath('/nonexistent/file.json')).rejects.toThrow(
        /SBOM file not found/
      )
    })

    it('should rethrow non-ENOENT errors', async () => {
      const statSpy = jest.spyOn(fs, 'stat').mockRejectedValueOnce(
        Object.assign(new Error('Permission denied'), { code: 'EACCES' })
      )

      await expect(parseSBOMFromPath('/some/file.json')).rejects.toThrow(
        /Permission denied/
      )

      statSpy.mockRestore()
    })

    it('should throw when file contains invalid JSON', async () => {
      const filePath = path.join(tempDir, 'invalid.json')
      await fs.writeFile(filePath, 'not valid json')

      await expect(parseSBOMFromPath(filePath)).rejects.toThrow()
    })

    it('should throw when file exceeds maximum size', async () => {
      const filePath = path.join(tempDir, 'large.json')
      const largeContent = 'x'.repeat(17 * 1024 * 1024)
      await fs.writeFile(filePath, largeContent)

      await expect(parseSBOMFromPath(filePath)).rejects.toThrow(
        /SBOM file exceeds maximum allowed size/
      )
    })
  })

  describe('SPDX format', () => {
    const spdxSBOM = {
      spdxVersion: 'SPDX-2.3',
      SPDXID: 'SPDXRef-DOCUMENT',
      name: 'test-package',
      packages: []
    }

    it('should parse valid SPDX SBOM', async () => {
      const filePath = path.join(tempDir, 'sbom.spdx.json')
      await fs.writeFile(filePath, JSON.stringify(spdxSBOM))

      const result = await parseSBOMFromPath(filePath)

      expect(result.type).toBe('spdx')
      expect(result.object).toEqual(spdxSBOM)
    })
  })

  describe('CycloneDX format', () => {
    const cyclonedxSBOM = {
      bomFormat: 'CycloneDX',
      specVersion: '1.4',
      serialNumber: 'urn:uuid:12345',
      components: []
    }

    it('should parse valid CycloneDX SBOM', async () => {
      const filePath = path.join(tempDir, 'sbom.cdx.json')
      await fs.writeFile(filePath, JSON.stringify(cyclonedxSBOM))

      const result = await parseSBOMFromPath(filePath)

      expect(result.type).toBe('cyclonedx')
      expect(result.object).toEqual(cyclonedxSBOM)
    })
  })

  describe('unsupported formats', () => {
    it('should throw for unrecognized SBOM format', async () => {
      const filePath = path.join(tempDir, 'invalid-sbom.json')
      await fs.writeFile(filePath, JSON.stringify({ random: 'data' }))

      await expect(parseSBOMFromPath(filePath)).rejects.toThrow(
        /Unsupported SBOM format/
      )
    })

    it('should throw for SPDX missing SPDXID', async () => {
      const filePath = path.join(tempDir, 'partial-spdx.json')
      await fs.writeFile(filePath, JSON.stringify({ spdxVersion: 'SPDX-2.3' }))

      await expect(parseSBOMFromPath(filePath)).rejects.toThrow(
        /Unsupported SBOM format/
      )
    })

    it('should throw for CycloneDX missing required fields', async () => {
      const filePath = path.join(tempDir, 'partial-cdx.json')
      await fs.writeFile(filePath, JSON.stringify({ bomFormat: 'CycloneDX' }))

      await expect(parseSBOMFromPath(filePath)).rejects.toThrow(
        /Unsupported SBOM format/
      )
    })
  })
})

describe('generateSBOMPredicate', () => {
  describe('SPDX predicates', () => {
    it('should generate predicate with correct SPDX type URL', () => {
      const sbom: SBOM = {
        type: 'spdx',
        object: {
          spdxVersion: 'SPDX-2.3',
          SPDXID: 'SPDXRef-DOCUMENT',
          name: 'test-package'
        }
      }

      const predicate = generateSBOMPredicate(sbom)

      expect(predicate.type).toBe('https://spdx.dev/Document/v2.3')
      expect(predicate.params).toEqual(sbom.object)
    })

    it('should throw when spdxVersion is missing', () => {
      const sbom: SBOM = {
        type: 'spdx',
        object: { SPDXID: 'SPDXRef-DOCUMENT' }
      }

      expect(() => generateSBOMPredicate(sbom)).toThrow(
        /Cannot find spdxVersion/
      )
    })
  })

  describe('CycloneDX predicates', () => {
    it('should generate predicate with correct CycloneDX type URL', () => {
      const sbom: SBOM = {
        type: 'cyclonedx',
        object: {
          bomFormat: 'CycloneDX',
          specVersion: '1.4',
          serialNumber: 'urn:uuid:12345'
        }
      }

      const predicate = generateSBOMPredicate(sbom)

      expect(predicate.type).toBe('https://cyclonedx.org/bom')
      expect(predicate.params).toEqual(sbom.object)
    })
  })

  describe('unsupported types', () => {
    it('should throw for unsupported SBOM type', () => {
      const sbom = {
        type: 'unknown' as SBOM['type'],
        object: { foo: 'bar' }
      }

      expect(() => generateSBOMPredicate(sbom)).toThrow(/Unsupported SBOM format/)
    })
  })
})
