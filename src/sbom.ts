import fs from 'fs/promises'

import type { Predicate } from '@actions/attest'

export type SBOM = {
  type: 'spdx' | 'cyclonedx'
  object: object
}

// SBOMs cannot exceed 16MB.
const MAX_SBOM_SIZE_BYTES = 16 * 1024 * 1024

export const parseSBOMFromPath = async (filePath: string): Promise<SBOM> => {
  const fileContent = await fs.readFile(filePath, 'utf8')

  const stats = await fs.stat(filePath)
  if (stats.size > MAX_SBOM_SIZE_BYTES) {
    throw new Error(
      `SBOM file exceeds maximum allowed size: ${MAX_SBOM_SIZE_BYTES} bytes`
    )
  }

  const sbom = JSON.parse(fileContent) as object

  if (checkIsSPDX(sbom)) {
    return { type: 'spdx', object: sbom }
  } else if (checkIsCycloneDX(sbom)) {
    return { type: 'cyclonedx', object: sbom }
  }

  throw new Error(
    'Unsupported SBOM format. Must be valid SPDX or CycloneDX JSON.'
  )
}

const checkIsSPDX = (sbomObject: {
  spdxVersion?: string
  SPDXID?: string
}): boolean => {
  return !!(sbomObject?.spdxVersion && sbomObject?.SPDXID)
}

const checkIsCycloneDX = (sbomObject: {
  bomFormat?: string
  serialNumber?: string
  specVersion?: string
}): boolean => {
  return !!(
    sbomObject?.bomFormat &&
    sbomObject?.serialNumber &&
    sbomObject?.specVersion
  )
}

export const generateSBOMPredicate = (sbom: SBOM): Predicate => {
  switch (sbom.type) {
    case 'spdx':
      return generateSPDXPredicate(sbom.object)
    case 'cyclonedx':
      return generateCycloneDXPredicate(sbom.object)
    default:
      throw new Error('Unsupported SBOM format')
  }
}

// ref: https://github.com/in-toto/attestation/blob/main/spec/predicates/spdx.md
const generateSPDXPredicate = (sbom: object): Predicate => {
  const spdxVersion = (sbom as { spdxVersion?: string })?.['spdxVersion']
  if (!spdxVersion) {
    throw new Error('Cannot find spdxVersion in the SBOM')
  }

  const version = spdxVersion.split('-')[1]

  return {
    type: `https://spdx.dev/Document/v${version}`,
    params: sbom
  }
}

// ref: https://github.com/in-toto/attestation/blob/main/spec/predicates/cyclonedx.md
const generateCycloneDXPredicate = (sbom: object): Predicate => {
  return {
    type: 'https://cyclonedx.org/bom',
    params: sbom
  }
}
