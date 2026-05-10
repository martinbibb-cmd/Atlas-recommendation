export const atlasEducationalUiDemoContent = {
  title: 'Educational UI primitive showcase',
  intro:
    'Reusable Atlas primitives should explain gently, keep paragraphs short, and stay consistent across portal, print, and QR follow-up surfaces.',
  sections: {
    analogyIntro:
      'Analogies should help a customer form a first mental model, then clearly mark the edge of that analogy before it creates false certainty.',
    misconceptionIntro:
      'Misconception recovery works best when the correction is calm, direct, and paired with a plain-English explanation of what the customer may notice.',
    safetyIntro:
      'Safety copy should be calm and practical. It should say what matters, why it matters, and what to do next without turning routine behaviour into alarm.',
    printIntro:
      'Print-first surfaces need short steps, strong hierarchy, and enough context to work without motion, hover, or extra navigation.',
    trustIntro:
      'Trust recovery is for normal surprises. It should name the wobble, explain it plainly, and leave the customer with one clear next action.',
  },
  analogy: {
    title: 'Stored hot water as a prepared flask',
    analogy:
      'Think of stored hot water like a prepared flask. The warmth is ready before a tap opens, so short bursts can be met without the heat source reacting from cold each second.',
    whereItWorks:
      'It helps explain why short overlapping draws feel steadier when hot water has already been stored.',
    whereItBreaks:
      'It does not mean endless hot water. Recovery time still matters after a longer run or repeated use.',
  },
  misconception: {
    title: 'Lower radiator temperature can still warm a room',
    summary:
      'A gentler radiator temperature does not mean the system has stopped working. It often means the heat is being delivered more steadily over a longer period.',
    misconception:
      'Common misconception: if a radiator is not very hot, the system is underperforming.',
    reality:
      'Reality: comfort depends on total heat delivered over time, not only on the first touch temperature of the radiator surface.',
    notice:
      'Radiators may feel warm rather than very hot during longer heating periods.',
    normalBecause:
      'A steadier flow temperature can reduce sharp room swings while still matching the heat loss of the home.',
  },
  safety: {
    title: 'Pressure relief outlet dripping after warm-up',
    message:
      'A brief discharge during heat-up can happen while the system settles. If dripping continues after the cycle ends, arrange a check rather than ignoring it.',
    whatToDoNext:
      'Note when it happens, avoid blocking any discharge route, and ask your installer to confirm whether the valve and expansion side are behaving as expected.',
    factTitle: 'System response and hot-water delivery',
    fact:
      'On-demand hot water depends on burner output, temperature rise, and incoming flow. A mains-fed supply can still be flow-limited by pipework, fittings, or other simultaneous use.',
    diagramLabel: 'Hot-water delivery diagram',
  },
  print: {
    panelTitle: 'Before your installer visit',
    panelIntro:
      'This print-safe panel keeps the next actions visible on paper and avoids any step that depends on animation or hidden states.',
    cardTitle: 'Simple comfort check',
    steps: [
      'Note the room that feels coolest by late afternoon.',
      'Write down the time when comfort starts to dip.',
      'Keep the schedule steady for one full day before asking for an adjustment.',
    ],
    note:
      'A written note helps the installer compare comfort timing with control settings and heat loss patterns.',
  },
  trust: {
    title: 'A room feels cooler after a control change',
    thisCanHappen:
      'The first evening after a new schedule or weather-compensated setting can feel different from the old routine.',
    whatItMeans:
      'The system may be using a calmer pattern that needs a little time to match the home and the day outside.',
    whatToDoNext:
      'Keep the setting stable for a full day, then ask your installer for a small adjustment if comfort still drops.',
    expectationNotice:
      'Warm-up may start earlier and feel less dramatic than a short high-temperature blast.',
    expectationBecause:
      'A longer gentle run can improve comfort stability without chasing sudden peaks.',
  },
} as const;

export function getAtlasEducationalUiDemoParagraphs(): string[] {
  return [
    atlasEducationalUiDemoContent.intro,
    atlasEducationalUiDemoContent.sections.analogyIntro,
    atlasEducationalUiDemoContent.sections.misconceptionIntro,
    atlasEducationalUiDemoContent.sections.safetyIntro,
    atlasEducationalUiDemoContent.sections.printIntro,
    atlasEducationalUiDemoContent.sections.trustIntro,
    atlasEducationalUiDemoContent.analogy.analogy,
    atlasEducationalUiDemoContent.analogy.whereItWorks,
    atlasEducationalUiDemoContent.analogy.whereItBreaks,
    atlasEducationalUiDemoContent.misconception.summary,
    atlasEducationalUiDemoContent.misconception.misconception,
    atlasEducationalUiDemoContent.misconception.reality,
    atlasEducationalUiDemoContent.misconception.notice,
    atlasEducationalUiDemoContent.misconception.normalBecause,
    atlasEducationalUiDemoContent.safety.message,
    atlasEducationalUiDemoContent.safety.whatToDoNext,
    atlasEducationalUiDemoContent.safety.fact,
    atlasEducationalUiDemoContent.print.panelIntro,
    atlasEducationalUiDemoContent.print.note,
    atlasEducationalUiDemoContent.trust.thisCanHappen,
    atlasEducationalUiDemoContent.trust.whatItMeans,
    atlasEducationalUiDemoContent.trust.whatToDoNext,
    atlasEducationalUiDemoContent.trust.expectationNotice,
    atlasEducationalUiDemoContent.trust.expectationBecause,
  ];
}
