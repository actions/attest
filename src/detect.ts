export type AttestationType = 'provenance' | 'sbom' | 'custom'

export type DetectionInputs = {
  sbomPath: string
  predicateType: string
  predicate: string
  predicatePath: string
}

export const detectAttestationType = (
  inputs: DetectionInputs
): AttestationType => {
  const { sbomPath, predicateType, predicate, predicatePath } = inputs

  // SBOM mode takes priority
  if (sbomPath) {
    return 'sbom'
  }

  // Custom mode when any predicate inputs are provided
  if (predicateType || predicate || predicatePath) {
    return 'custom'
  }

  // Default to provenance mode
  return 'provenance'
}

export const validateAttestationInputs = (inputs: DetectionInputs): void => {
  const { sbomPath, predicateType, predicate, predicatePath } = inputs

  // Cannot combine sbom-path with predicate inputs
  if (sbomPath && (predicateType || predicate || predicatePath)) {
    throw new Error(
      'Cannot specify sbom-path together with predicate-type, predicate, or predicate-path'
    )
  }

  // Custom mode requires predicate-type
  if ((predicate || predicatePath) && !predicateType) {
    throw new Error(
      'predicate-type is required when using predicate or predicate-path'
    )
  }
}
