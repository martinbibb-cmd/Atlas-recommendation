import type { EducationalContentV1 } from '../EducationalContentV1';
import type { EducationalContentQaV1 } from './EducationalContentQaV1';
import { validateEducationalContent } from './validateEducationalContent';

let latestFindings: EducationalContentQaV1[] = [];

export function runEducationalContentQa(contentRegistry: EducationalContentV1[]): EducationalContentQaV1[] {
  latestFindings = contentRegistry.flatMap((entry) => validateEducationalContent(entry));
  return latestFindings;
}

export function getContentQaErrors(): EducationalContentQaV1[] {
  return latestFindings.filter((finding) => finding.severity === 'error');
}

export function getContentQaWarnings(): EducationalContentQaV1[] {
  return latestFindings.filter((finding) => finding.severity === 'warning');
}
