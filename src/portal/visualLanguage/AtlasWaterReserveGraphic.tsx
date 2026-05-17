interface AtlasWaterReserveGraphicProps {
  usableReservePct: number;
  rechargePct: number;
  recoveryLabel: string;
  modeLabel: string;
  eventCards: Array<{ label: string; copy: string }>;
  annotations?: string[];
}

const MAX_VISIBLE_RECHARGE_TOP_PCT = 90 + 2;

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function AtlasWaterReserveGraphic({
  usableReservePct,
  rechargePct,
  recoveryLabel,
  modeLabel,
  eventCards,
  annotations = [],
}: AtlasWaterReserveGraphicProps) {
  const usable = clampPct(usableReservePct);
  const recharge = clampPct(rechargePct);
  const coolPct = Math.max(8, 100 - usable);
  const rechargeTop = Math.max(16, 100 - Math.min(usable + recharge, MAX_VISIBLE_RECHARGE_TOP_PCT));

  return (
    <div className="atlas-water-reserve-graphic" aria-label="Hot-water reserve graphic">
      <div className="atlas-water-reserve-graphic__scene">
        <div className="atlas-water-reserve-graphic__tank-wrap">
          <div className="atlas-water-reserve-graphic__tank">
            <span className="atlas-water-reserve-graphic__mode">{modeLabel}</span>
            <div className="atlas-water-reserve-graphic__usable" style={{ height: `${Math.max(usable, 14)}%` }} />
            <div
              className="atlas-water-reserve-graphic__recharge"
              style={{
                top: `${rechargeTop}%`,
                height: `${Math.max(recharge, 10)}%`,
              }}
            />
            <div className="atlas-water-reserve-graphic__cool" style={{ height: `${coolPct}%` }} />
            <div className="atlas-water-reserve-graphic__reserve-line" style={{ top: `${100 - usable}%` }} />
            <span className="atlas-water-reserve-graphic__reserve-label" style={{ top: `${Math.max(12, 100 - usable - 8)}%` }}>
              Usable reserve {usable}%
            </span>
            <span className="atlas-water-reserve-graphic__recharge-label" style={{ top: `${Math.min(86, rechargeTop + 4)}%` }}>
              {recoveryLabel}
            </span>
          </div>
        </div>
        <div className="atlas-water-reserve-graphic__events">
          {eventCards.map((event) => (
            <article key={event.label} className="atlas-water-reserve-graphic__event-card">
              <p className="atlas-water-reserve-graphic__event">{event.label}</p>
              <p className="atlas-water-reserve-graphic__copy">{event.copy}</p>
            </article>
          ))}
        </div>
      </div>
      {annotations.length > 0 ? (
        <div className="atlas-water-reserve-graphic__annotations">
          {annotations.map((annotation) => (
            <span key={annotation} className="atlas-water-reserve-graphic__annotation">
              {annotation}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
