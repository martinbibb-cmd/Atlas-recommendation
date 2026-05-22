import {
  validateCanonicalVisitPackage,
  type CanonicalVisitPackageValidationResult,
} from './parseCanonicalVisitPackage';
import {
  VISIT_PACKAGE_PDF_ENVELOPE_SCHEMA,
  VISIT_PACKAGE_PDF_ENVELOPE_VERSION,
  type VisitPackagePdfEnvelopeV1,
} from './VisitPackagePdfEnvelopeV1';
import {
  buildCustomerDocumentModel,
  type CustomerDocumentModelV1,
} from '../../library/portal/pdf/CustomerDocumentRenderer';
import {
  buildCustomerJourneyPack,
  readCustomerJourneyPackFromGeneratedOutputs,
  type PortalJourneyPrintModelV1,
} from '../../library/portal/pdf/buildPortalJourneyPrintModel';

export const VISIT_PACKAGE_PDF_PAYLOAD_BEGIN_MARKER = 'ATLAS_VISIT_PACKAGE_ENVELOPE_BEGIN';
export const VISIT_PACKAGE_PDF_PAYLOAD_END_MARKER = 'ATLAS_VISIT_PACKAGE_ENVELOPE_END';
export const VISIT_PACKAGE_PDF_NO_MARKER_ERROR =
  'No Atlas visit package payload marker found in PDF. This PDF is printable Atlas output only, not an importable visit package. Use Download customer PDF to create a .atlasvisit.pdf file.';

// ─── PDF layout constants ──────────────────────────────────────────────────────

const PDF_PAGE_W = 612;
const PDF_PAGE_H = 792;
const PDF_MARGIN_L = 50;
const PDF_TEXT_TOP_Y = 755;
const PDF_MIN_Y = 55; // Page bottom boundary
const SECTION_RECOMMENDATION_SUMMARY = 'Recommendation summary';
const SECTION_WHY_THIS_FITS = 'Why this fits your home';
const SECTION_PRACTICAL_OUTCOMES = 'Practical outcomes';
const SECTION_PROTECTION_AND_CONDITION = 'Protection and system condition';
const SECTION_NEXT_STEPS = 'What happens next';
const INSTALLER_CHECK_HEADING = 'Installer check';
const DEEP_DIVE_LINKS_HEADING = 'Deep dive links (optional)';

type VisitPackagePdfEnvelopeExtractionResult =
  | { readonly ok: true; readonly envelope: VisitPackagePdfEnvelopeV1 }
  | { readonly ok: false; readonly errors: readonly string[] };

// ─── Layout item types ────────────────────────────────────────────────────────

type PdfFont = 'F1' | 'F2'; // F1 = Helvetica, F2 = Helvetica-Bold
type CustomerPdfBlockType =
  | 'section_heading'
  | 'subheading'
  | 'body'
  | 'bullet'
  | 'small'
  | 'gap';
type CustomerPdfPageBreakPolicy = 'auto' | 'avoid' | 'always';

interface CustomerPdfDraftBlock {
  readonly kind: 'text' | 'gap';
  readonly blockType: CustomerPdfBlockType;
  readonly text?: string;
  readonly font: PdfFont;
  readonly size: number;
  readonly lineHeight: number;
  readonly spacingBefore: number;
  readonly spacingAfter: number;
  readonly pageBreakPolicy: CustomerPdfPageBreakPolicy;
}

interface CustomerPdfMeasuredBlock extends CustomerPdfDraftBlock {
  readonly lines: readonly string[];
  readonly intrinsicHeight: number;
  readonly wrappedHeight: number;
  readonly totalHeight: number;
}

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

function createTextBlock(
  blockType: Exclude<CustomerPdfBlockType, 'gap'>,
  text: string,
  options: {
    readonly font?: PdfFont;
    readonly size?: number;
    readonly lineHeight?: number;
    readonly spacingBefore?: number;
    readonly spacingAfter?: number;
    readonly pageBreakPolicy?: CustomerPdfPageBreakPolicy;
  } = {},
): CustomerPdfDraftBlock {
  return {
    kind: 'text',
    blockType,
    text,
    font: options.font ?? (blockType === 'section_heading' || blockType === 'subheading' ? 'F2' : 'F1'),
    size: options.size ?? (blockType === 'section_heading' ? 13 : blockType === 'small' ? 9 : 11),
    lineHeight: options.lineHeight ?? (blockType === 'section_heading' ? 18 : blockType === 'small' ? 13 : 15),
    spacingBefore: options.spacingBefore ?? 0,
    spacingAfter: options.spacingAfter ?? 0,
    pageBreakPolicy: options.pageBreakPolicy ?? 'auto',
  };
}

function createGapBlock(height: number): CustomerPdfDraftBlock {
  return {
    kind: 'gap',
    blockType: 'gap',
    font: 'F1',
    // For gap blocks, `size` stores the intrinsic vertical gap height in points.
    size: height,
    lineHeight: 0,
    spacingBefore: 0,
    spacingAfter: 0,
    pageBreakPolicy: 'auto',
    text: undefined,
  };
}

// ─── Customer journey content extraction ──────────────────────────────────────

function buildFallbackPrintModel(envelope: VisitPackagePdfEnvelopeV1): PortalJourneyPrintModelV1 {
  const fallbackSummary = hasText(envelope.visibleContent.recommendationSummary)
    ? envelope.visibleContent.recommendationSummary
    : 'Journey recommendation details are missing or incomplete in this export package. Please regenerate the visit package so all customer guidance is included.';
  return {
    cover: {
      title: envelope.title,
      summary: fallbackSummary,
      customerFacts: [...envelope.visibleContent.customerPropertySummary],
    },
    recommendationReasons: [],
    sections: [],
    nextSteps: [],
    qrDestinations: [],
    pageEstimate: {
      usedPages: 1,
      maxPages: 7,
    },
  };
}

function resolveCustomerDocument(envelope: VisitPackagePdfEnvelopeV1): CustomerDocumentModelV1 {
  const canonicalVisitPackage = envelope.canonicalVisitPackage;
  const packagedJourney = readCustomerJourneyPackFromGeneratedOutputs(
    canonicalVisitPackage.generatedOutputStatus?.generatedOutputs,
  );
  const hasRecommendationContext =
    canonicalVisitPackage.proposalTruth?.decision != null
    || hasText(canonicalVisitPackage.proposalTruth?.selectedScenarioId)
    || hasText(canonicalVisitPackage.proposalTruth?.customerSummary?.headline)
    || hasText(canonicalVisitPackage.proposalTruth?.customerSummary?.recommendedSystemLabel);
  const staticPdfModel = (packagedJourney != null || hasRecommendationContext)
    ? buildCustomerJourneyPack({
        canonicalVisitPackage,
        customerJourneyPack: packagedJourney,
      }).staticPdf
    : buildFallbackPrintModel(envelope);
  return buildCustomerDocumentModel({
    model: staticPdfModel,
    mode: 'packageEmbedded',
  });
}

// ─── Deterministic customer PDF block layout engine ───────────────────────────

function measureBlock(block: CustomerPdfDraftBlock): CustomerPdfMeasuredBlock {
  if (block.kind === 'gap') {
    const intrinsicHeight = block.size;
    return {
      ...block,
      lines: [],
      intrinsicHeight,
      wrappedHeight: 0,
      totalHeight: block.spacingBefore + intrinsicHeight + block.spacingAfter,
    };
  }

  const lines = wordWrap(block.text ?? '', wrapWidth(block.size));
  const intrinsicHeight = lines.length > 0 ? block.lineHeight : 0;
  const wrappedHeight = lines.length > 1 ? (lines.length - 1) * block.lineHeight : 0;
  return {
    ...block,
    lines,
    intrinsicHeight,
    wrappedHeight,
    totalHeight: block.spacingBefore + intrinsicHeight + wrappedHeight + block.spacingAfter,
  };
}

function splitMeasuredTextBlockForPage(
  block: CustomerPdfMeasuredBlock,
  availableHeight: number,
): { readonly fit: CustomerPdfMeasuredBlock; readonly remainder: CustomerPdfMeasuredBlock } | null {
  if (block.kind !== 'text' || block.lines.length < 2) return null;
  const maxRenderableLines = Math.floor((availableHeight - block.spacingBefore) / block.lineHeight);
  const fitLineCount = Math.max(1, Math.min(block.lines.length - 1, maxRenderableLines));
  if (fitLineCount < 1) return null;

  const fitLines = block.lines.slice(0, fitLineCount);
  const remainderLines = block.lines.slice(fitLineCount);
  if (remainderLines.length === 0) return null;

  const fit: CustomerPdfMeasuredBlock = {
    ...block,
    lines: fitLines,
    intrinsicHeight: fitLines.length > 0 ? block.lineHeight : 0,
    wrappedHeight: fitLines.length > 1 ? (fitLines.length - 1) * block.lineHeight : 0,
    spacingAfter: 0,
    totalHeight: block.spacingBefore
      + (fitLines.length > 0 ? block.lineHeight : 0)
      + (fitLines.length > 1 ? (fitLines.length - 1) * block.lineHeight : 0),
  };
  const fitTotalHeight = fit.spacingBefore + fit.intrinsicHeight + fit.wrappedHeight;

  const remainder: CustomerPdfMeasuredBlock = {
    ...block,
    lines: remainderLines,
    intrinsicHeight: remainderLines.length > 0 ? block.lineHeight : 0,
    wrappedHeight: remainderLines.length > 1 ? (remainderLines.length - 1) * block.lineHeight : 0,
    spacingBefore: 0,
    totalHeight: (remainderLines.length > 0 ? block.lineHeight : 0)
      + (remainderLines.length > 1 ? (remainderLines.length - 1) * block.lineHeight : 0)
      + block.spacingAfter,
  };
  const remainderTotalHeight = remainder.spacingBefore + remainder.intrinsicHeight + remainder.wrappedHeight + remainder.spacingAfter;

  return {
    fit: {
      ...fit,
      totalHeight: fitTotalHeight,
    },
    remainder: {
      ...remainder,
      totalHeight: remainderTotalHeight,
    },
  };
}

class CustomerPdfBlockLayoutEngine {
  private readonly measuredBlocks: readonly CustomerPdfMeasuredBlock[];

  constructor(blocks: readonly CustomerPdfDraftBlock[]) {
    this.measuredBlocks = blocks.map(measureBlock);
  }

  private paginate(): CustomerPdfMeasuredBlock[][] {
    const pages: CustomerPdfMeasuredBlock[][] = [];
    let currentPage: CustomerPdfMeasuredBlock[] = [];
    let currentY = PDF_TEXT_TOP_Y;
    const queue: CustomerPdfMeasuredBlock[] = [...this.measuredBlocks];

    while (queue.length > 0) {
      const block = queue.shift() as CustomerPdfMeasuredBlock;

      if (block.pageBreakPolicy === 'always' && currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        currentY = PDF_TEXT_TOP_Y;
      }

      const availableHeight = currentY - PDF_MIN_Y;
      if (block.totalHeight <= availableHeight) {
        currentPage.push(block);
        currentY -= block.totalHeight;
        continue;
      }

      if (currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        currentY = PDF_TEXT_TOP_Y;
        queue.unshift(block);
        continue;
      }

      const split = splitMeasuredTextBlockForPage(block, availableHeight);
      if (split != null) {
        currentPage.push(split.fit);
        pages.push(currentPage);
        currentPage = [];
        currentY = PDF_TEXT_TOP_Y;
        queue.unshift(split.remainder);
        continue;
      }

      currentPage.push(block);
      pages.push(currentPage);
      currentPage = [];
      currentY = PDF_TEXT_TOP_Y;
    }

    if (currentPage.length > 0) pages.push(currentPage);
    return pages;
  }

  private drawPageContentStream(pageBlocks: readonly CustomerPdfMeasuredBlock[]): string {
    const cmds: string[] = [];
    let y = PDF_TEXT_TOP_Y;
    let currentFont: PdfFont | null = null;
    let currentSize = 0;
    let inBt = false;

    const ensureFont = (font: PdfFont, size: number) => {
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
    };

    for (const block of pageBlocks) {
      y -= block.spacingBefore;
      if (block.kind === 'gap') {
        y -= block.intrinsicHeight;
        y -= block.spacingAfter;
        continue;
      }

      ensureFont(block.font, block.size);
      for (const line of block.lines) {
        cmds.push(`${PDF_MARGIN_L} ${y} Td\n(${escapePdfText(line)}) Tj\n0 0 Td`);
        y -= block.lineHeight;
      }
      y -= block.spacingAfter;
    }

    if (inBt) cmds.push('ET');
    return cmds.join('\n');
  }

  layout(): readonly string[] {
    const pages = this.paginate();
    return pages.map((page) => this.drawPageContentStream(page));
  }
}

function buildCustomerPdfDraftBlocks(documentModel: CustomerDocumentModelV1): CustomerPdfDraftBlock[] {
  const blocks: CustomerPdfDraftBlock[] = [];

  blocks.push(createTextBlock('section_heading', SECTION_RECOMMENDATION_SUMMARY, { pageBreakPolicy: 'always', spacingAfter: 6 }));
  if (hasText(documentModel.cover.title)) {
    blocks.push(createTextBlock('subheading', documentModel.cover.title, { spacingAfter: 4 }));
  }
  if (hasText(documentModel.cover.summary)) {
    blocks.push(createTextBlock('body', documentModel.cover.summary, { spacingAfter: 6 }));
  }
  if (hasText(documentModel.cover.addressSummary)) {
    blocks.push(createTextBlock('body', documentModel.cover.addressSummary, { spacingAfter: 6 }));
  }
  if (documentModel.cover.customerFacts.length > 0) {
    blocks.push(createTextBlock('subheading', 'Home facts', { spacingAfter: 4 }));
    for (const fact of documentModel.cover.customerFacts) {
      blocks.push(createTextBlock('bullet', `- ${fact}`, { spacingAfter: 2 }));
    }
  }

  if (documentModel.recommendationReasons.length > 0) {
    blocks.push(createTextBlock('section_heading', SECTION_WHY_THIS_FITS, { pageBreakPolicy: 'always', spacingAfter: 6 }));
    for (const reason of documentModel.recommendationReasons) {
      blocks.push(createTextBlock('subheading', reason.homeFact, { spacingAfter: 3 }));
      blocks.push(createTextBlock('body', `Why it matters: ${reason.whyItMatters}`, { spacingAfter: 2 }));
      blocks.push(createTextBlock('body', `Atlas recommendation: ${reason.atlasRecommendationOutcome}`, { spacingAfter: 2 }));
      blocks.push(createTextBlock('body', `What you will notice: ${reason.practicalEffect}`, { spacingAfter: 3 }));
      if (hasText(reason.detail)) {
        blocks.push(createTextBlock('body', reason.detail, { spacingAfter: 4 }));
      }
    }
  }

  if (documentModel.sections.length > 0) {
    blocks.push(createTextBlock('section_heading', SECTION_PRACTICAL_OUTCOMES, { pageBreakPolicy: 'always', spacingAfter: 6 }));
    documentModel.sections.forEach((section, index) => {
      blocks.push(createTextBlock('subheading', `Outcome ${index + 1}`, { spacingAfter: 3 }));
      blocks.push(createTextBlock('body', section.summary, { spacingAfter: 3 }));
      if (hasText(section.keyTakeaway)) {
        blocks.push(createTextBlock('body', `Key takeaway: ${section.keyTakeaway}`, { spacingAfter: 3 }));
      }
      for (const item of section.items) {
        blocks.push(createTextBlock('bullet', `- ${item}`, { spacingAfter: 2 }));
      }
      blocks.push(createGapBlock(6));
    });
  }

  if (documentModel.systemProtection != null) {
    blocks.push(createTextBlock('section_heading', SECTION_PROTECTION_AND_CONDITION, { pageBreakPolicy: 'always', spacingAfter: 6 }));
    blocks.push(createTextBlock('subheading', documentModel.systemProtection.title, { spacingAfter: 3 }));
    blocks.push(createTextBlock('body', documentModel.systemProtection.customerSummary, { spacingAfter: 3 }));
    for (const bullet of documentModel.systemProtection.customerVisibleBullets) {
      blocks.push(createTextBlock('bullet', `- ${bullet}`, { spacingAfter: 2 }));
    }
    if (hasText(documentModel.systemProtection.whatInstallerWillCheck)) {
      blocks.push(createTextBlock('subheading', INSTALLER_CHECK_HEADING, { spacingBefore: 4, spacingAfter: 3 }));
      blocks.push(createTextBlock('body', documentModel.systemProtection.whatInstallerWillCheck, { spacingAfter: 3 }));
    }
  }

  blocks.push(createTextBlock('section_heading', SECTION_NEXT_STEPS, { pageBreakPolicy: 'always', spacingAfter: 6 }));
  for (const step of documentModel.nextSteps) {
    if (hasText(step.label)) {
      blocks.push(createTextBlock('subheading', step.label, { spacingAfter: 2 }));
    }
    if (hasText(step.body)) {
      blocks.push(createTextBlock('body', step.body, { spacingAfter: 3 }));
    }
  }
  if (documentModel.qrDestinations.length > 0) {
    blocks.push(createTextBlock('subheading', DEEP_DIVE_LINKS_HEADING, { spacingBefore: 4, spacingAfter: 3 }));
    for (const destination of documentModel.qrDestinations) {
      if (hasText(destination.heading)) {
        blocks.push(createTextBlock('body', destination.heading, { spacingAfter: 2 }));
      }
      if (hasText(destination.note)) {
        blocks.push(createTextBlock('small', destination.note, { spacingAfter: 3 }));
      }
    }
  }

  return blocks;
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

  const customerDocument = resolveCustomerDocument(envelope);

  const layoutEngine = new CustomerPdfBlockLayoutEngine(buildCustomerPdfDraftBlocks(customerDocument));
  const contentStreams = layoutEngine.layout();
  return assemblePdf(contentStreams, payloadStream);
}

export function extractVisitPackagePdfEnvelope(
  input: string,
): VisitPackagePdfEnvelopeExtractionResult {
  const begin = input.indexOf(VISIT_PACKAGE_PDF_PAYLOAD_BEGIN_MARKER);
  const end = input.indexOf(VISIT_PACKAGE_PDF_PAYLOAD_END_MARKER);
  if (begin < 0 || end < 0 || end <= begin) {
    return { ok: false, errors: [VISIT_PACKAGE_PDF_NO_MARKER_ERROR] };
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
