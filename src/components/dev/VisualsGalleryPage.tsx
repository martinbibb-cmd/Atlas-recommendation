/**
 * VisualsGalleryPage.tsx
 *
 * Developer-only gallery of individual visual elements, organised into sections.
 *
 * Sections:
 *   - Physics Visuals: every entry in physicsVisualRegistry, rendered via
 *     the existing PhysicsVisualGallery component.
 *   - Lego Builder Components: every entry in PALETTE_SECTIONS, shown as
 *     expandable category panels with per-item tiles.
 *
 * Accessible inside the Dev Menu (/dev/devmenu or legacy ?devmenu=1) via the "Visuals Gallery" tab.
 * NOT customer-facing.
 */

import { useState, type CSSProperties } from 'react';
import PhysicsVisualGallery from '../physics-visuals/preview/PhysicsVisualGallery';
import { PALETTE_SECTIONS, PALETTE_ADVANCED, PALETTE_CATEGORY_LABELS } from '../../explainers/lego/builder/palette';

// ─── Section identifiers ───────────────────────────────────────────────────────

type GallerySection = 'physics' | 'lego';

const SECTION_LABELS: Record<GallerySection, string> = {
  physics: '⚡ Physics Visuals',
  lego:    '🧱 Lego Builder Components',
};

// ─── Lego palette section panel ───────────────────────────────────────────────

function LegoPaletteSection({
  label,
  items,
  open,
  onToggle,
}: {
  label: string;
  items: { kind: string; label: string; emoji: string }[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={STYLES.paletteSection}>
      <button style={STYLES.paletteSectionHeader} onClick={onToggle} aria-expanded={open}>
        <span style={STYLES.paletteSectionTitle}>{label}</span>
        <span style={STYLES.paletteSectionCount}>{items.length} items</span>
        <span style={STYLES.paletteSectionChevron}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={STYLES.paletteSectionBody}>
          <div style={STYLES.paletteGrid} role="list">
            {items.map(item => (
              <div key={item.kind} style={STYLES.paletteTile} role="listitem">
                <span style={STYLES.paletteTileEmoji} aria-hidden="true">{item.emoji}</span>
                <span style={STYLES.paletteTileLabel}>{item.label}</span>
                <code style={STYLES.paletteTileKind}>{item.kind}</code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Lego builder components gallery ─────────────────────────────────────────

function LegoBuilderGallery() {
  // Use string keys so the 'advanced' section can be toggled independently
  // from the main 'system_support' palette section.
  const allKeys = [...PALETTE_SECTIONS.map(s => s.category as string), 'advanced'];
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(allKeys),
  );

  function toggleSection(key: string) {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAll() {
    setOpenSections(new Set(allKeys));
  }

  function collapseAll() {
    setOpenSections(new Set());
  }

  return (
    <div style={STYLES.legoGallery}>
      <div style={STYLES.legoHeader}>
        <div>
          <h2 style={STYLES.sectionHeading}>Lego Builder Components</h2>
          <p style={STYLES.sectionSubtitle}>
            All palette items from the Lego Building Set drag-and-drop workbench,
            grouped by category. Advanced tee items are shown at the end.
          </p>
        </div>
        <div style={STYLES.expandCollapseRow}>
          <button className="chip-btn" onClick={expandAll}>Expand all</button>
          <button className="chip-btn" onClick={collapseAll}>Collapse all</button>
        </div>
      </div>

      {PALETTE_SECTIONS.map(section => (
        <LegoPaletteSection
          key={section.category}
          label={PALETTE_CATEGORY_LABELS[section.category]}
          items={section.items}
          open={openSections.has(section.category)}
          onToggle={() => toggleSection(section.category)}
        />
      ))}

      {/* Advanced / auto-inserted tee nodes */}
      <LegoPaletteSection
        key="advanced"
        label="Advanced — Tee nodes (auto-inserted)"
        items={PALETTE_ADVANCED}
        open={openSections.has('advanced')}
        onToggle={() => toggleSection('advanced')}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function VisualsGalleryPage({ onBack }: Props) {
  const [activeSection, setActiveSection] = useState<GallerySection>('physics');

  return (
    <div style={STYLES.page}>
      <header style={STYLES.header}>
        <button className="back-btn" onClick={onBack} style={{ marginBottom: '1rem' }}>
          ← UI Inventory
        </button>
        <div style={STYLES.titleRow}>
          <h1 style={STYLES.title}>🎨 Visuals Gallery</h1>
          <span style={STYLES.devBadge}>DEV ONLY</span>
        </div>
        <p style={STYLES.subtitle}>
          Browse individual visual elements grouped by type. Use the tabs below
          to switch between the Physics Visual Library and Lego Builder Components.
        </p>
      </header>

      {/* Section tabs */}
      <div style={STYLES.tabRow}>
        {(Object.keys(SECTION_LABELS) as GallerySection[]).map(section => (
          <button
            key={section}
            className={`chip-btn${activeSection === section ? ' chip-btn--active' : ''}`}
            onClick={() => setActiveSection(section)}
          >
            {SECTION_LABELS[section]}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div style={STYLES.content}>
        {activeSection === 'physics' && <PhysicsVisualGallery />}
        {activeSection === 'lego' && <LegoBuilderGallery />}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES: Record<string, CSSProperties> = {
  page: {
    background: '#f8fafc',
    minHeight: '100vh',
    padding: '1.5rem',
    paddingBottom: '2rem',
    fontFamily: 'inherit',
  },
  header: {
    marginBottom: '1.5rem',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#1e293b',
  },
  devBadge: {
    display: 'inline-block',
    background: '#7c3aed',
    color: '#fff',
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  },
  subtitle: {
    marginTop: '0.5rem',
    marginBottom: 0,
    fontSize: '0.875rem',
    color: '#64748b',
    lineHeight: 1.5,
  },
  tabRow: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
  },
  content: {
    // let child components use their own layout
  },

  // Lego gallery
  legoGallery: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  legoHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    flexWrap: 'wrap',
    marginBottom: '0.5rem',
  },
  sectionHeading: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#1e293b',
  },
  sectionSubtitle: {
    marginTop: '0.25rem',
    marginBottom: 0,
    fontSize: '0.82rem',
    color: '#64748b',
  },
  expandCollapseRow: {
    display: 'flex',
    gap: '0.5rem',
    flexShrink: 0,
    paddingTop: '0.125rem',
  },

  // Palette section
  paletteSection: {
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    background: '#fff',
  },
  paletteSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  paletteSectionTitle: {
    flex: 1,
    fontSize: '0.925rem',
    fontWeight: 700,
    color: '#1e293b',
  },
  paletteSectionCount: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    fontWeight: 500,
  },
  paletteSectionChevron: {
    fontSize: '0.7rem',
    color: '#94a3b8',
  },
  paletteSectionBody: {
    borderTop: '1px solid #f1f5f9',
    padding: '1rem',
  },
  paletteGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '0.75rem',
  },
  paletteTile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.75rem',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    textAlign: 'center',
  },
  paletteTileEmoji: {
    fontSize: '1.75rem',
    lineHeight: 1,
  },
  paletteTileLabel: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#1e293b',
  },
  paletteTileKind: {
    fontSize: '0.68rem',
    fontFamily: 'monospace',
    background: '#f1f5f9',
    padding: '0.1rem 0.35rem',
    borderRadius: '3px',
    border: '1px solid #e2e8f0',
    color: '#475569',
    wordBreak: 'break-all',
  },
};
