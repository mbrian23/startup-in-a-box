import type { ReactNode } from 'react';
import type { BoardState } from '../../hooks/ag-ui/types';
import { marketToPdfHtml, savePdf } from '../../lib/artifact-pdf';
import { ArtifactFrame, Label, Placeholder, parseMarkdown, readMarket } from './shared';

const MARKET_TONE = '#6090ee';

export function MarketView({ board }: { board: BoardState }) {
  const data = readMarket(board);
  return (
    <ArtifactFrame onSavePdf={data ? () => savePdf('Market Analysis', marketToPdfHtml(data)) : undefined}>
      {!data ? (
        <Placeholder label="Market analysis" tone={MARKET_TONE} />
      ) : (
        <div className="space-y-5">
          {parseMarkdown(data.analysis).map((block, idx) => {
            if (block.kind === 'heading') {
              return <Label key={idx}>{block.text}</Label>;
            }
            if (block.kind === 'bullets') {
              const color = block.sources ? '#8aa4c8' : '#b8c4dc';
              return (
                <ul key={idx} className="space-y-1.5">
                  {block.items.map((item, itemIdx) => (
                    <li
                      key={itemIdx}
                      className="text-[0.9rem] font-mono leading-relaxed"
                      style={{ color }}
                    >
                      <span style={{ color: MARKET_TONE, marginRight: 8 }}>·</span>
                      {renderInline(item)}
                    </li>
                  ))}
                </ul>
              );
            }
            return (
              <p
                key={idx}
                className="text-[0.95rem] text-[#b8c4dc] leading-relaxed font-mono"
              >
                {renderInline(block.text)}
              </p>
            );
          })}
        </div>
      )}
    </ArtifactFrame>
  );
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="text-[#e6dfc9] font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}
