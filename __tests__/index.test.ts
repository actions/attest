import { jest } from '@jest/globals'

// Mock functions
const mockRun = jest.fn()
const mockGetInput = jest.fn()
const mockGetBooleanInput = jest.fn()

// Mock @actions/core
jest.unstable_mockModule('@actions/core', () => ({
  getInput: mockGetInput,
  getBooleanInput: mockGetBooleanInput
}))

// Mock ../src/main
jest.unstable_mockModule('../src/main', () => ({
  run: mockRun
}))

describe('index', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetInput.mockReturnValue('')
    mockGetBooleanInput.mockReturnValue(false)
  })

  it('should call run with inputs from core.getInput', async () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'subject-path': '/path/to/subject',
        'subject-name': 'my-artifact',
        'subject-digest': '',
        'subject-checksums': '',
        'subject-version': '',
        'predicate-type': 'https://example.com/predicate',
        predicate: '{}',
        'predicate-path': '',
        'sbom-path': '',
        'github-token': 'test-token'
      }
      return inputs[name] || ''
    })

    mockGetBooleanInput.mockImplementation((name: string) => {
      const inputs: Record<string, boolean> = {
        'push-to-registry': false,
        'create-storage-record': true,
        'show-summary': true,
        'private-signing': false
      }
      return inputs[name] || false
    })

    // Dynamic import triggers the module
    await import('../src/index')

    expect(mockRun).toHaveBeenCalledWith({
      subjectPath: '/path/to/subject',
      subjectName: 'my-artifact',
      subjectDigest: '',
      subjectChecksums: '',
      subjectVersion: '',
      predicateType: 'https://example.com/predicate',
      predicate: '{}',
      predicatePath: '',
      sbomPath: '',
      githubToken: 'test-token',
      pushToRegistry: false,
      createStorageRecord: true,
      showSummary: true,
      privateSigning: false
    })
  })
})
