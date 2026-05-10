import type { EducationalContentV1 } from '../EducationalContentV1';
import type { EducationalContentQaV1 } from './EducationalContentQaV1';
import { validateEducationalContent } from './validateEducationalContent';

export function runEducationalContentQa(contentRegistry: EducationalContentV1[]): EducationalContentQaV1[] {
  return contentRegistry.flatMap((entry) => validateEducationalContent(entry));
}

export function getContentQaErrors(findings: EducationalContentQaV1[] = []): EducationalContentQaV1[] {
  return findings.filter((finding) => finding.severity === 'error');
}

export function getContentQaWarnings(findings: EducationalContentQaV1[] = []): EducationalContentQaV1[] {
  return findings.filter((finding) => finding.severity === 'warning');
}
