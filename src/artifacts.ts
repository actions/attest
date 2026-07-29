import fs from 'fs/promises'

import type { Subject } from '@actions/attest'

const ARTIFACTS_LIST_ENV = 'GITHUB_ARTIFACTS_LIST'
const SUPPORTED_VERSION = 1

// Valid kinds and their allowed digest algorithms with expected hex lengths
const DIGEST_RULES: Record<string, Record<string, number>> = {
  file: { sha256: 64 },
  oci: { sha256: 64 }
}

const HEX_RE = /^[0-9a-fA-F]+$/

export type ArtifactsListEntry = {
  name: string
  digest: string
  kind: string
}

export type ArtifactsList = {
  version: number
  subjects: ArtifactsListEntry[]
}

export type ArtifactsListOptions = {
  downcaseOCI?: boolean
  requireSingleOCI?: boolean
}

/**
 * Extracts a displayable message from an unknown caught value.
 */
export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

/**
 * Reduces an OCI image reference to a bare "registry/repository" reference by
 * removing any tag and/or digest suffix. A tag or digest is preserved in the
 * attestation subject but must be stripped before pushing the attestation to
 * the registry: the subject's digest already pins the exact image, and the
 * registry-push path (@sigstore/oci) only accepts a bare reference.
 *
 * Handles every reference form:
 *   - foo/bar              -> foo/bar
 *   - foo/bar:tag          -> foo/bar
 *   - foo/bar@sha256:…      -> foo/bar
 *   - foo/bar:tag@sha256:…  -> foo/bar
 *
 * A registry port (e.g. "localhost:5000/repo") is preserved, since only a
 * colon appearing after the final path separator is treated as a tag.
 */
export const bareImageName = (name: string): string => {
  // Drop a digest suffix ("@sha256:…") first, if present.
  const atIndex = name.indexOf('@')
  const ref = atIndex === -1 ? name : name.slice(0, atIndex)
  // Then drop a tag suffix (":tag"), but not a registry port (a colon that
  // appears before the final path separator).
  const lastSlash = ref.lastIndexOf('/')
  const lastColon = ref.lastIndexOf(':')
  return lastColon > lastSlash ? ref.slice(0, lastColon) : ref
}

/**
 * Reads and parses the runner-generated artifacts list file identified by
 * the $GITHUB_ARTIFACTS_LIST environment variable. Returns undefined when
 * the env var is unset or blank (caller should treat this as "no discovered
 * subjects").
 *
 * Throws on any structural, encoding, or validation error so the caller
 * surfaces a clear failure rather than silently producing an empty list.
 */
export const readArtifactsList = async (
  options?: ArtifactsListOptions
): Promise<Subject[] | undefined> => {
  const filePath = process.env[ARTIFACTS_LIST_ENV]
  if (!filePath || filePath.trim() === '') {
    return undefined
  }

  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf-8')
  } catch (err: unknown) {
    const msg = errorMessage(err)
    throw new Error(`Failed to read artifacts list at "${filePath}": ${msg}`)
  }

  return parseArtifactsList(raw, options)
}

/**
 * Parse and validate the JSON content of an artifacts list file.
 */
export const parseArtifactsList = (
  content: string,
  options?: ArtifactsListOptions
): Subject[] => {
  // Reject UTF-8 BOM (U+FEFF) — runner emits UTF-8 without BOM.
  // Check before the whitespace test because String.prototype.trim()
  // strips U+FEFF, so a BOM-only file would otherwise look empty.
  if (content.charCodeAt(0) === 0xfeff) {
    throw new Error(
      'Artifacts list file contains a UTF-8 BOM; the file must be plain UTF-8'
    )
  }

  // The runner intentionally leaves the file empty when the feature is off.
  // Treat empty or whitespace-only content as "no discovered subjects".
  if (content.trim() === '') {
    return []
  }

  let data: unknown
  try {
    data = JSON.parse(content)
  } catch {
    throw new Error('Artifacts list file contains invalid JSON')
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Artifacts list must be a JSON object')
  }

  const obj = data as Record<string, unknown>

  // Version check
  if (obj.version !== SUPPORTED_VERSION) {
    throw new Error(
      `Unsupported artifacts list version: ${JSON.stringify(obj.version)} (expected ${SUPPORTED_VERSION})`
    )
  }

  // Subjects array
  if (!Array.isArray(obj.subjects)) {
    throw new Error('Artifacts list is missing a "subjects" array')
  }

  const entries = obj.subjects as unknown[]
  const subjects: Subject[] = []

  // Track (normalizedName, kind, digest) for dedup and conflict detection
  const seen = new Map<string, { kind: string; digest: string }>()

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`Artifacts list entry ${i}: must be a JSON object`)
    }

    const e = entry as Record<string, unknown>
    const { name: rawName, kind, digest } = validateEntry(e, i)

    // Normalize OCI names to lowercase when requested (e.g. for registry push).
    // This must happen before dedup so that case-only duplicates collapse and
    // case-colliding names with different digests are detected as conflicts.
    // The image tag (if any) is intentionally preserved so it appears in the
    // attestation subject; it is stripped later, only when the attestation is
    // pushed to the registry (see bareImageName usage in attest.ts).
    const name =
      options?.downcaseOCI && kind === 'oci' ? rawName.toLowerCase() : rawName

    // Check for conflicts or duplicates by normalized name
    const prev = seen.get(name)
    if (prev) {
      if (prev.kind === kind && prev.digest === digest) {
        // Exact duplicate — skip silently
        continue
      }
      throw new Error(
        `Artifacts list entry ${i}: duplicate name "${name}" with conflicting kind or digest`
      )
    }
    seen.set(name, { kind, digest })

    // Convert digest string "algorithm:hex" to Subject shape
    const colonIdx = digest.indexOf(':')
    const algorithm = digest.slice(0, colonIdx)
    const hex = digest.slice(colonIdx + 1)

    subjects.push({
      name,
      digest: { [algorithm]: hex }
    })
  }

  // When requireSingleOCI is set (registry push flow), enforce that exactly
  // one subject was discovered and that it is OCI-kind. This prevents file
  // subjects from leaking into the registry push path.
  if (options?.requireSingleOCI && subjects.length > 0) {
    // Re-check kinds from the validated entries — we tracked them in `seen`
    const kinds = [...seen.values()].map(v => v.kind)
    const hasNonOCI = kinds.some(k => k !== 'oci')

    if (hasNonOCI) {
      throw new Error(
        'push-to-registry requires an OCI subject but the discovered artifacts list contains file-kind subjects'
      )
    }
    if (subjects.length > 1) {
      throw new Error(
        'push-to-registry requires exactly one subject but the discovered artifacts list contains multiple subjects'
      )
    }
  }

  return subjects
}

/**
 * Validate a single entry from the artifacts list. Returns the validated
 * name, kind, and digest string on success; throws with a contextual
 * message on failure.
 */
const validateEntry = (
  entry: Record<string, unknown>,
  index: number
): { name: string; kind: string; digest: string } => {
  // name
  if (typeof entry.name !== 'string' || entry.name === '') {
    throw new Error(
      `Artifacts list entry ${index}: "name" must be a non-empty string`
    )
  }
  const name = entry.name

  // kind
  if (typeof entry.kind !== 'string') {
    throw new Error(`Artifacts list entry ${index}: "kind" must be a string`)
  }
  const kind = entry.kind
  const allowedAlgorithms = DIGEST_RULES[kind]
  if (!allowedAlgorithms) {
    throw new Error(
      `Artifacts list entry ${index}: unsupported kind "${kind}" (expected "file" or "oci")`
    )
  }

  // digest — must be "algorithm:hex"
  if (typeof entry.digest !== 'string' || entry.digest === '') {
    throw new Error(
      `Artifacts list entry ${index}: "digest" must be a non-empty string`
    )
  }
  const digest = entry.digest
  const colonIdx = digest.indexOf(':')
  if (colonIdx === -1) {
    throw new Error(
      `Artifacts list entry ${index}: digest must be in the format "algorithm:hex"`
    )
  }
  const algorithm = digest.slice(0, colonIdx)
  const hex = digest.slice(colonIdx + 1)

  const expectedLen = allowedAlgorithms[algorithm]
  if (expectedLen === undefined) {
    const allowed = Object.keys(allowedAlgorithms).join(', ')
    throw new Error(
      `Artifacts list entry ${index}: algorithm "${algorithm}" is not allowed for kind "${kind}" (allowed: ${allowed})`
    )
  }

  if (!HEX_RE.test(hex)) {
    throw new Error(
      `Artifacts list entry ${index}: digest contains invalid hex characters`
    )
  }

  if (hex.length !== expectedLen) {
    throw new Error(
      `Artifacts list entry ${index}: digest has ${hex.length} hex characters but "${algorithm}" requires exactly ${expectedLen}`
    )
  }

  return { name, kind, digest }
}
