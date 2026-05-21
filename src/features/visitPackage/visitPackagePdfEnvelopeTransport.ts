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

// ─── PDF layout constants ──────────────────────────────────────────────────────

const PDF_PAGE_W = 612;
const PDF_PAGE_H = 792;
const PDF_MARGIN_L = 50;
const PDF_TEXT_TOP_Y = 755;
const PDF_MIN_Y = 55; // Page bottom boundary

type VisitPackagePdfEnvelopeExtractionResult =
  | { readonly ok: true; readonly envelope: VisitPackagePdfEnvelopeV1 }
  | { readonly ok: false; readonly errors: readonly string[] };

// ─── Minimal CustomerJourneyPackV1 shape (avoids circular import) ─────────────

interface MinimalPrintSection {
  readonly heading: string;
  readonly summary: string;
  readonly keyTakeaway: string;
  readonly items: readonly string[];
}

interface MinimalPrintNextStep {
  readonly label: string;
  readonly body: string;
}

interface MinimalPrintCover {
  readonly title: string;
  readonly summary: string;
  readonly customerFacts: readonly string[];
  readonly brandName?: string;
  readonly addressSummary?: string;
}

interface MinimalStaticPdf {
  readonly cover: MinimalPrintCover;
  readonly sections: readonly MinimalPrintSection[];
  readonly nextSteps: readonly MinimalPrintNextStep[];
}

// ─── Layout item types ────────────────────────────────────────────────────────

type PdfFont = 'F1' | 'F2'; // F1 = Helvetica, F2 = Helvetica-Bold

interface PdfTextItem {
  readonly kind: 'text';
  readonly font: PdfFont;
  readonly size: number;
  readonly lineHeight: number;
  readonly text: string;
}

interface PdfGapItem {
  readonly kind: 'gap';
  readonly height: number;
}

type PdfLayoutItem = PdfTextItem | PdfGapItem;

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/**
 * Approximate max characters per line for a given font size in Helvetica,
 * fitting within the page text width (PDF_PAGE_W - 2 * PDF_MARGIN_L).
 * Helvetica average char width ≈ 0.56 × fontSize.
 */
function wrapWidth(fontSize: number): number {
  const textWidthPt = PDF_PAGE_W - 2 * PDF_MARGIN_L;
  return Math.max(20, Math.floor(textWidthPt / (fontSize * 0.56)));
}

function wordWrap(text: string, maxChars: number): readonly string[] {
  if (!hasText(text)) return [''];
  if (text.length <= maxChars) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current.length > 0 ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current.length > 0) lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars) : word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines.length > 0 ? lines : [text.slice(0, maxChars)];
}

function textItem(font: PdfFont, size: number, text: string): PdfTextItem {
  return { kind: 'text', font, size, lineHeight: Math.round(size * 1.35), text };
}

function titleItem(text: string): PdfTextItem {
  return { kind: 'text', font: 'F2', size: 16, lineHeight: 22, text };
}

function headingItem(text: string): PdfTextItem {
  return { kind: 'text', font: 'F2', size: 13, lineHeight: 18, text };
}

function subHeadingItem(text: string): PdfTextItem {
  return { kind: 'text', font: 'F2', size: 11, lineHeight: 16, text };
}

function bodyItem(text: string): PdfTextItem {
  return { kind: 'text', font: 'F1', size: 11, lineHeight: 15, text };
}

function smallItem(text: string): PdfTextItem {
  return { kind: 'text', font: 'F1', size: 9, lineHeight: 13, text };
}

function gapItem(height: number): PdfGapItem {
  return { kind: 'gap', height };
}

// ─── Customer journey content extraction ──────────────────────────────────────

function extractCustomerJourneyPack(envelope: VisitPackagePdfEnvelopeV1): MinimalStaticPdf | undefined {
  try {
    const pkgAsUnknown = envelope.canonicalVisitPackage as unknown;
    const pkgRecord = isRecord(pkgAsUnknown) ? pkgAsUnknown : undefined;
    if (!pkgRecord) return undefined;
    const outputStatus = isRecord(pkgRecord['generatedOutputStatus']) ? pkgRecord['generatedOutputStatus'] : undefined;
    if (!outputStatus) return undefined;
    const generatedOutputs = isRecord(outputStatus['generatedOutputs']) ? outputStatus['generatedOutputs'] : undefined;
    if (!generatedOutputs) return undefined;
    const journeyPackEntry = isRecord(generatedOutputs['customerJourneyPack']) ? generatedOutputs['customerJourneyPack'] : undefined;
    if (!journeyPackEntry) return undefined;
    const payload = isRecord(journeyPackEntry['payload']) ? journeyPackEntry['payload'] : undefined;
    if (!isRecord(payload)) return undefined;
    if (!isRecord(payload['staticPdf'])) return undefined;
    const sp = payload['staticPdf'] as Record<string, unknown>;
    if (!isRecord(sp['cover'])) return undefined;
    const cover = sp['cover'] as Record<string, unknown>;
    return {
      cover: {
        title: hasText(cover['title']) ? cover['title'] : '',
        summary: hasText(cover['summary']) ? cover['summary'] : '',
        customerFacts: Array.isArray(cover['customerFacts'])
          ? (cover['customerFacts'] as unknown[]).filter((f): f is string => hasText(f))
          : [],
        brandName: hasText(cover['brandName']) ? cover['brandName'] : undefined,
        addressSummary: hasText(cover['addressSummary']) ? cover['addressSummary'] : undefined,
      },
      sections: Array.isArray(sp['sections'])
        ? (sp['sections'] as unknown[]).filter(isRecord).map((s) => ({
            heading: hasText(s['heading']) ? s['heading'] : '',
            summary: hasText(s['summary']) ? s['summary'] : '',
            keyTakeaway: hasText(s['keyTakeaway']) ? s['keyTakeaway'] : '',
            items: Array.isArray(s['items'])
              ? (s['items'] as unknown[]).filter((i): i is string => hasText(i))
              : [],
          }))
        : [],
      nextSteps: Array.isArray(sp['nextSteps'])
        ? (sp['nextSteps'] as unknown[]).filter(isRecord).map((n) => ({
            label: hasText(n['label']) ? n['label'] : '',
            body: hasText(n['body']) ? n['body'] : '',
          }))
        : [],
    };
  } catch {
    return undefined;
  }
}

// ─── Layout item builders ─────────────────────────────────────────────────────

function buildCoverItems(envelope: VisitPackagePdfEnvelopeV1, pack?: MinimalStaticPdf): PdfLayoutItem[] {
  const items: PdfLayoutItem[] = [];

  // Title: use pack cover title (real recommendation label) if available
  const titleText = pack?.cover.title ?? envelope.title;
  for (const line of wordWrap(titleText, wrapWidth(16))) {
    items.push(titleItem(line));
  }
  items.push(gapItem(8));

  // Visit metadata
  items.push(smallItem(`Visit reference: ${envelope.visitReference}`));
  items.push(smallItem(`Generated: ${envelope.generatedAt}`));
  items.push(gapItem(16));

  // Address summary from pack cover
  if (pack != null && hasText(pack.cover.addressSummary)) {
    for (const line of wordWrap(pack.cover.addressSummary, wrapWidth(11))) {
      items.push(bodyItem(line));
    }
    items.push(gapItem(12));
  }

  // Customer facts
  const facts = pack?.cover.customerFacts?.length
    ? pack.cover.customerFacts
    : envelope.visibleContent.customerPropertySummary;
  if (facts.length > 0) {
    items.push(headingItem('Your home'));
    items.push(gapItem(5));
    for (const fact of facts) {
      for (const line of wordWrap(`- ${fact}`, wrapWidth(11))) {
        items.push(bodyItem(line));
      }
    }
    items.push(gapItem(14));
  }

  // Recommendation summary
  if (hasText(envelope.visibleContent.recommendationSummary)) {
    items.push(headingItem('What Atlas recommends'));
    items.push(gapItem(5));
    for (const line of wordWrap(envelope.visibleContent.recommendationSummary, wrapWidth(11))) {
      items.push(bodyItem(line));
    }
    items.push(gapItem(14));
  }

  // Pack cover summary (the full explanation paragraph)
  if (pack != null && hasText(pack.cover.summary)) {
    for (const line of wordWrap(pack.cover.summary, wrapWidth(11))) {
      items.push(bodyItem(line));
    }
    items.push(gapItem(14));
  }

  // Status
  items.push(smallItem(envelope.visibleContent.generatedOutputStatus));
  items.push(gapItem(12));

  // Atlas import instructions
  items.push(subHeadingItem('Open with Atlas'));
  for (const inst of envelope.visibleContent.openWithAtlasInstructions) {
    items.push(smallItem(`- ${inst}`));
  }

  return items;
}

function buildSectionItems(section: MinimalPrintSection): PdfLayoutItem[] {
  const items: PdfLayoutItem[] = [];

  for (const line of wordWrap(section.heading, wrapWidth(13))) {
    items.push(headingItem(line));
  }
  items.push(gapItem(6));

  for (const line of wordWrap(section.summary, wrapWidth(11))) {
    items.push(bodyItem(line));
  }
  items.push(gapItem(10));

  for (const factItem of section.items) {
    for (const line of wordWrap(`- ${factItem}`, wrapWidth(11))) {
      items.push(bodyItem(line));
    }
  }

  if (hasText(section.keyTakeaway)) {
    items.push(gapItem(10));
    items.push(subHeadingItem('Key takeaway'));
    for (const line of wordWrap(section.keyTakeaway, wrapWidth(11))) {
      items.push(bodyItem(line));
    }
  }

  items.push(gapItem(20));
  return items;
}

function buildNextStepsItems(nextSteps: readonly MinimalPrintNextStep[]): PdfLayoutItem[] {
  const items: PdfLayoutItem[] = [];
  items.push(headingItem('What happens next'));
  items.push(gapItem(8));
  for (const step of nextSteps) {
    if (hasText(step.label)) {
      items.push(subHeadingItem(step.label));
    }
    if (hasText(step.body)) {
      for (const line of wordWrap(step.body, wrapWidth(11))) {
        items.push(bodyItem(line));
      }
    }
    items.push(gapItem(10));
  }
  items.push(gapItem(14));
  items.push(smallItem('This document contains an embedded Atlas package for digital import.'));
  return items;
}

// ─── Page breaking ────────────────────────────────────────────────────────────

/**
 * Splits a flat list of layout items into pages, respecting the page height.
 */
function paginateItems(allItems: readonly PdfLayoutItem[]): PdfLayoutItem[][] {
  const pages: PdfLayoutItem[][] = [];
  let currentPage: PdfLayoutItem[] = [];
  let currentY = PDF_TEXT_TOP_Y;

  for (const item of allItems) {
    const itemHeight = item.kind === 'gap' ? item.height : item.lineHeight;
    if (currentY - itemHeight < PDF_MIN_Y && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      currentY = PDF_TEXT_TOP_Y;
    }
    currentPage.push(item);
    currentY -= itemHeight;
  }
  if (currentPage.length > 0) pages.push(currentPage);
  return pages;
}

// ─── Content stream renderer ──────────────────────────────────────────────────

function renderPageContentStream(pageItems: readonly PdfLayoutItem[]): string {
  const cmds: string[] = [];
  let y = PDF_TEXT_TOP_Y;
  let currentFont: PdfFont | null = null;
  let currentSize = 0;
  let inBt = false;

  function ensureFont(font: PdfFont, size: number) {
    if (currentFont !== font || currentSize !== size) {
      if (inBt) {
        cmds.push('ET');
        inBt = false;
      }
      currentFont = font;
      currentSize = size;
    }
    if (!inBt) {
      cmds.push(`BT\n/${currentFont} ${currentSize} Tf`);
      inBt = true;
    }
  }

  for (const item of pageItems) {
    if (item.kind === 'gap') {
      y -= item.height;
      continue;
    }
    ensureFont(item.font, item.size);
    cmds.push(`${PDF_MARGIN_L} ${y} Td\n(${escapePdfText(item.text)}) Tj\n0 0 Td`);
    y -= item.lineHeight;
  }

  if (inBt) cmds.push('ET');
  return cmds.join('\n');
}

// ─── Multi-page PDF assembly ──────────────────────────────────────────────────

/**
 * Assembles a complete PDF from an array of content streams and an embedded payload.
 *
 * Object layout (N pages):
 *   1       – Catalog
 *   2       – Pages tree
 *   3..N+2  – Page objects (odd-indexed pairs)
 *   N+3     – Font F1 (Helvetica)
 *   N+4     – Font F2 (Helvetica-Bold)
 *   N+5     – Payload stream (not linked to any page)
 *
 * Content streams are interleaved at page+1 object IDs, so page i occupies
 * objects 3+2*(i-1) and 4+2*(i-1).
 */
function assemblePdf(pageContentStreams: readonly string[], payloadStream: string): string {
  const n = pageContentStreams.length;

  // Object IDs
  const pageObjIds: number[] = [];
  const contentObjIds: number[] = [];
  for (let i = 0; i < n; i += 1) {
    pageObjIds.push(3 + 2 * i);
    contentObjIds.push(4 + 2 * i);
  }
  const fontF1ObjId = 3 + 2 * n;
  const fontF2ObjId = 4 + 2 * n;
  const payloadObjId = 5 + 2 * n;
  const totalObjects = payloadObjId;

  const fontResourceRef = `<< /Font << /F1 ${fontF1ObjId} 0 R /F2 ${fontF2ObjId} 0 R >> >>`;
  const pageKidsStr = pageObjIds.map((id) => `${id} 0 R`).join(' ');

  // Build object strings
  const objectStrings: string[] = new Array<string>(totalObjects);
  objectStrings[0] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objectStrings[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageKidsStr}] /Count ${n} >>\nendobj\n`;

  for (let i = 0; i < n; i += 1) {
    const pageId = pageObjIds[i];
    const contentId = contentObjIds[i];
    objectStrings[pageId - 1] = `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_W} ${PDF_PAGE_H}] /Contents ${contentId} 0 R /Resources ${fontResourceRef} >>\nendobj\n`;
    const cs = pageContentStreams[i];
    objectStrings[contentId - 1] = `${contentId} 0 obj\n<< /Length ${cs.length} >>\nstream\n${cs}\nendstream\nendobj\n`;
  }

  objectStrings[fontF1ObjId - 1] = `${fontF1ObjId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  objectStrings[fontF2ObjId - 1] = `${fontF2ObjId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;
  objectStrings[payloadObjId - 1] = `${payloadObjId} 0 obj\n<< /Length ${payloadStream.length} >>\nstream\n${payloadStream}\nendstream\nendobj\n`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0]; // offset[0] unused (free object), offsets[1..totalObjects] = byte offsets
  for (const objStr of objectStrings) {
    offsets.push(pdf.length);
    pdf += objStr;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${totalObjects + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= totalObjects; i += 1) {
    pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Renders a customer-facing PDF with the full recommendation content as visible
 * pages and the canonical visit package embedded as a hidden payload stream.
 *
 * Visible content is sourced from CustomerJourneyPackV1.staticPdf when present
 * in the package's generatedOutputs; otherwise falls back to envelope metadata.
 * The embedded payload is always the complete VisitPackagePdfEnvelopeV1 and is
 * used for digital import — it does not affect browser print or save behaviour.
 */
export function renderVisitPackagePdfDocument(envelope: VisitPackagePdfEnvelopeV1): string {
  const payloadBase64 = encodeBase64Utf8(JSON.stringify(envelope));
  const payloadStream = `${VISIT_PACKAGE_PDF_PAYLOAD_BEGIN_MARKER}\n${payloadBase64}\n${VISIT_PACKAGE_PDF_PAYLOAD_END_MARKER}`;

  const pack = extractCustomerJourneyPack(envelope);

  // Build layout items for all pages
  const allItems: PdfLayoutItem[] = [
    ...buildCoverItems(envelope, pack),
  ];

  if (pack != null) {
    for (const section of pack.sections) {
      allItems.push(...buildSectionItems(section));
    }
    if (pack.nextSteps.length > 0) {
      allItems.push(...buildNextStepsItems(pack.nextSteps));
    } else {
      allItems.push(...buildNextStepsItems([]));
    }
  } else {
    // Fallback: no pack, minimal footer
    allItems.push(gapItem(20));
    allItems.push(textItem('F1', 9, 'This document contains an embedded Atlas package for digital import.'));
  }

  const pages = paginateItems(allItems);
  const contentStreams = pages.map(renderPageContentStream);
  return assemblePdf(contentStreams, payloadStream);
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
