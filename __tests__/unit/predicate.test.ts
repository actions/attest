import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { predicateFromInputs, PredicateInputs } from '../../src/predicate'

describe('predicateFromInputs', () => {
  const blankInputs: PredicateInputs = {
    predicateType: '',
    predicate: '',
    predicatePath: ''
  }

  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'predicate-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('input validation', () => {
    it('should throw when predicate-type is not provided', async () => {
      await expect(predicateFromInputs(blankInputs)).rejects.toThrow(
        /predicate-type must be provided/
      )
    })

    it('should throw when neither predicate nor predicate-path is provided', async () => {
      const inputs: PredicateInputs = {
        ...blankInputs,
        predicateType: 'https://example.com/predicate'
      }
      await expect(predicateFromInputs(inputs)).rejects.toThrow(
        /one of predicate-path or predicate must be provided/i
      )
    })

    it('should throw when both predicate and predicate-path are provided', async () => {
      const inputs: PredicateInputs = {
        predicateType: 'https://example.com/predicate',
        predicate: '{}',
        predicatePath: '/path/to/predicate.json'
      }
      await expect(predicateFromInputs(inputs)).rejects.toThrow(
        /only one of predicate-path or predicate may be provided/i
      )
    })
  })

  describe('with predicate string', () => {
    it('should parse and return the predicate', async () => {
      const predicateType = 'https://example.com/predicate'
      const predicateContent = { foo: 'bar', nested: { value: 123 } }

      const inputs: PredicateInputs = {
        ...blankInputs,
        predicateType,
        predicate: JSON.stringify(predicateContent)
      }

      const result = await predicateFromInputs(inputs)

      expect(result).toEqual({
        type: predicateType,
        params: predicateContent
      })
    })

    it('should throw when predicate string exceeds max size', async () => {
      const predicateType = 'https://example.com/predicate'
      const largeContent = JSON.stringify({ data: 'x'.repeat(16 * 1024 * 1024) })

      const inputs: PredicateInputs = {
        ...blankInputs,
        predicateType,
        predicate: largeContent
      }

      await expect(predicateFromInputs(inputs)).rejects.toThrow(
        /predicate string exceeds maximum/
      )
    })

    it('should throw when predicate is invalid JSON', async () => {
      const inputs: PredicateInputs = {
        ...blankInputs,
        predicateType: 'https://example.com/predicate',
        predicate: 'not valid json'
      }

      await expect(predicateFromInputs(inputs)).rejects.toThrow(/JSON/)
    })
  })

  describe('with predicate path', () => {
    it('should read and parse predicate from file', async () => {
      const predicateType = 'https://example.com/predicate'
      const predicateContent = { buildType: 'test', metadata: { version: '1.0' } }
      const filePath = path.join(tempDir, 'predicate.json')

      await fs.writeFile(filePath, JSON.stringify(predicateContent))

      const inputs: PredicateInputs = {
        ...blankInputs,
        predicateType,
        predicatePath: filePath
      }

      const result = await predicateFromInputs(inputs)

      expect(result).toEqual({
        type: predicateType,
        params: predicateContent
      })
    })

    it('should throw when predicate file does not exist', async () => {
      const inputs: PredicateInputs = {
        ...blankInputs,
        predicateType: 'https://example.com/predicate',
        predicatePath: '/nonexistent/file.json'
      }

      await expect(predicateFromInputs(inputs)).rejects.toThrow(/file not found/)
    })

    it('should throw when predicate file contains invalid JSON', async () => {
      const filePath = path.join(tempDir, 'invalid.json')
      await fs.writeFile(filePath, 'not valid json')

      const inputs: PredicateInputs = {
        ...blankInputs,
        predicateType: 'https://example.com/predicate',
        predicatePath: filePath
      }

      await expect(predicateFromInputs(inputs)).rejects.toThrow(/JSON/)
    })
  })
})
