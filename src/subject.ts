import * as glob from '@actions/glob'
import assert from 'assert'
import crypto from 'crypto'
import { parse } from 'csv-parse/sync'
import fs from 'fs'
import os from 'os'
import path from 'path'

import type { Subject } from '@actions/attest'

const MAX_SUBJECT_COUNT = 1024
const MAX_SUBJECT_CHECKSUM_SIZE_BYTES = 512 * MAX_SUBJECT_COUNT
const DIGEST_ALGORITHM = 'sha256'
const HEX_STRING_RE = /^[0-9a-fA-F]+$/

export type SubjectInputs = {
  subjectPath: string
  subjectName: string
  subjectDigest: string
  subjectChecksums: string
  downcaseName?: boolean
}
// Returns the subject specified by the action's inputs. The subject may be
// specified as a path to a file or as a digest. If a path is provided, the
// file's digest is calculated and returned along with the subject's name. If a
// digest is provided, the name must also be provided.
export const subjectFromInputs = async (
  inputs: SubjectInputs
): Promise<Subject[]> => {
  const {
    subjectPath,
    subjectDigest,
    subjectName,
    subjectChecksums,
    downcaseName
  } = inputs

  const enabledInputs = [subjectPath, subjectDigest, subjectChecksums].filter(
    Boolean
  )
  if (enabledInputs.length === 0) {
    throw new Error(
      'One of subject-path, subject-digest, or subject-checksums must be provided'
    )
  }

  if (enabledInputs.length > 1) {
    throw new Error(
      'Only one of subject-path, subject-digest, or subject-checksums may be provided'
    )
  }

  if (subjectDigest && !subjectName) {
    throw new Error('subject-name must be provided when using subject-digest')
  }

  // If push-to-registry is enabled, ensure the subject name is lowercase
  // to conform to OCI image naming conventions
  const name = downcaseName ? subjectName.toLowerCase() : subjectName

  switch (true) {
    case !!subjectPath:
      return getSubjectFromPath(subjectPath, name)
    case !!subjectDigest:
      return [getSubjectFromDigest(subjectDigest, name)]
    case !!subjectChecksums:
      return getSubjectFromChecksums(subjectChecksums)
    /* istanbul ignore next */
    default:
      // This should be unreachable, but TS requires a default case
      assert.fail('unreachable')
  }
}

// Returns the subject's digest as a formatted string of the form
// "<algorithm>:<digest>".
export const formatSubjectDigest = (subject: Subject): string => {
  const alg = Object.keys(subject.digest).sort()[0]
  return `${alg}:${subject.digest[alg]}`
}

// Returns the subject specified by the path to a file. The file's digest is
// calculated and returned along with the subject's name.
const getSubjectFromPath = async (
  subjectPath: string,
  subjectName?: string
): Promise<Subject[]> => {
  const digestedSubjects: Subject[] = []

  // Parse the list of subject paths
  const subjectPaths = parseSubjectPathList(subjectPath).join('\n')

  // Expand the globbed paths to a list of actual paths
  const paths = await glob.create(subjectPaths).then(async g => g.glob())

  // Filter path list to just the files (not directories)
  const files = paths.filter(p => fs.statSync(p).isFile())

  if (files.length > MAX_SUBJECT_COUNT) {
    throw new Error(
      `Too many subjects specified (${files.length}). The maximum number of subjects is ${MAX_SUBJECT_COUNT}.`
    )
  }

  for (const file of files) {
    const name = subjectName || path.parse(file).base
    const digest = await digestFile(DIGEST_ALGORITHM, file)

    // Only add the subject if it is not already in the list
    if (
      !digestedSubjects.some(
        s => s.name === name && s.digest[DIGEST_ALGORITHM] === digest
      )
    ) {
      digestedSubjects.push({ name, digest: { [DIGEST_ALGORITHM]: digest } })
    }
  }

  if (digestedSubjects.length === 0) {
    throw new Error(`Could not find subject at path ${subjectPath}`)
  }

  return digestedSubjects
}

// Returns the subject specified by the digest of a file. The digest is returned
// along with the subject's name.
const getSubjectFromDigest = (
  subjectDigest: string,
  subjectName: string
): Subject => {
  if (!subjectDigest.match(/^sha256:[A-Za-z0-9]{64}$/)) {
    throw new Error(
      'subject-digest must be in the format "sha256:<hex-digest>"'
    )
  }
  const [alg, digest] = subjectDigest.split(':')

  return {
    name: subjectName,
    digest: { [alg]: digest }
  }
}

const getSubjectFromChecksums = (subjectChecksums: string): Subject[] => {
  if (fs.existsSync(subjectChecksums)) {
    return getSubjectFromChecksumsFile(subjectChecksums)
  } else {
    return getSubjectFromChecksumsString(subjectChecksums)
  }
}

const getSubjectFromChecksumsFile = (checksumsPath: string): Subject[] => {
  const stats = fs.statSync(checksumsPath)
  if (!stats.isFile()) {
    throw new Error(`subject checksums file not found: ${checksumsPath}`)
  }

  /* istanbul ignore next */
  if (stats.size > MAX_SUBJECT_CHECKSUM_SIZE_BYTES) {
    throw new Error(
      `subject checksums file exceeds maximum allowed size: ${MAX_SUBJECT_CHECKSUM_SIZE_BYTES} bytes`
    )
  }

  const checksums = fs.readFileSync(checksumsPath, 'utf-8')
  return getSubjectFromChecksumsString(checksums)
}

const getSubjectFromChecksumsString = (checksums: string): Subject[] => {
  const subjects: Subject[] = []

  const records: string[] = checksums.split(os.EOL).filter(Boolean)

  for (const record of records) {
    // Find the space delimiter following the digest
    const delimIndex = record.indexOf(' ')

    // Skip any line that doesn't have a delimiter
    if (delimIndex === -1) {
      continue
    }

    // It's common for checksum records to have a leading flag character before
    // the artifact name. It will be either a '*' or a space.
    const flag_and_name = record.slice(delimIndex + 1)
    const name =
      flag_and_name.startsWith('*') || flag_and_name.startsWith(' ')
        ? flag_and_name.slice(1)
        : flag_and_name

    const digest = record.slice(0, delimIndex)

    if (!HEX_STRING_RE.test(digest)) {
      throw new Error(`Invalid digest: ${digest}`)
    }

    const alg = digestAlgorithm(digest)

    // Only add the subject if it is not already in the list (deduplicate by name & digest)
    if (!subjects.some(s => s.name === name && s.digest[alg] === digest)) {
      subjects.push({
        name,
        digest: { [alg]: digest }
      })
    }
  }

  return subjects
}

// Calculates the digest of a file using the specified algorithm. The file is
// streamed into the digest function to avoid loading the entire file into
// memory. The returned digest is a hex string.
const digestFile = async (
  algorithm: string,
  filePath: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm).setEncoding('hex')
    fs.createReadStream(filePath)
      .once('error', reject)
      .pipe(hash)
      .once('finish', () => resolve(hash.read()))
  })
}

const parseSubjectPathList = (input: string): string[] => {
  const res: string[] = []

  const records: string[][] = parse(input, {
    columns: false,
    relaxQuotes: true,
    relaxColumnCount: true,
    skipEmptyLines: true
  })

  for (const record of records) {
    res.push(...record)
  }

  return res.filter(item => item).map(pat => pat.trim())
}

const digestAlgorithm = (digest: string): string => {
  switch (digest.length) {
    case 64:
      return 'sha256'
    case 128:
      return 'sha512'
    default:
      throw new Error(`Unknown digest algorithm: ${digest}`)
  }
}
