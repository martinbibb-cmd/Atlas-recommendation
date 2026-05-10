import { ConceptDivider, type EducationalMotionMode } from '../ui';
import { HeatPumpRealityJourney } from './HeatPumpRealityJourney';
import { OpenVentedToSealedUnventedJourney } from './OpenVentedToSealedUnventedJourney';
import { RegularToRegularUnventedJourney } from './RegularToRegularUnventedJourney';
import { WaterConstraintJourney } from './WaterConstraintJourney';

export interface GoldenJourneyDemonstratorsProps {
  motionMode?: EducationalMotionMode;
}

export function GoldenJourneyDemonstrators({
  motionMode = 'system',
}: GoldenJourneyDemonstratorsProps) {
  return (
    <section aria-label="Golden journey educational demonstrators">
      <OpenVentedToSealedUnventedJourney motionMode={motionMode} />
      <ConceptDivider label="Next golden journey" />
      <RegularToRegularUnventedJourney motionMode={motionMode} />
      <ConceptDivider label="Next golden journey" />
      <HeatPumpRealityJourney motionMode={motionMode} />
      <ConceptDivider label="Next golden journey" />
      <WaterConstraintJourney motionMode={motionMode} />
    </section>
  );
}
