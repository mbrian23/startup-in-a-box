'use client';

import { AgentVisualizer } from '@/components/agent-visualizer';
import { useAgentFlowBridge } from '@/lib/agent-flow-bridge';

export function FactoryVisualizer() {
  useAgentFlowBridge();

  return (
    <div
      className="dark"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
    >
      <AgentVisualizer />
    </div>
  );
}
