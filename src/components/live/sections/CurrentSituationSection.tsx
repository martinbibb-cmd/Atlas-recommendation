/**
 * CurrentSituationSection — eligibility, options summary, red flags,
 * and the primary recommendation banner.
 *
 * Extracted from LiveSectionPage so it can be composed inside
 * LiveSectionShell independently of the section routing layer.
 *
 * Delegates presentation to RecommendationHub which implements the
 * PR1 recommendation narrative: structured report format with professional
 * recommendation states instead of pass/fail diagnostic labels.
 */
import type { FullEngineResult } from '../../../engine/schema/EngineInputV2_3';
import RecommendationHub from '../../results/RecommendationHub';

interface Props {
  result: FullEngineResult;
}

export default function CurrentSituationSection({ result }: Props) {
  return <RecommendationHub result={result} />;
}
