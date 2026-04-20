'use client';

/**
 * RoleLabel — two-line text label above the sprite: character name on
 * top, role underneath. Styled like the debug overlay (stroked text,
 * no background pill) so the label stays readable without dominating
 * the scene or overflowing into neighbouring characters.
 *
 * Input is the combined "<Name> · <Role>" string used across the rest
 * of the app; this component splits on " · " so the data source
 * (`startup-characters.ts`) stays a single field.
 */

import { useState, useEffect } from 'react';

interface RoleLabelProps {
  label: string;
  isActive?: boolean;
  /** Pixel offset from the sprite center to the TOP of the name line.
   *  More negative = higher above the character. */
  yOffset?: number;
}

export function RoleLabel({ label, isActive = false, yOffset = -30 }: RoleLabelProps) {
  const [name, role] = splitLabel(label);
  const nameColor = isActive ? '#ffe14a' : '#ffffff';
  const roleColor = isActive ? '#ffffff' : '#c7d0de';

  // pixiText caches metrics — if styles change between renders the
  // text object needs a nudge. State kept only for the active flash.
  const [flash, setFlash] = useState(isActive);
  useEffect(() => setFlash(isActive), [isActive]);

  return (
    <pixiContainer>
      <pixiText
        text={name}
        x={0}
        y={yOffset}
        anchor={{ x: 0.5, y: 0 }}
        style={{
          fontSize: 11,
          fill: nameColor,
          stroke: { color: '#000000', width: 3 },
          fontFamily: 'monospace',
          fontWeight: flash ? 'bold' : 'bold',
        }}
      />
      {role && (
        <pixiText
          text={role}
          x={0}
          y={yOffset + 13}
          anchor={{ x: 0.5, y: 0 }}
          style={{
            fontSize: 9,
            fill: roleColor,
            stroke: { color: '#000000', width: 2.5 },
            fontFamily: 'monospace',
          }}
        />
      )}
    </pixiContainer>
  );
}

function splitLabel(label: string): [string, string] {
  const sep = label.indexOf(' · ');
  if (sep === -1) return [label, ''];
  return [label.slice(0, sep), label.slice(sep + 3)];
}
