import { highlight, mute } from '../src/style.js'

describe('style', () => {
  describe('highlight', () => {
    it('adds cyan color to the string', () => {
      expect(highlight('foo')).toBe('\x1B[36mfoo\x1B[39m')
    })
  })

  describe('mute', () => {
    it('adds gray color to the string', () => {
      expect(mute('foo')).toBe('\x1B[38;5;244mfoo\x1B[39m')
    })
  })
})
