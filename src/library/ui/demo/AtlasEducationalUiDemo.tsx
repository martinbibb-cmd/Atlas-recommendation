import '../educationalUi.css';
import { AnalogyCard } from '../AnalogyCard';
import { EducationalCard } from '../EducationalCard';
import { PrintActionCard } from '../PrintActionCard';
import { SafetyNoticeCard } from '../SafetyNoticeCard';
import { SystemFactCard } from '../SystemFactCard';
import { TrustRecoveryCard } from '../TrustRecoveryCard';
import { WhatToExpectCard } from '../WhatToExpectCard';
import {
  CalmSection,
  ConceptDivider,
  PrintSafePanel,
  StickyKeyPoint,
  TwoColumnExplainLayout,
} from '../layout';
import type { EducationalMotionMode } from '../tokens';
import { atlasEducationalUiDemoContent } from './atlasEducationalUiDemoContent';

export interface AtlasEducationalUiDemoProps {
  motionMode?: EducationalMotionMode;
}

function getMotionAttribute(motionMode: EducationalMotionMode) {
  if (motionMode === 'system') {
    return undefined;
  }

  return motionMode;
}

export function AtlasEducationalUiDemo({
  motionMode = 'system',
}: AtlasEducationalUiDemoProps) {
  const motionAttribute = getMotionAttribute(motionMode);

  return (
    <section
      className="atlas-edu-ui atlas-edu-demo"
      aria-labelledby="atlas-edu-demo-title"
      data-motion={motionAttribute}
    >
      <h2 id="atlas-edu-demo-title" className="atlas-edu-demo__heading">
        {atlasEducationalUiDemoContent.title}
      </h2>
      <p className="atlas-edu-demo__intro">{atlasEducationalUiDemoContent.intro}</p>

      <CalmSection
        title="Analogy examples"
        intro={atlasEducationalUiDemoContent.sections.analogyIntro}
        headingLevel={3}
      >
        <TwoColumnExplainLayout
          leading={(
            <AnalogyCard
              title={atlasEducationalUiDemoContent.analogy.title}
              analogy={atlasEducationalUiDemoContent.analogy.analogy}
              whereItWorks={atlasEducationalUiDemoContent.analogy.whereItWorks}
              whereItBreaks={atlasEducationalUiDemoContent.analogy.whereItBreaks}
              ariaLabel="Analogy example card"
              headingLevel={4}
            />
          )}
          trailing={(
            <StickyKeyPoint
              label="Analogy rule"
              text="Always show where the analogy stops so the customer keeps the right mental model."
              ariaLabel="Analogy rule key point"
            />
          )}
        />
      </CalmSection>

      <ConceptDivider label="Misconceptions and expectations" />

      <CalmSection
        title="Misconception examples"
        intro={atlasEducationalUiDemoContent.sections.misconceptionIntro}
        headingLevel={3}
      >
        <TwoColumnExplainLayout
          leading={(
            <EducationalCard
              title={atlasEducationalUiDemoContent.misconception.title}
              summary={atlasEducationalUiDemoContent.misconception.summary}
              ariaLabel="Misconception example card"
              eyebrow="System fact"
              headingLevel={4}
              misconceptionWarning={{
                misconception: atlasEducationalUiDemoContent.misconception.misconception,
                reality: atlasEducationalUiDemoContent.misconception.reality,
              }}
              whatYouMayNotice={{
                notice: atlasEducationalUiDemoContent.misconception.notice,
                normalBecause: atlasEducationalUiDemoContent.misconception.normalBecause,
              }}
            />
          )}
          trailing={(
            <WhatToExpectCard
              title="What a calmer heat-up can feel like"
              notice={atlasEducationalUiDemoContent.trust.expectationNotice}
              normalBecause={atlasEducationalUiDemoContent.trust.expectationBecause}
              ariaLabel="Expectation example card"
              headingLevel={4}
            />
          )}
        />
      </CalmSection>

      <ConceptDivider label="Safety and print" />

      <CalmSection
        title="Safety examples"
        intro={atlasEducationalUiDemoContent.sections.safetyIntro}
        headingLevel={3}
      >
        <TwoColumnExplainLayout
          leading={(
            <SafetyNoticeCard
              title={atlasEducationalUiDemoContent.safety.title}
              message={atlasEducationalUiDemoContent.safety.message}
              whatToDoNext={atlasEducationalUiDemoContent.safety.whatToDoNext}
              ariaLabel="Safety example card"
              headingLevel={4}
            />
          )}
          trailing={(
            <SystemFactCard
              title={atlasEducationalUiDemoContent.safety.factTitle}
              fact={atlasEducationalUiDemoContent.safety.fact}
              ariaLabel="System fact example card"
              diagramLabel={atlasEducationalUiDemoContent.safety.diagramLabel}
              headingLevel={4}
              diagram={(
                <div className="atlas-edu-diagram__frame">
                  Demand → heat source → flow-limited outlet
                </div>
              )}
            />
          )}
        />
      </CalmSection>

      <CalmSection
        title="Print examples"
        intro={atlasEducationalUiDemoContent.sections.printIntro}
        headingLevel={3}
      >
        <PrintSafePanel
          title={atlasEducationalUiDemoContent.print.panelTitle}
          intro={atlasEducationalUiDemoContent.print.panelIntro}
          ariaLabel="Print-safe example panel"
          headingLevel={4}
        >
          <PrintActionCard
            title={atlasEducationalUiDemoContent.print.cardTitle}
            steps={atlasEducationalUiDemoContent.print.steps}
            note={atlasEducationalUiDemoContent.print.note}
            ariaLabel="Print action example card"
            headingLevel={5}
          />
        </PrintSafePanel>
      </CalmSection>

      <ConceptDivider label="Trust recovery" />

      <CalmSection
        title="Trust-recovery examples"
        intro={atlasEducationalUiDemoContent.sections.trustIntro}
        headingLevel={3}
      >
        <TwoColumnExplainLayout
          leading={(
            <TrustRecoveryCard
              title={atlasEducationalUiDemoContent.trust.title}
              thisCanHappen={atlasEducationalUiDemoContent.trust.thisCanHappen}
              whatItMeans={atlasEducationalUiDemoContent.trust.whatItMeans}
              whatToDoNext={atlasEducationalUiDemoContent.trust.whatToDoNext}
              ariaLabel="Trust recovery example card"
              headingLevel={4}
            />
          )}
          trailing={(
            <StickyKeyPoint
              label="Trust rule"
              text="Name a normal wobble early, then pair it with one action that helps the customer stay oriented."
              ariaLabel="Trust recovery key point"
            />
          )}
        />
      </CalmSection>
    </section>
  );
}
