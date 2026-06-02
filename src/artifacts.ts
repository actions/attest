import fs from 'fs/promises'

import type { Subject } from '@actions/attest'

/**
 * Environment variable the runner sets to the path of a per-step
 * JSON file containing the job-scoped aggregate of artifact subjects
 * declared via $GITHUB_ARTIFACTS (ADR-0039).
 */
export const ARTIFACTS_LIST_ENV = 'GITHUB_ARTIFACTS_LIST'

/**
 * Format version this action understands. The runner emits a versioned
 * payload so the contract can evolve; bump-and-handle here if the
 * runner ships a breaking format change.
 */
const SUPPORTED_FORMAT_VERSION = 1

const DIGEST_REGEX = /^(?<algo>sha256|sha384|sha512):(?<hex>[0-9a-fA-F]+)$/

type RunnerArtifactSubject = {
  name?: unknown
  digest?: unknown
  kind?: unknown
}

type RunnerArtifactsList = {
  version?: unknown
  subjects?: unknown
}

/**
 * Returns true when the current runner has exposed a
 * GITHUB_ARTIFACTS_LIST file. Does not validate the contents.
 */
export const hasArtifactsListEnv = (): boolean => {
  const value = process.env[ARTIFACTS_LIST_ENV]
  return typeof value === 'string' && value.length > 0
}

/**
 * Read and parse the runner-emitted artifacts list, returning the
 * subjects in the order the runner observed them. Returns an empty
 * array when the env var is unset or points to an empty subjects list.
 *
 * Throws when the file is malformed or uses an unsupported format
 * version — surfacing a clear error is preferable to silently producing
 * no subjects and then failing later with a less actionable message.
 */
export const getSubjectsFromArtifactsList = async (): Promise<Subject[]> => {
  const filePath = process.env[ARTIFACTS_LIST_ENV]
  if (!filePath) {
    return []
  }

  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf-8')
  } catch (err) {
    throw new Error(
      `Failed to read ${ARTIFACTS_LIST_ENV} file at '${filePath}': ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  }

  // Trim because the runner may write a trailing newline.
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return []
  }

  let payload: RunnerArtifactsList
  try {
    payload = JSON.parse(trimmed) as RunnerArtifactsList
  } catch (err) {
    throw new Error(
      `Failed to parse ${ARTIFACTS_LIST_ENV} as JSON: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  }

  if (typeof payload !== 'object' || payload === null) {
    throw new Error(
      `${ARTIFACTS_LIST_ENV} payload must be a JSON object with 'version' and 'subjects' fields`
    )
  }
  if (payload.version !== SUPPORTED_FORMAT_VERSION) {
    throw new Error(
      `${ARTIFACTS_LIST_ENV} format version ${String(payload.version)} is not supported by this action (expected ${SUPPORTED_FORMAT_VERSION}).`
    )
  }
  if (!Array.isArray(payload.subjects)) {
    throw new Error(`${ARTIFACTS_LIST_ENV} 'subjects' must be an array`)
  }

  const subjects: Subject[] = []
  payload.subjects.forEach((entry, index) => {
    subjects.push(parseSubject(entry as RunnerArtifactSubject, index))
  })
  return subjects
}

const parseSubject = (entry: RunnerArtifactSubject, index: number): Subject => {
  if (typeof entry !== 'object' || entry === null) {
    throw new Error(
      `${ARTIFACTS_LIST_ENV} subject at index ${index} must be an object`
    )
  }
  const { name, digest } = entry
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error(
      `${ARTIFACTS_LIST_ENV} subject at index ${index} is missing a non-empty 'name'`
    )
  }
  if (typeof digest !== 'string') {
    throw new Error(
      `${ARTIFACTS_LIST_ENV} subject '${name}' is missing a string 'digest'`
    )
  }
  const match = DIGEST_REGEX.exec(digest)
  if (!match || !match.groups) {
    throw new Error(
      `${ARTIFACTS_LIST_ENV} subject '${name}' has an unrecognised digest '${digest}' (expected 'sha256|sha384|sha512:<hex>')`
    )
  }
  return {
    name,
    digest: { [match.groups.algo]: match.groups.hex.toLowerCase() }
  }
}
