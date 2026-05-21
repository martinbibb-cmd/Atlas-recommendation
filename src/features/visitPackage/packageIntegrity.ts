import {
  CANONICAL_VISIT_PACKAGE_INTEGRITY_ALGORITHM,
  type CanonicalVisitPackageIntegrityV1,
  type CanonicalVisitPackageV1,
} from './CanonicalVisitPackageV1';

export type CanonicalVisitPackageIntegrityStatus = 'verified' | 'modified' | 'unverified';

export interface CanonicalVisitPackageIntegrityResult {
  readonly status: CanonicalVisitPackageIntegrityStatus;
  readonly warnings: readonly string[];
  readonly expectedHash?: string;
  readonly actualHash?: string;
}

type CanonicalVisitPackageHashablePayload = Omit<CanonicalVisitPackageV1, 'packageIntegrity'>;

function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry === undefined ? null : entry)).join(',')}]`;
  }
  if (typeof value !== 'object') return 'null';

  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);
  return `{${entries.join(',')}}`;
}

function hashStablePayload(payload: CanonicalVisitPackageHashablePayload): string {
  const bytes = new TextEncoder().encode(stableStringify(payload));
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & mask;
  }

  return hash.toString(16).padStart(16, '0');
}

export function buildCanonicalVisitPackageIntegrity(
  payload: CanonicalVisitPackageHashablePayload,
): CanonicalVisitPackageIntegrityV1 {
  return {
    algorithm: CANONICAL_VISIT_PACKAGE_INTEGRITY_ALGORITHM,
    hash: hashStablePayload(payload),
  };
}

export function verifyCanonicalVisitPackageIntegrity(
  pkg: CanonicalVisitPackageV1,
): CanonicalVisitPackageIntegrityResult {
  const { packageIntegrity, ...payload } = pkg;

  if (packageIntegrity == null) {
    return {
      status: 'unverified',
      warnings: ['Package integrity metadata is missing. Importing as legacy/unverified.'],
    };
  }

  if (packageIntegrity.algorithm !== CANONICAL_VISIT_PACKAGE_INTEGRITY_ALGORITHM) {
    return {
      status: 'unverified',
      warnings: [
        `Package integrity algorithm "${packageIntegrity.algorithm}" is not supported. Importing as unverified.`,
      ],
      expectedHash: packageIntegrity.hash,
    };
  }

  const actualHash = hashStablePayload(payload);
  if (actualHash !== packageIntegrity.hash) {
    return {
      status: 'modified',
      warnings: ['Package contents appear to have changed after export. Review before proceeding.'],
      expectedHash: packageIntegrity.hash,
      actualHash,
    };
  }

  return {
    status: 'verified',
    warnings: [],
    expectedHash: packageIntegrity.hash,
    actualHash,
  };
}
