/**
 * Unit tests for the action's entrypoint, src/index.ts
 */
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
    mockGetBooleanInput.mockReturnValue(false)
    mockGetInput.mockReturnValue('')
  })

  it('calls run when imported', async () => {
    // Dynamic import after mocking
    await import('../src/index')

    expect(mockRun).toHaveBeenCalled()
  })
})
