import { useId } from 'react';
import { useReadingPreferences } from './useReadingPreferences';
import type { ReadingColorOverlayV1 } from './ReadingPreferencesV1';

const OVERLAY_OPTIONS: { value: ReadingColorOverlayV1; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'warm', label: 'Warm tint' },
  { value: 'cool', label: 'Cool tint' },
  { value: 'rose', label: 'Rose tint' },
];

export function ReadingPreferencesLauncher() {
  const id = useId();
  const {
    enabled,
    panelOpen,
    profile,
    setEnabled,
    setPanelOpen,
    updateProfile,
    resetProfile,
  } = useReadingPreferences();

  return (
    <div className="rp-launcher" data-testid="reading-preferences-launcher">
      <button
        type="button"
        className="rp-launcher__toggle"
        aria-expanded={panelOpen}
        aria-controls={id}
        onClick={() => setPanelOpen(!panelOpen)}
      >
        Reading preferences
      </button>
      {panelOpen ? (
        <section id={id} className="rp-panel" aria-label="Reading preferences">
          <label className="rp-field rp-field--check">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            <span>Focus reading mode</span>
          </label>

          <div className="rp-grid">
            <label className="rp-field">
              <span>Text scale</span>
              <input
                type="range"
                min={0.9}
                max={1.5}
                step={0.05}
                value={profile.fontScale}
                onChange={(event) => updateProfile({ fontScale: Number(event.target.value) })}
              />
            </label>

            <label className="rp-field">
              <span>Line height</span>
              <input
                type="range"
                min={1.3}
                max={2}
                step={0.05}
                value={profile.lineHeight}
                onChange={(event) => updateProfile({ lineHeight: Number(event.target.value) })}
              />
            </label>

            <label className="rp-field">
              <span>Letter spacing</span>
              <input
                type="range"
                min={0}
                max={0.08}
                step={0.005}
                value={profile.letterSpacing}
                onChange={(event) => updateProfile({ letterSpacing: Number(event.target.value) })}
              />
            </label>

            <label className="rp-field">
              <span>Paragraph spacing</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={profile.paragraphSpacing}
                onChange={(event) => updateProfile({ paragraphSpacing: Number(event.target.value) })}
              />
            </label>
          </div>

          <label className="rp-field">
            <span>Color overlay</span>
            <select
              value={profile.colorOverlay}
              onChange={(event) => updateProfile({ colorOverlay: event.target.value as ReadingColorOverlayV1 })}
            >
              {OVERLAY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="rp-field">
            <span>Contrast</span>
            <select
              value={profile.contrastMode}
              onChange={(event) => updateProfile({ contrastMode: event.target.value === 'high' ? 'high' : 'default' })}
            >
              <option value="default">Default</option>
              <option value="high">High contrast</option>
            </select>
          </label>

          <label className="rp-field rp-field--check">
            <input
              type="checkbox"
              checked={profile.readingRulerEnabled}
              onChange={(event) => updateProfile({ readingRulerEnabled: event.target.checked })}
            />
            <span>Reading ruler</span>
          </label>

          {profile.readingRulerEnabled ? (
            <div className="rp-grid">
              <label className="rp-field">
                <span>Ruler opacity</span>
                <input
                  type="range"
                  min={0.08}
                  max={0.5}
                  step={0.02}
                  value={profile.rulerOpacity}
                  onChange={(event) => updateProfile({ rulerOpacity: Number(event.target.value) })}
                />
              </label>
              <label className="rp-field">
                <span>Ruler lines</span>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={1}
                  value={profile.rulerLineCount}
                  onChange={(event) => updateProfile({ rulerLineCount: Number(event.target.value) })}
                />
              </label>
              <button
                type="button"
                className="rp-reset"
                onClick={() => updateProfile({ readingRulerEnabled: false })}
              >
                Hide ruler
              </button>
            </div>
          ) : null}

          <label className="rp-field rp-field--check">
            <input
              type="checkbox"
              checked={profile.wordHighlighting}
              onChange={(event) => updateProfile({ wordHighlighting: event.target.checked })}
            />
            <span>Word highlighting support</span>
          </label>

          <label className="rp-field rp-field--check">
            <input
              type="checkbox"
              checked={profile.reducedMotion}
              onChange={(event) => updateProfile({ reducedMotion: event.target.checked })}
            />
            <span>Reduce motion</span>
          </label>

          <label className="rp-field rp-field--check">
            <input
              type="checkbox"
              checked={profile.textToSpeechEnabled}
              onChange={(event) => updateProfile({ textToSpeechEnabled: event.target.checked })}
            />
            <span>Text-to-speech labels</span>
          </label>

          <button type="button" className="rp-reset" onClick={resetProfile}>
            Reset reading preferences
          </button>
        </section>
      ) : null}
    </div>
  );
}
