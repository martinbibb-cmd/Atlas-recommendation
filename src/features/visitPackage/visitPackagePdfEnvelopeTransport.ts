import {
  validateCanonicalVisitPackage,
  type CanonicalVisitPackageValidationResult,
} from './parseCanonicalVisitPackage';
import {
  VISIT_PACKAGE_PDF_ENVELOPE_SCHEMA,
  VISIT_PACKAGE_PDF_ENVELOPE_VERSION,
  type VisitPackagePdfEnvelopeV1,
} from './VisitPackagePdfEnvelopeV1';

export const VISIT_PACKAGE_PDF_PAYLOAD_BEGIN_MARKER = 'ATLAS_VISIT_PACKAGE_ENVELOPE_BEGIN';
export const VISIT_PACKAGE_PDF_PAYLOAD_END_MARKER = 'ATLAS_VISIT_PACKAGE_ENVELOPE_END';
const MAX_PDF_CONTENT_LINES = 42;

type VisitPackagePdfEnvelopeExtractionResult =
  | { readonly ok: true; readonly envelope: VisitPackagePdfEnvelopeV1 }
  | { readonly ok: false; readonly errors: readonly string[] };

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function toAsciiPdfSafeText(input: string): string {
  return input.replace(/[^\x20-\x7E]/g, '?');
}

function escapePdfText(input: string): string {
  return toAsciiPdfSafeText(input)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function encodeBase64Utf8(input: string): string {
  if (typeof btoa === 'function') {
    const utf8 = encodeURIComponent(input).replace(/%([0-9A-F]{2})/gi, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)));
    return btoa(utf8);
  }
  const maybeBuffer = (globalThis as { Buffer?: { from: (value: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (maybeBuffer != null) {
    return maybeBuffer.from(input, 'utf8').toString('base64');
  }
  throw new Error('Base64 encoder unavailable.');
}

function decodeBase64Utf8(input: string): string {
  if (typeof atob === 'function') {
    const binary = atob(input);
    let encoded = '';
    for (let i = 0; i < binary.length; i += 1) {
      encoded += `%${binary.charCodeAt(i).toString(16).padStart(2, '0')}`;
    }
    return decodeURIComponent(encoded);
  }
  const maybeBuffer = (globalThis as { Buffer?: { from: (value: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (maybeBuffer != null) {
    return maybeBuffer.from(input, 'base64').toString('utf8');
  }
  throw new Error('Base64 decoder unavailable.');
}

function buildPdfContentLines(envelope: VisitPackagePdfEnvelopeV1): readonly string[] {
  const lines: string[] = [
    envelope.title,
    `Visit reference: ${envelope.visitReference}`,
    `Generated: ${envelope.generatedAt}`,
    '',
    'Customer/property summary',
    ...envelope.visibleContent.customerPropertySummary.map((line) => `- ${line}`),
  ];
  if (hasText(envelope.visibleContent.recommendationSummary)) {
    lines.push('', 'Recommended system', envelope.visibleContent.recommendationSummary);
  }
  lines.push('', envelope.visibleContent.generatedOutputStatus, '', 'Open with Atlas');
  lines.push(...envelope.visibleContent.openWithAtlasInstructions.map((line) => `- ${line}`));
  return lines.slice(0, MAX_PDF_CONTENT_LINES);
}

export function renderVisitPackagePdfDocument(envelope: VisitPackagePdfEnvelopeV1): string {
  const payloadBase64 = encodeBase64Utf8(JSON.stringify(envelope));
  const contentBody = buildPdfContentLines(envelope)
    .map((line) => `(${escapePdfText(line)}) Tj`)
    .join('\nT*\n');
  const contentStream = `BT\n/F1 12 Tf\n50 790 Td\n14 TL\n${contentBody}\nET`;
  const payloadStream = `${VISIT_PACKAGE_PDF_PAYLOAD_BEGIN_MARKER}\n${payloadBase64}\n${VISIT_PACKAGE_PDF_PAYLOAD_END_MARKER}`;

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `6 0 obj\n<< /Length ${payloadStream.length} >>\nstream\n${payloadStream}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += object;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

export function extractVisitPackagePdfEnvelope(
  input: string,
): VisitPackagePdfEnvelopeExtractionResult {
  const begin = input.indexOf(VISIT_PACKAGE_PDF_PAYLOAD_BEGIN_MARKER);
  const end = input.indexOf(VISIT_PACKAGE_PDF_PAYLOAD_END_MARKER);
  if (begin < 0 || end < 0 || end <= begin) {
    return { ok: false, errors: ['No Atlas visit package payload marker found in PDF.'] };
  }
  const payloadBase64 = input
    .slice(begin + VISIT_PACKAGE_PDF_PAYLOAD_BEGIN_MARKER.length, end)
    .trim();
  if (!hasText(payloadBase64)) {
    return { ok: false, errors: ['Embedded Atlas visit package payload is empty.'] };
  }
  try {
    const raw = JSON.parse(decodeBase64Utf8(payloadBase64)) as unknown;
    if (!isRecord(raw)) {
      return { ok: false, errors: ['Embedded payload must be an object.'] };
    }
    if (raw['schema'] !== VISIT_PACKAGE_PDF_ENVELOPE_SCHEMA) {
      return { ok: false, errors: ['Embedded payload schema mismatch for visit package PDF envelope.'] };
    }
    if (raw['version'] !== VISIT_PACKAGE_PDF_ENVELOPE_VERSION) {
      return { ok: false, errors: ['Embedded payload version mismatch for visit package PDF envelope.'] };
    }
    if (!isRecord(raw['canonicalVisitPackage'])) {
      return { ok: false, errors: ['Embedded payload missing canonical visit package object.'] };
    }
    return {
      ok: true,
      envelope: raw as unknown as VisitPackagePdfEnvelopeV1,
    };
  } catch {
    return { ok: false, errors: ['Embedded Atlas visit package payload is not valid.'] };
  }
}

export function parseCanonicalVisitPackageFromPdfEnvelope(
  input: string,
): CanonicalVisitPackageValidationResult {
  const extracted = extractVisitPackagePdfEnvelope(input);
  if (!extracted.ok) {
    return { ok: false, errors: extracted.errors };
  }
  return validateCanonicalVisitPackage(extracted.envelope.canonicalVisitPackage);
}
