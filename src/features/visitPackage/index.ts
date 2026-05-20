export {
  CANONICAL_VISIT_PACKAGE_SCHEMA,
  CANONICAL_VISIT_PACKAGE_VERSION,
  type CanonicalVisitPackageV1,
  type CanonicalVisitIdentityV1,
  type CanonicalVisitWorkspaceBrandReferenceV1,
  type CanonicalVisitCustomerPropertyDetailsV1,
  type CanonicalVisitProposalTruthV1,
  type CanonicalVisitGeneratedOutputStatusV1,
  type CanonicalVisitImportExportMetadataV1,
} from './CanonicalVisitPackageV1';

export {
  buildCanonicalVisitPackage,
  serialiseCanonicalVisitPackage,
  type BuildCanonicalVisitPackageInput,
} from './buildCanonicalVisitPackage';

export {
  parseCanonicalVisitPackage,
  validateCanonicalVisitPackage,
  type CanonicalVisitPackageValidationResult,
} from './parseCanonicalVisitPackage';
