interface Props {
  mixergyLitres: number;
  conventionalLitres: number;
}

export default function FootprintXRay({ mixergyLitres, conventionalLitres }: Props) {
  // Visual height proportional to volume
  const maxH = 200;
  const convH = maxH;
  const mixH = Math.round((mixergyLitres / conventionalLitres) * maxH);

  // Width proportional to height (assuming cylindrical tanks)
  const convW = 80;
  const mixW = Math.round(convW * Math.sqrt(mixergyLitres / conventionalLitres));

  return (
    <div className="footprint-xray">
      <div className="tank-visual">
        <div
          className="tank-rect conventional"
          style={{ width: convW, height: convH }}
        >
          <div
            className="tank-fill conventional"
            style={{ height: '70%' }}
          />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#718096',
          }}>
            {conventionalLitres}L
          </div>
        </div>
        <div className="tank-label">Conventional</div>
        <div className="tank-sublabel">{convW}cm wide</div>
      </div>

      <div className="vs-text">VS</div>

      <div className="tank-visual">
        <div
          className="tank-rect mixergy"
          style={{ width: mixW, height: mixH }}
        >
          <div
            className="tank-fill mixergy"
            style={{ height: '95%' }}
          />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'white',
          }}>
            {mixergyLitres}L
          </div>
        </div>
        <div className="tank-label" style={{ color: '#3182ce' }}>Mixergy</div>
        <div className="tank-sublabel">{mixW}cm wide</div>
      </div>

      <div style={{ paddingBottom: '1rem', maxWidth: '200px' }}>
        <div style={{
          background: '#f0fff4',
          border: '2px solid #68d391',
          borderRadius: 8,
          padding: '0.75rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#276749' }}>
            {Math.round(((conventionalLitres - mixergyLitres) / conventionalLitres) * 100)}%
          </div>
          <div style={{ fontSize: '0.8rem', color: '#276749' }}>smaller footprint</div>
          <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.25rem' }}>
            Same usable hot water
          </div>
        </div>
      </div>
    </div>
  );
}
