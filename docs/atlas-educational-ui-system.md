# Atlas Educational UI System

## Purpose

The Atlas Educational UI System defines reusable primitives for calm, accessible explanation surfaces across print, portal, and QR follow-up experiences. These primitives render educational meaning only. They do not contain recommendation logic, scenario ranking, or routing decisions.

## Educational tone

- Keep the tone calm, plain, and technically honest.
- Prefer short explanations that reduce surprise before adding more detail.
- Name limits clearly. Do not use drama, urgency, or sales language to create confidence.
- Write for reassurance through clarity, not reassurance through hype.

## Cognitive-load limits

- Lead with one idea per card.
- Keep paragraphs to three sentences or fewer.
- Keep paragraphs short enough to scan quickly in print and on small screens.
- Use optional analogy, expectation-setting, and trust-recovery blocks only when they improve understanding.
- Break complex ideas into separate cards instead of stacking many claims in one surface.

## Typography rules

- Default to a dyslexia-friendly sans-serif stack with strong letter shapes.
- Keep a clear heading ladder: surface title, section title, then card title.
- Use generous line height and a readable measure.
- Avoid dense walls of copy and long all-caps text.
- Keep printable steps and expectation text large enough to read without zoom.

## Print and digital parity

- Print and digital surfaces must carry the same core meaning.
- Motion, hover, and sticky behaviour may support digital understanding, but they must not be required to understand the message.
- Print-safe panels must keep step order, labels, and safety meaning without relying on animation or layered disclosure.
- QR follow-up can add depth, but print must still stand on its own for the primary explanation.

## Analogy rules

- Use analogies only to introduce a concept, not to replace the technical truth.
- Always state where the analogy works and where it breaks.
- Keep analogy language concrete and brief.
- Avoid analogies that imply endless capacity, instant behaviour, or certainty where recovery time still matters.

## Motion philosophy

- Motion should be calm, subtle, and optional.
- Reduced motion is the default design assumption.
- Every animated enhancement must have a no-motion equivalent that preserves the same meaning.
- A surface-level animation disable must exist for any educational UI showcase or future customer-facing implementation.

## “What you may notice” philosophy

- Use “What you may notice” to normalise expected behaviour before it is misread as a fault.
- Pair each observation with a short “This is normal because…” explanation.
- Keep this pattern observational rather than corrective.
- Use trust-recovery cards when the experience needs a clearer “what it means” and “what to do next” sequence.

## Accessibility and contrast

- Do not rely on colour alone to communicate meaning.
- Pair status colour with explicit labels such as “Safety note” or “Common misconception”.
- Use semantic headings, labelled regions, and ordered steps where the structure matters.
- Maintain high contrast by default and provide low-ink print variants that keep borders and labels visible.
