/**
 * Lean Canvas rendered as an illuminated manuscript.
 *
 * Not a grid card — a piece of parchment with 9 sealed blocks. When the
 * Strategist's /lean_canvas STATE_DELTA lands, the manuscript unrolls
 * into view; each of the 9 blocks drops its wax seal in sequence; a
 * ribbon seals it "READY FOR THE FACTORY."
 *
 * The canonical Ash Maurya layout is a 5-column grid with a 2-column
 * bottom row:
 *
 *   +----------+----------+----------+-------------+--------------+
 *   | Problem  | Solution |          | Unfair Adv  | Customer     |
 *   |          |----------|   UVP    |-------------|  Segments    |
 *   |          | Key Metr |          | Channels    |              |
 *   +----------+----------+----------+-------------+--------------+
 *   |        Cost Structure          |    Revenue Streams         |
 *   +--------------------------------+----------------------------+
 */

import type { LeanCanvas, LeanCanvasBlock } from '../hooks/ag-ui/types';

type BlockKey =
  | 'problem'
  | 'customer_segments'
  | 'unique_value_proposition'
  | 'solution'
  | 'channels'
  | 'revenue_streams'
  | 'cost_structure'
  | 'key_metrics'
  | 'unfair_advantage';

interface BlockDef {
  key: BlockKey;
  label: string;
  area: string;
  delay: number;
}

// Reveal order — the blocks don't land in reading order; they land
// outside-in: Problem first (the why), Customer Segments last (the who),
// UVP dead last so the hero sentence is the punctuation.
const BLOCKS: readonly BlockDef[] = [
  { key: 'problem',                  label: 'Problem',           area: 'problem',  delay: 0.2 },
  { key: 'customer_segments',        label: 'Customer Segments', area: 'segments', delay: 0.4 },
  { key: 'solution',                 label: 'Solution',          area: 'solution', delay: 0.6 },
  { key: 'key_metrics',              label: 'Key Metrics',       area: 'metrics',  delay: 0.8 },
  { key: 'channels',                 label: 'Channels',          area: 'channels', delay: 1.0 },
  { key: 'unfair_advantage',         label: 'Unfair Advantage',  area: 'advantage',delay: 1.2 },
  { key: 'cost_structure',           label: 'Cost Structure',    area: 'cost',     delay: 1.4 },
  { key: 'revenue_streams',          label: 'Revenue Streams',   area: 'revenue',  delay: 1.6 },
  { key: 'unique_value_proposition', label: 'Unique Value Prop', area: 'uvp',      delay: 1.8 },
] as const;

// Parchment palette.
const INK = '#3b2614';
const INK_SOFT = '#5b4828';
const GILD = '#8b6b3f';
const GILD_BRIGHT = '#c29b52';
const PARCHMENT = '#f1e6c8';
const PARCHMENT_DARK = '#e4d3a6';

interface BlockCardProps {
  def: BlockDef;
  block: LeanCanvasBlock | undefined;
  emphasized?: boolean;
}

function BlockCard({ def, block, emphasized = false }: BlockCardProps) {
  return (
    <div
      style={{
        gridArea: def.area,
        position: 'relative',
        padding: emphasized ? '14px 16px' : '10px 12px',
        background: `linear-gradient(180deg, ${PARCHMENT} 0%, ${PARCHMENT_DARK} 100%)`,
        border: `1px solid ${GILD}66`,
        borderRadius: '3px',
        boxShadow: `inset 0 0 22px rgba(120, 90, 40, 0.18), 0 1px 0 ${GILD_BRIGHT}44`,
        animation: `wax-seal-drop 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) ${def.delay}s both`,
        opacity: block ? 1 : 0.35,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Wax-seal corner — tiny illumination dot */}
      <span
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: block ? GILD_BRIGHT : 'transparent',
          boxShadow: block ? `0 0 6px ${GILD_BRIGHT}` : 'none',
        }}
      />
      <div
        style={{
          fontFamily: '"EB Garamond", "Garamond", Georgia, serif',
          fontSize: emphasized ? '0.7rem' : '0.62rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: GILD,
          marginBottom: 4,
          fontWeight: 600,
        }}
      >
        {def.label}
      </div>
      {block ? (
        <>
          <div
            style={{
              fontFamily: '"EB Garamond", "Garamond", Georgia, serif',
              fontSize: emphasized ? '1rem' : '0.82rem',
              lineHeight: 1.3,
              color: INK,
              fontWeight: emphasized ? 600 : 500,
              marginBottom: 6,
              fontStyle: emphasized ? 'italic' : 'normal',
            }}
          >
            {block.headline}
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            {block.bullets.map((bullet, i) => (
              <li
                key={i}
                style={{
                  fontFamily: '"EB Garamond", "Garamond", Georgia, serif',
                  fontSize: '0.7rem',
                  color: INK_SOFT,
                  lineHeight: 1.35,
                  paddingLeft: 10,
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: 2,
                    top: 5,
                    width: 3,
                    height: 3,
                    borderRadius: '50%',
                    background: GILD,
                  }}
                />
                {bullet}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div
          style={{
            fontFamily: 'serif',
            fontSize: '0.7rem',
            color: `${INK_SOFT}88`,
            fontStyle: 'italic',
          }}
        >
          (unsealed)
        </div>
      )}
    </div>
  );
}

interface LeanCanvasManuscriptProps {
  canvas: LeanCanvas;
}

export function LeanCanvasManuscript({ canvas }: LeanCanvasManuscriptProps) {
  return (
    <div
      style={{
        position: 'relative',
        padding: '18px 16px 14px 16px',
        background: `
          radial-gradient(ellipse at top, ${PARCHMENT} 0%, ${PARCHMENT_DARK} 100%)
        `,
        borderRadius: '4px',
        boxShadow: `
          0 0 0 1px ${GILD_BRIGHT}55,
          0 0 0 4px ${GILD}22,
          0 0 30px rgba(139, 107, 63, 0.25),
          inset 0 0 40px rgba(90, 60, 20, 0.15)
        `,
        animation: 'manuscript-unfurl 0.85s cubic-bezier(0.16, 1, 0.3, 1)',
        transformOrigin: 'top center',
      }}
    >
      {/* Gold-leaf top ribbon */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translate(-50%, -50%)',
          padding: '2px 10px',
          background: `linear-gradient(180deg, ${GILD_BRIGHT} 0%, ${GILD} 100%)`,
          borderRadius: '2px',
          fontFamily: '"Cinzel", "EB Garamond", serif',
          fontSize: '0.7rem',
          letterSpacing: '0.22em',
          color: '#2a1a0a',
          textTransform: 'uppercase',
          fontWeight: 700,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
        }}
      >
        Lean Canvas · Sealed
      </div>

      {/* Canonical 5-column Ash Maurya grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1.15fr 1fr 1fr',
          gridTemplateRows: 'auto auto auto',
          gridTemplateAreas: `
            "problem  solution  uvp  advantage  segments"
            "problem  metrics   uvp  channels   segments"
            "cost     cost      cost revenue    revenue"
          `,
          gap: 6,
          marginTop: 8,
        }}
      >
        {BLOCKS.map((def) => (
          <BlockCard
            key={def.key}
            def={def}
            block={canvas[def.key]}
            emphasized={def.key === 'unique_value_proposition'}
          />
        ))}
      </div>

      {/* Bottom ribbon: ready for the factory */}
      <div
        style={{
          marginTop: 10,
          textAlign: 'center',
          fontFamily: '"Cinzel", "EB Garamond", serif',
          fontSize: '0.65rem',
          letterSpacing: '0.3em',
          color: GILD,
          textTransform: 'uppercase',
          fontStyle: 'italic',
          animation: 'wax-seal-drop 0.5s ease-out 2.1s both',
        }}
      >
        ✦ Ready for the Factory ✦
      </div>
    </div>
  );
}
