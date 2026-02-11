import {
  detectAttestationType,
  validateAttestationInputs,
  DetectionInputs
} from '../src/detect'

describe('detectAttestationType', () => {
  const blankInputs: DetectionInputs = {
    sbomPath: '',
    predicateType: '',
    predicate: '',
    predicatePath: ''
  }

  describe('when no inputs are provided', () => {
    it('returns provenance', () => {
      expect(detectAttestationType(blankInputs)).toBe('provenance')
    })
  })

  describe('when sbom-path is provided', () => {
    it('returns sbom', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        sbomPath: '/path/to/sbom.json'
      }
      expect(detectAttestationType(inputs)).toBe('sbom')
    })

    it('returns sbom even when predicate inputs are also provided', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        sbomPath: '/path/to/sbom.json',
        predicateType: 'https://example.com/predicate'
      }
      expect(detectAttestationType(inputs)).toBe('sbom')
    })
  })

  describe('when predicate-type is provided', () => {
    it('returns custom', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        predicateType: 'https://example.com/predicate'
      }
      expect(detectAttestationType(inputs)).toBe('custom')
    })
  })

  describe('when predicate is provided', () => {
    it('returns custom', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        predicate: '{}'
      }
      expect(detectAttestationType(inputs)).toBe('custom')
    })
  })

  describe('when predicate-path is provided', () => {
    it('returns custom', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        predicatePath: '/path/to/predicate.json'
      }
      expect(detectAttestationType(inputs)).toBe('custom')
    })
  })

  describe('when predicate-type and predicate are provided', () => {
    it('returns custom', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        predicateType: 'https://example.com/predicate',
        predicate: '{}'
      }
      expect(detectAttestationType(inputs)).toBe('custom')
    })
  })
})

describe('validateAttestationInputs', () => {
  const blankInputs: DetectionInputs = {
    sbomPath: '',
    predicateType: '',
    predicate: '',
    predicatePath: ''
  }

  describe('when no inputs are provided', () => {
    it('does not throw', () => {
      expect(() => validateAttestationInputs(blankInputs)).not.toThrow()
    })
  })

  describe('when sbom-path is provided alone', () => {
    it('does not throw', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        sbomPath: '/path/to/sbom.json'
      }
      expect(() => validateAttestationInputs(inputs)).not.toThrow()
    })
  })

  describe('when sbom-path is combined with predicate-type', () => {
    it('throws an error', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        sbomPath: '/path/to/sbom.json',
        predicateType: 'https://example.com/predicate'
      }
      expect(() => validateAttestationInputs(inputs)).toThrow(
        /Cannot specify sbom-path together with/
      )
    })
  })

  describe('when sbom-path is combined with predicate', () => {
    it('throws an error', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        sbomPath: '/path/to/sbom.json',
        predicate: '{}'
      }
      expect(() => validateAttestationInputs(inputs)).toThrow(
        /Cannot specify sbom-path together with/
      )
    })
  })

  describe('when sbom-path is combined with predicate-path', () => {
    it('throws an error', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        sbomPath: '/path/to/sbom.json',
        predicatePath: '/path/to/predicate.json'
      }
      expect(() => validateAttestationInputs(inputs)).toThrow(
        /Cannot specify sbom-path together with/
      )
    })
  })

  describe('when predicate is provided without predicate-type', () => {
    it('throws an error', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        predicate: '{}'
      }
      expect(() => validateAttestationInputs(inputs)).toThrow(
        /predicate-type is required/
      )
    })
  })

  describe('when predicate-path is provided without predicate-type', () => {
    it('throws an error', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        predicatePath: '/path/to/predicate.json'
      }
      expect(() => validateAttestationInputs(inputs)).toThrow(
        /predicate-type is required/
      )
    })
  })

  describe('when predicate-type and predicate are provided', () => {
    it('does not throw', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        predicateType: 'https://example.com/predicate',
        predicate: '{}'
      }
      expect(() => validateAttestationInputs(inputs)).not.toThrow()
    })
  })

  describe('when predicate-type and predicate-path are provided', () => {
    it('does not throw', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        predicateType: 'https://example.com/predicate',
        predicatePath: '/path/to/predicate.json'
      }
      expect(() => validateAttestationInputs(inputs)).not.toThrow()
    })
  })
})
