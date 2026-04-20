/**
 * Dev-only read/write endpoint for the canonical boardroom stations.
 *
 * The TileDebugOverlay lets the author drag characters and rotate
 * them at runtime; pressing "Commit" in the OverridesPanel POSTs the
 * current overrides to this route which merges them into
 * `frontend/src/data/boardroom-stations.json`. Next.js picks up the
 * file change and hot-reloads — the new positions become canonical
 * without restarting the dev server.
 *
 * Disabled outside development so nothing in production can mutate
 * source files from a request.
 */

import { NextRequest } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Orientation = 'up' | 'down' | 'left' | 'right';

interface StationRecord {
  x: number;
  y: number;
  orientation?: Orientation;
}

interface StationsFile {
  stations: Record<string, StationRecord>;
  blockedOverrides?: string[];
}

interface CommitBody {
  positions?: Record<string, { x: number; y: number }>;
  rotations?: Record<string, Orientation>;
  /** Runtime XOR diff against the committed overrides — each key
   *  flips the persisted walkability state for that tile. */
  blockedToggle?: string[];
}

const FILE_PATH = path.join(process.cwd(), 'src/data/boardroom-stations.json');

async function readStations(): Promise<StationsFile> {
  const raw = await fs.readFile(FILE_PATH, 'utf-8');
  return JSON.parse(raw);
}

async function writeStations(data: StationsFile): Promise<void> {
  await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export async function GET() {
  const data = await readStations();
  return Response.json(data);
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'disabled in production' }, { status: 403 });
  }

  let body: CommitBody;
  try {
    body = (await req.json()) as CommitBody;
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const data = await readStations();
  let changed = 0;

  for (const [id, pos] of Object.entries(body.positions ?? {})) {
    if (typeof pos?.x !== 'number' || typeof pos?.y !== 'number') {
      return Response.json({ error: `invalid position for ${id}` }, { status: 400 });
    }
    const current = data.stations[id] ?? { x: 0, y: 0 };
    data.stations[id] = { ...current, x: pos.x, y: pos.y };
    changed++;
  }

  for (const [id, orientation] of Object.entries(body.rotations ?? {})) {
    if (!['up', 'down', 'left', 'right'].includes(orientation)) {
      return Response.json({ error: `invalid orientation for ${id}` }, { status: 400 });
    }
    const current = data.stations[id] ?? { x: 0, y: 0 };
    data.stations[id] = { ...current, orientation };
    changed++;
  }

  if (body.blockedToggle && body.blockedToggle.length > 0) {
    const current = new Set(data.blockedOverrides ?? []);
    for (const key of body.blockedToggle) {
      if (typeof key !== 'string' || !/^\d+,\d+$/.test(key)) {
        return Response.json({ error: `invalid tile key: ${key}` }, { status: 400 });
      }
      if (current.has(key)) current.delete(key);
      else current.add(key);
      changed++;
    }
    data.blockedOverrides = Array.from(current).sort();
  }

  await writeStations(data);
  return Response.json({ ok: true, changed });
}
