/**
 * Unit tests for the action's entrypoint, src/index.ts
 */

import * as core from '@actions/core'
import * as main from '../src/main'

// Mock the action's entrypoint
const runMock = jest.spyOn(main, 'run').mockImplementation()
const getBooleanInputMock = jest.spyOn(core, 'getBooleanInput')

describe('index', () => {
  beforeEach(() => {
    getBooleanInputMock.mockImplementation(() => false)
  })
  it('calls run when imported', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../src/index')

    expect(runMock).toHaveBeenCalled()
  })
})
