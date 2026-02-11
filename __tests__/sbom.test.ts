import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { parseSBOMFromPath, generateSBOMPredicate, SBOM } from '../src/sbom'

describe('parseSBOMFromPath', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sbom-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true })
  })

  describe('when file does not exist', () => {
    it('throws an error', async () => {
      await expect(parseSBOMFromPath('/nonexistent/file.json')).rejects.toThrow(
        /SBOM file not found/
      )
    })
  })

  describe('when file contains valid SPDX SBOM', () => {
    const spdxSBOM = {
      spdxVersion: 'SPDX-2.3',
      SPDXID: 'SPDXRef-DOCUMENT',
      name: 'test-package',
      packages: []
    }

    it('returns SBOM with type spdx', async () => {
      const filePath = path.join(tmpDir, 'sbom.spdx.json')
      await fs.writeFile(filePath, JSON.stringify(spdxSBOM))

      const result = await parseSBOMFromPath(filePath)

      expect(result.type).toBe('spdx')
      expect(result.object).toEqual(spdxSBOM)
    })
  })

  describe('when file contains valid CycloneDX SBOM', () => {
    const cyclonedxSBOM = {
      bomFormat: 'CycloneDX',
      specVersion: '1.4',
      serialNumber: 'urn:uuid:12345',
      components: []
    }

    it('returns SBOM with type cyclonedx', async () => {
      const filePath = path.join(tmpDir, 'sbom.cdx.json')
      await fs.writeFile(filePath, JSON.stringify(cyclonedxSBOM))

      const result = await parseSBOMFromPath(filePath)

      expect(result.type).toBe('cyclonedx')
      expect(result.object).toEqual(cyclonedxSBOM)
    })
  })

  describe('when file contains invalid SBOM format', () => {
    it('throws an error', async () => {
      const filePath = path.join(tmpDir, 'invalid.json')
      await fs.writeFile(filePath, JSON.stringify({ random: 'data' }))

      await expect(parseSBOMFromPath(filePath)).rejects.toThrow(
        /Unsupported SBOM format/
      )
    })
  })

  describe('when file contains invalid JSON', () => {
    it('throws an error', async () => {
      const filePath = path.join(tmpDir, 'invalid.json')
      await fs.writeFile(filePath, 'not valid json')

      await expect(parseSBOMFromPath(filePath)).rejects.toThrow()
    })
  })

  describe('when file exceeds maximum size', () => {
    it('throws an error', async () => {
      const filePath = path.join(tmpDir, 'large.json')
      // Create a file larger than 16MB
      const largeContent = 'x'.repeat(17 * 1024 * 1024)
      await fs.writeFile(filePath, largeContent)

      await expect(parseSBOMFromPath(filePath)).rejects.toThrow(
        /SBOM file exceeds maximum allowed size/
      )
    })
  })
})

describe('generateSBOMPredicate', () => {
  describe('for SPDX SBOM', () => {
    const spdxSBOM: SBOM = {
      type: 'spdx',
      object: {
        spdxVersion: 'SPDX-2.3',
        SPDXID: 'SPDXRef-DOCUMENT',
        name: 'test-package'
      }
    }

    it('returns predicate with correct SPDX type', () => {
      const predicate = generateSBOMPredicate(spdxSBOM)

      expect(predicate.type).toBe('https://spdx.dev/Document/v2.3')
      expect(predicate.params).toEqual(spdxSBOM.object)
    })
  })

  describe('for CycloneDX SBOM', () => {
    const cyclonedxSBOM: SBOM = {
      type: 'cyclonedx',
      object: {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: 'urn:uuid:12345'
      }
    }

    it('returns predicate with correct CycloneDX type', () => {
      const predicate = generateSBOMPredicate(cyclonedxSBOM)

      expect(predicate.type).toBe('https://cyclonedx.org/bom')
      expect(predicate.params).toEqual(cyclonedxSBOM.object)
    })
  })

  describe('for SPDX without version', () => {
    const invalidSBOM: SBOM = {
      type: 'spdx',
      object: {
        SPDXID: 'SPDXRef-DOCUMENT'
      }
    }

    it('throws an error', () => {
      expect(() => generateSBOMPredicate(invalidSBOM)).toThrow(
        /Cannot find spdxVersion/
      )
    })
  })

  describe('for unsupported SBOM type', () => {
    const unsupportedSBOM = {
      type: 'unknown' as SBOM['type'],
      object: { foo: 'bar' }
    }

    it('throws an error', () => {
      expect(() => generateSBOMPredicate(unsupportedSBOM)).toThrow(
        /Unsupported SBOM format/
      )
    })
  })
})
