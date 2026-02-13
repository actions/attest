import type { Predicate } from '@actions/attest'
import { jest } from '@jest/globals'

// Mock function
const mockBuildSLSAProvenancePredicate = jest.fn<() => Promise<Predicate>>()

// Mock @actions/attest
jest.unstable_mockModule('@actions/attest', () => ({
  buildSLSAProvenancePredicate: mockBuildSLSAProvenancePredicate
}))

// Dynamic import after mocking
const { generateProvenancePredicate } = await import('../src/provenance')

describe('generateProvenancePredicate', () => {
  const mockPredicate = {
    type: 'https://slsa.dev/provenance/v1',
    params: {
      buildDefinition: {
        buildType: 'https://actions.github.io/buildtypes/workflow/v1'
      },
      runDetails: {
        builder: { id: 'https://github.com/actions/runner' }
      }
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockBuildSLSAProvenancePredicate.mockResolvedValue(mockPredicate)
  })

  it('returns the SLSA provenance predicate', async () => {
    const result = await generateProvenancePredicate()

    expect(mockBuildSLSAProvenancePredicate).toHaveBeenCalledTimes(1)
    expect(result).toEqual(mockPredicate)
  })

  it('propagates errors from buildSLSAProvenancePredicate', async () => {
    const error = new Error('Failed to build provenance')
    mockBuildSLSAProvenancePredicate.mockRejectedValue(error)

    await expect(generateProvenancePredicate()).rejects.toThrow(
      'Failed to build provenance'
    )
  })
})
