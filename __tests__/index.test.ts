/**
 * Unit tests for the action's entrypoint, src/index.ts
 */

import { jest, describe, expect, beforeEach } from '@jest/globals'

// Mock modules before importing them
const runMock = jest.fn<() => Promise<void>>()

jest.unstable_mockModule('../src/main', () => ({
  run: runMock
}))

jest.unstable_mockModule('@actions/core', () => ({
  getInput: jest.fn(() => ''),
  getBooleanInput: jest.fn(() => false)
}))

describe('index', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  it('calls run when imported', async () => {
    await import('../src/index.js')

    expect(runMock).toHaveBeenCalled()
  })
})
