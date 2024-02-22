import fs from 'fs'
import { SBOM } from '@actions/attest'

export async function parseSBOMFromPath(path: string): Promise<SBOM> {
  // Read the file content
  const fileContent = await fs.promises.readFile(path, 'utf8')

  const sbom = JSON.parse(fileContent)

  if (checkIsSPDX(sbom)) {
    return { type: 'spdx', object: sbom }
  } else if (checkIsCycloneDX(sbom)) {
    return { type: 'cyclonedx', object: sbom }
  }
  throw new Error('Unsupported SBOM format')
}

function checkIsSPDX(sbomObject: {
  spdxVersion?: string
  SPDXID?: string
}): boolean {
  if (sbomObject?.spdxVersion && sbomObject?.SPDXID) {
    return true
  } else {
    return false
  }
}

function checkIsCycloneDX(sbomObject: {
  bomFormat?: string
  serialNumber?: string
  specVersion?: string
}): boolean {
  if (
    sbomObject?.bomFormat &&
    sbomObject?.serialNumber &&
    sbomObject?.specVersion
  ) {
    return true
  } else {
    return false
  }
}
