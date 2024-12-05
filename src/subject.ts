import * as glob from '@actions/glob'
import crypto from 'crypto'
import { parse } from 'csv-parse/sync'
import fs from 'fs'
import path from 'path'

import type { Subject } from '@actions/attest'

const MAX_SUBJECT_COUNT = 1024
const DIGEST_ALGORITHM = 'sha256'

export type SubjectInputs = {
  subjectPath: string
  subjectName: string
  subjectDigest: string
  downcaseName?: boolean
}
// Returns the subject specified by the action's inputs. The subject may be
// specified as a path to a file or as a digest. If a path is provided, the
// file's digest is calculated and returned along with the subject's name. If a
// digest is provided, the name must also be provided.
export const subjectFromInputs = async (
  inputs: SubjectInputs
): Promise<Subject[]> => {
  const { subjectPath, subjectDigest, subjectName, downcaseName } = inputs

  if (!subjectPath && !subjectDigest) {
    throw new Error('One of subject-path or subject-digest must be provided')
  }

  if (subjectPath && subjectDigest) {
    throw new Error(
      'Only one of subject-path or subject-digest may be provided'
    )
  }

  if (subjectDigest && !subjectName) {
    throw new Error('subject-name must be provided when using subject-digest')
  }

  // If push-to-registry is enabled, ensure the subject name is lowercase
  // to conform to OCI image naming conventions
  const name = downcaseName ? subjectName.toLowerCase() : subjectName

  if (subjectPath) {
    return await getSubjectFromPath(subjectPath, name)
  } else {
    return [getSubjectFromDigest(subjectDigest, name)]
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
  const subjectPaths = parseList(subjectPath).join('\n')

  // Expand the globbed paths to a list of actual paths
  /* eslint-disable-next-line github/no-then */
  const paths = await glob.create(subjectPaths).then(async g => g.glob())

  // Filter path list to just the files (not directories)
  const files = paths.filter(p => fs.statSync(p).isFile())

  if (files.length > MAX_SUBJECT_COUNT) {
    throw new Error(
      `Too many subjects specified. The maximum number of subjects is ${MAX_SUBJECT_COUNT}.`
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

const parseList = (input: string): string[] => {
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
