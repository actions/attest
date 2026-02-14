import {
  detectAttestationType,
  validateAttestationInputs,
  DetectionInputs
} from '../../src/detect'

describe('detectAttestationType', () => {
  const blankInputs: DetectionInputs = {
    sbomPath: '',
    predicateType: '',
    predicate: '',
    predicatePath: ''
  }

  it('should return provenance when no inputs are provided', () => {
    expect(detectAttestationType(blankInputs)).toBe('provenance')
  })

  describe('SBOM detection', () => {
    it('should return sbom when sbom-path is provided', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        sbomPath: '/path/to/sbom.json'
      }
      expect(detectAttestationType(inputs)).toBe('sbom')
    })

    it('should prioritize sbom over custom predicate inputs', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        sbomPath: '/path/to/sbom.json',
        predicateType: 'https://example.com/predicate'
      }
      expect(detectAttestationType(inputs)).toBe('sbom')
    })
  })

  describe('custom detection', () => {
    it('should return custom when predicate-type is provided', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        predicateType: 'https://example.com/predicate'
      }
      expect(detectAttestationType(inputs)).toBe('custom')
    })

    it('should return custom when predicate is provided', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        predicate: '{}'
      }
      expect(detectAttestationType(inputs)).toBe('custom')
    })

    it('should return custom when predicate-path is provided', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        predicatePath: '/path/to/predicate.json'
      }
      expect(detectAttestationType(inputs)).toBe('custom')
    })

    it('should return custom when predicate-type and predicate are both provided', () => {
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

  it('should not throw when no inputs are provided', () => {
    expect(() => validateAttestationInputs(blankInputs)).not.toThrow()
  })

  it('should not throw when sbom-path is provided alone', () => {
    const inputs: DetectionInputs = {
      ...blankInputs,
      sbomPath: '/path/to/sbom.json'
    }
    expect(() => validateAttestationInputs(inputs)).not.toThrow()
  })

  describe('sbom-path conflicts', () => {
    it('should throw when sbom-path is combined with predicate-type', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        sbomPath: '/path/to/sbom.json',
        predicateType: 'https://example.com/predicate'
      }
      expect(() => validateAttestationInputs(inputs)).toThrow(
        /Cannot specify sbom-path together with/
      )
    })

    it('should throw when sbom-path is combined with predicate', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        sbomPath: '/path/to/sbom.json',
        predicate: '{}'
      }
      expect(() => validateAttestationInputs(inputs)).toThrow(
        /Cannot specify sbom-path together with/
      )
    })

    it('should throw when sbom-path is combined with predicate-path', () => {
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

  describe('predicate-type requirements', () => {
    it('should throw when predicate is provided without predicate-type', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        predicate: '{}'
      }
      expect(() => validateAttestationInputs(inputs)).toThrow(
        /predicate-type is required/
      )
    })

    it('should throw when predicate-path is provided without predicate-type', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        predicatePath: '/path/to/predicate.json'
      }
      expect(() => validateAttestationInputs(inputs)).toThrow(
        /predicate-type is required/
      )
    })

    it('should not throw when predicate-type and predicate are provided', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        predicateType: 'https://example.com/predicate',
        predicate: '{}'
      }
      expect(() => validateAttestationInputs(inputs)).not.toThrow()
    })

    it('should not throw when predicate-type and predicate-path are provided', () => {
      const inputs: DetectionInputs = {
        ...blankInputs,
        predicateType: 'https://example.com/predicate',
        predicatePath: '/path/to/predicate.json'
      }
      expect(() => validateAttestationInputs(inputs)).not.toThrow()
    })
  })
})
