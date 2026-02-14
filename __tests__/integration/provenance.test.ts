import type { Predicate } from '@actions/attest'
import { jest } from '@jest/globals'
import { TEST_PROVENANCE_PREDICATE } from '../fixtures/mocks'

// Mock function
const mockBuildSLSAProvenancePredicate = jest.fn<() => Promise<Predicate>>()

// Mock @actions/attest
jest.unstable_mockModule('@actions/attest', () => ({
  buildSLSAProvenancePredicate: mockBuildSLSAProvenancePredicate
}))

// Dynamic import after mocking
const { generateProvenancePredicate } = await import('../../src/provenance')

describe('generateProvenancePredicate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockBuildSLSAProvenancePredicate.mockResolvedValue(TEST_PROVENANCE_PREDICATE)
  })

  it('should delegate to buildSLSAProvenancePredicate', async () => {
    const result = await generateProvenancePredicate()

    expect(mockBuildSLSAProvenancePredicate).toHaveBeenCalledTimes(1)
    expect(result).toEqual(TEST_PROVENANCE_PREDICATE)
  })

  it('should propagate errors from the underlying function', async () => {
    const error = new Error('Failed to build provenance predicate')
    mockBuildSLSAProvenancePredicate.mockRejectedValue(error)

    await expect(generateProvenancePredicate()).rejects.toThrow(
      'Failed to build provenance predicate'
    )
  })
})
