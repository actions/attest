import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { predicateFromInputs } from '../src/predicate'

describe('subjectFromInputs', () => {
  afterEach(() => {
    process.env['INPUT_PREDICATE'] = ''
    process.env['INPUT_PREDICATE-PATH'] = ''
    process.env['INPUT_PREDICATE-TYPE'] = ''
  })

  describe('when no inputs are provided', () => {
    it('throws an error', () => {
      expect(() => predicateFromInputs()).toThrow(/predicate-type/i)
    })
  })

  describe('when neither predicate path nor predicate are provided', () => {
    beforeEach(() => {
      process.env['INPUT_PREDICATE-TYPE'] = 'https://example.com/predicate'
    })

    it('throws an error', () => {
      expect(() => predicateFromInputs()).toThrow(
        /one of predicate-path or predicate must be provided/i
      )
    })
  })

  describe('when both predicate path and predicate are provided', () => {
    beforeEach(() => {
      process.env['INPUT_PREDICATE-PATH'] = 'path/to/predicate'
      process.env['INPUT_PREDICATE'] = '{}'
      process.env['INPUT_PREDICATE-TYPE'] = 'https://example.com/predicate'
    })

    it('throws an error', () => {
      expect(() => predicateFromInputs()).toThrow(
        /only one of predicate-path or predicate may be provided/i
      )
    })
  })

  describe('when specifying a predicate path', () => {
    let dir = ''
    const filename = 'subject'
    const content = '{}'

    beforeEach(async () => {
      // Set-up temp directory
      const tmpDir = await fs.realpath(os.tmpdir())
      dir = await fs.mkdtemp(tmpDir + path.sep)

      // Write file to temp directory
      await fs.writeFile(path.join(dir, filename), content)
    })

    afterEach(async () => {
      // Clean-up temp directory
      await fs.rm(dir, { recursive: true })
    })

    beforeEach(() => {
      process.env['INPUT_PREDICATE-PATH'] = path.join(dir, filename)
      process.env['INPUT_PREDICATE-TYPE'] = 'https://example.com/predicate'
    })

    it('returns the predicate', () => {
      expect(predicateFromInputs()).toEqual({
        type: 'https://example.com/predicate',
        params: {}
      })
    })
  })

  describe('when specifying a predicate value', () => {
    const content = '{}'

    beforeEach(() => {
      process.env['INPUT_PREDICATE'] = content
      process.env['INPUT_PREDICATE-TYPE'] = 'https://example.com/predicate'
    })

    it('returns the predicate', () => {
      expect(predicateFromInputs()).toEqual({
        type: 'https://example.com/predicate',
        params: {}
      })
    })
  })
})
