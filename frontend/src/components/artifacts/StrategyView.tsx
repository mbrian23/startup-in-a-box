import type { BoardState } from '../../hooks/ag-ui/types';
import { savePdf, strategyToPdfHtml } from '../../lib/artifact-pdf';
import { ArtifactFrame, Label, Placeholder, TagList, readStrategy } from './shared';

export function StrategyView({ board }: { board: BoardState }) {
  const data = readStrategy(board);
  return (
    <ArtifactFrame onSavePdf={data ? () => savePdf('Strategy Board', strategyToPdfHtml(data)) : undefined}>
      {!data ? (
        <Placeholder label="Strategy board" tone="#daa850" />
      ) : (
        <div className="space-y-7">
          <div>
            <Label>Value Proposition</Label>
            <p className="text-[1.05rem] text-[#e6dfc9] leading-relaxed font-mono">
              {data.value_proposition.headline}
            </p>
            <p className="text-[0.9rem] text-[#a89e88] mt-2 font-mono leading-relaxed">
              {data.value_proposition.differentiator}
            </p>
            {data.value_proposition.metric && (
              <p className="text-[0.85rem] text-[#daa850] mt-2.5 font-mono">
                ↗ {data.value_proposition.metric}
              </p>
            )}
          </div>

          <div>
            <Label>Target · {data.target_audience.primary}</Label>
            <TagList items={data.target_audience.segments} color="#daa850" />
            {data.target_audience.pain_points.length > 0 && (
              <ul className="mt-2.5 space-y-1">
                {data.target_audience.pain_points.map((p) => (
                  <li key={p} className="text-[0.9rem] text-[#b8ae98] font-mono leading-relaxed">
                    · {p}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <Label>Must-Have</Label>
            <TagList items={data.feature_list.must_have} color="#50c878" />
          </div>

          {data.feature_list.should_have.length > 0 && (
            <div>
              <Label>Should-Have</Label>
              <TagList items={data.feature_list.should_have} color="#8a9a7a" />
            </div>
          )}

          {data.feature_list.out_of_scope.length > 0 && (
            <div>
              <Label>Out of Scope</Label>
              <TagList items={data.feature_list.out_of_scope} color="#e85050" />
            </div>
          )}
        </div>
      )}
    </ArtifactFrame>
  );
}
