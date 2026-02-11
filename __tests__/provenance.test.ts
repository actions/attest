import { generateProvenancePredicate } from '../src/provenance'
import { buildSLSAProvenancePredicate } from '@actions/attest'

jest.mock('@actions/attest', () => ({
  buildSLSAProvenancePredicate: jest.fn()
}))

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
    ;(buildSLSAProvenancePredicate as jest.Mock).mockResolvedValue(
      mockPredicate
    )
  })

  it('returns the SLSA provenance predicate', async () => {
    const result = await generateProvenancePredicate()

    expect(buildSLSAProvenancePredicate).toHaveBeenCalledTimes(1)
    expect(result).toEqual(mockPredicate)
  })

  it('propagates errors from buildSLSAProvenancePredicate', async () => {
    const error = new Error('Failed to build provenance')
    ;(buildSLSAProvenancePredicate as jest.Mock).mockRejectedValue(error)

    await expect(generateProvenancePredicate()).rejects.toThrow(
      'Failed to build provenance'
    )
  })
})
