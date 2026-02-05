import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { predicateFromInputs, PredicateInputs } from '../src/predicate.js'

describe('subjectFromInputs', () => {
  const blankInputs: PredicateInputs = {
    predicateType: '',
    predicate: '',
    predicatePath: ''
  }

  describe('when no inputs are provided', () => {
    it('throws an error', () => {
      expect(() => predicateFromInputs(blankInputs)).toThrow(/predicate-type/i)
    })
  })

  describe('when neither predicate path nor predicate are provided', () => {
    it('throws an error', () => {
      const inputs: PredicateInputs = {
        ...blankInputs,
        predicateType: 'https://example.com/predicate'
      }

      expect(() => predicateFromInputs(inputs)).toThrow(
        /one of predicate-path or predicate must be provided/i
      )
    })
  })

  describe('when both predicate path and predicate are provided', () => {
    it('throws an error', () => {
      const inputs: PredicateInputs = {
        predicateType: 'https://example.com/predicate',
        predicate: '{}',
        predicatePath: 'path/to/predicate'
      }

      expect(() => predicateFromInputs(inputs)).toThrow(
        /only one of predicate-path or predicate may be provided/i
      )
    })
  })

  describe('when specifying a predicate path', () => {
    const predicateType = 'https://example.com/predicate'
    const content = '{}'
    let predicatePath = ''

    beforeEach(async () => {
      // Set-up temp directory
      const tmpDir = await fs.realpath(os.tmpdir())
      const dir = await fs.mkdtemp(tmpDir + path.sep)

      const filename = 'subject'
      predicatePath = path.join(dir, filename)

      // Write file to temp directory
      await fs.writeFile(predicatePath, content)
    })

    afterEach(async () => {
      // Clean-up temp directory
      await fs.rm(path.parse(predicatePath).dir, { recursive: true })
    })

    it('returns the predicate', () => {
      const inputs: PredicateInputs = {
        ...blankInputs,
        predicateType,
        predicatePath
      }
      expect(predicateFromInputs(inputs)).toEqual({
        type: predicateType,
        params: JSON.parse(content)
      })
    })
  })

  describe('when specifying a predicate path that does not exist', () => {
    const predicateType = 'https://example.com/predicate'
    const predicatePath = 'foo'

    it('returns the predicate', () => {
      const inputs: PredicateInputs = {
        ...blankInputs,
        predicateType,
        predicatePath
      }
      expect(() => predicateFromInputs(inputs)).toThrow(/file not found/)
    })
  })

  describe('when specifying a predicate value', () => {
    const predicateType = 'https://example.com/predicate'
    const content = '{}'

    it('returns the predicate', () => {
      const inputs: PredicateInputs = {
        ...blankInputs,
        predicateType,
        predicate: content
      }

      expect(predicateFromInputs(inputs)).toEqual({
        type: predicateType,
        params: JSON.parse(content)
      })
    })
  })

  describe('when specifying a predicate value exceeding the max size', () => {
    const predicateType = 'https://example.com/predicate'
    const content = JSON.stringify({ a: 'a'.repeat(16 * 1024 * 1024) })

    it('throws an error', () => {
      const inputs: PredicateInputs = {
        ...blankInputs,
        predicateType,
        predicate: content
      }

      expect(() => predicateFromInputs(inputs)).toThrow(
        /predicate string exceeds maximum/
      )
    })
  })
})
