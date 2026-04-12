/**
 * PortalWhatToExpectSection.tsx
 *
 * Section D — "What to expect."
 *
 * Honesty builds trust. Shows practical trade-offs, installation implications,
 * and day-to-day consequences of the recommended system.
 */

interface Props {
  whatToExpect: string[];
}

export default function PortalWhatToExpectSection({ whatToExpect }: Props) {
  if (whatToExpect.length === 0) return null;

  return (
    <section
      className="portal-section portal-journey-what-to-expect"
      aria-labelledby="portal-what-to-expect-heading"
      data-testid="portal-what-to-expect-section"
    >
      <h2 className="portal-section__heading" id="portal-what-to-expect-heading">
        What to expect
      </h2>

      <ul className="portal-what-to-expect__list" data-testid="portal-what-to-expect-list">
        {whatToExpect.map((item) => (
          <li key={item} className="portal-what-to-expect__item">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
