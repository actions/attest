import { highlight, mute } from '../../src/style'

describe('style', () => {
  describe('highlight', () => {
    it('should wrap text with cyan ANSI color codes', () => {
      const result = highlight('test message')
      expect(result).toBe('\x1B[36mtest message\x1B[39m')
    })

    it('should handle empty strings', () => {
      const result = highlight('')
      expect(result).toBe('\x1B[36m\x1B[39m')
    })
  })

  describe('mute', () => {
    it('should wrap text with gray ANSI color codes', () => {
      const result = mute('test message')
      expect(result).toBe('\x1B[38;5;244mtest message\x1B[39m')
    })

    it('should handle empty strings', () => {
      const result = mute('')
      expect(result).toBe('\x1B[38;5;244m\x1B[39m')
    })
  })
})
