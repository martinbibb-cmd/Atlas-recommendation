import {
  CANONICAL_VISIT_PACKAGE_SCHEMA,
  CANONICAL_VISIT_PACKAGE_VERSION,
  type CanonicalVisitPackageV1,
} from './CanonicalVisitPackageV1';
import { buildCanonicalVisitPackageIntegrity } from './packageIntegrity';

export interface BuildCanonicalVisitPackageInput {
  readonly packageData: Omit<CanonicalVisitPackageV1, 'schema' | 'version' | 'packageIntegrity'>;
}

export function buildCanonicalVisitPackage(
  input: BuildCanonicalVisitPackageInput,
): CanonicalVisitPackageV1 {
  const packageIntegrity = buildCanonicalVisitPackageIntegrity({
    schema: CANONICAL_VISIT_PACKAGE_SCHEMA,
    version: CANONICAL_VISIT_PACKAGE_VERSION,
    ...input.packageData,
  });

  return {
    schema: CANONICAL_VISIT_PACKAGE_SCHEMA,
    version: CANONICAL_VISIT_PACKAGE_VERSION,
    packageIntegrity,
    ...input.packageData,
  };
}

export function serialiseCanonicalVisitPackage(pkg: CanonicalVisitPackageV1): string {
  return JSON.stringify(pkg, null, 2);
}
