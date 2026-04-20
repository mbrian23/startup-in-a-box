import type { BoardState } from '../../hooks/ag-ui/types';
import { canvasToPdfHtml, savePdf } from '../../lib/artifact-pdf';
import { LeanCanvasManuscript } from '../LeanCanvasManuscript';
import { ArtifactFrame, Placeholder, readCanvas } from './shared';

export function CanvasView({ board }: { board: BoardState }) {
  const data = readCanvas(board);
  return (
    <ArtifactFrame onSavePdf={data ? () => savePdf('Lean Canvas', canvasToPdfHtml(data)) : undefined}>
      {!data ? <Placeholder label="Lean canvas" tone="#c29b52" /> : <LeanCanvasManuscript canvas={data} />}
    </ArtifactFrame>
  );
}
