import type { BoardState } from '../../hooks/ag-ui/types';
import { ArtifactFrame, Label, Placeholder, formatSize, readFiles } from './shared';

export function FilesView({ board }: { board: BoardState }) {
  const files = readFiles(board);
  const entries = Object.entries(files);

  if (entries.length === 0) {
    return (
      <ArtifactFrame>
        <Placeholder label="Generated files" tone="#6090ee" />
      </ArtifactFrame>
    );
  }

  return (
    <ArtifactFrame>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between mb-2">
          <Label>Files</Label>
          <span className="text-[0.8rem] text-[#505868] font-mono">{entries.length}</span>
        </div>
        {entries.map(([path, entry]) => (
          <div
            key={path}
            className="flex items-center gap-2.5 py-1.5 px-2.5 rounded"
            style={{ background: 'rgba(255,255,255,0.025)' }}
          >
            <span
              className="text-[0.72rem] uppercase tracking-wider shrink-0 w-16 text-right font-mono font-semibold"
              style={{ color: entry.status === 'created' ? '#50c878' : '#f0a830' }}
            >
              {entry.status}
            </span>
            <span className="text-[0.9rem] text-[#a8b0c0] truncate font-mono flex-1">{path}</span>
            <span className="text-[0.78rem] text-[#606068] shrink-0 font-mono tabular-nums">
              {formatSize(entry.size)}
            </span>
          </div>
        ))}
      </div>
    </ArtifactFrame>
  );
}
