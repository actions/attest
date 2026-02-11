import { buildSLSAProvenancePredicate } from '@actions/attest'

import type { Predicate } from '@actions/attest'

export const generateProvenancePredicate = async (): Promise<Predicate> => {
  return buildSLSAProvenancePredicate()
}
