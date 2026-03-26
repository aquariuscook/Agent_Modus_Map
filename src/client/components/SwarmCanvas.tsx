import React, { useMemo, useCallback, useRef, type DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type Connection,
  BackgroundVariant,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AgentNode, type AgentNodeData } from './AgentNode.js';
import { ConnectionTypeModal } from './ConnectionTypeModal.js';
import type { Swarm, Agent, BlastRadiusResult, RelationshipType } from '../../shared/types/index.js';

const nodeTypes = { agent: AgentNode };

import { getAgentEmoji } from '../utils/agent-emojis.js';

const edgeStyles: Record<string, { stroke: string; strokeDasharray?: string; strokeWidth: number }> = {
  dependsOn: { stroke: 'var(--accent-primary)', strokeWidth: 2 },
  feedsInto: { stroke: 'var(--accent-secondary)', strokeDasharray: '8,4', strokeWidth: 2 },
  collaboratesWith: { stroke: '#fbbf24', strokeDasharray: '3,3', strokeWidth: 1.5 },
  canOverride: { stroke: '#ef4444', strokeWidth: 3 },
};

interface SwarmCanvasProps {
  swarm: Swarm;
  selectedAgent: Agent | null;
  onSelectAgent: (agent: Agent | null) => void;
  blastRadius: BlastRadiusResult[];
  showBlastRadius: boolean;
  onNodeDragStop?: (agentId: string, position: { x: number; y: number }) => void;
  onConnect?: (sourceId: string, targetId: string, type: RelationshipType) => void;
  onDropAgent?: (position: { x: number; y: number }, template: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  agentHealthMap?: Record<string, 'healthy' | 'degraded' | 'unhealthy' | 'unknown'>;
  onOpenAgentDetail?: (agent: Agent) => void;
}

function getLayerColor(layerId: string, layers: Swarm['layers']): string {
  const layer = layers.find(l => l.id === layerId);
  return layer?.colorTheme || 'var(--text-secondary)';
}

const REL_LEGEND = [
  { label: 'Needs (depends on)', color: 'var(--accent-primary)', dash: '' },
  { label: 'Sends data to', color: 'var(--accent-secondary)', dash: '8,4' },
  { label: 'Works with', color: '#fbbf24', dash: '3,3' },
  { label: 'Can overrule', color: '#ef4444', dash: '' },
];

function LegendPanel({ layers }: { layers: Swarm['layers'] }) {
  const [open, setOpen] = React.useState(true);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    if (!open || !containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width || 140;
      setScale(Math.max(1, w / 140));
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [open]);

  const fs = Math.round(11 * scale);
  const hfs = Math.round(10 * scale);
  const gap = Math.round(8 * scale);
  const mb = Math.round(4 * scale);
  const sw = Math.round(28 * scale);
  const dotSize = Math.round(10 * scale);

  return (
    <div ref={containerRef} style={{
      position: 'absolute', bottom: 60, left: 12, zIndex: 5,
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
      borderRadius: 10, color: 'var(--text-secondary)',
      ...(open ? { padding: `${Math.round(10 * scale)}px ${Math.round(14 * scale)}px`, minWidth: 140, maxWidth: 600, overflow: 'auto', resize: 'both' } : { padding: '6px 12px', fontSize: 11 }),
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ fontWeight: 700, fontSize: open ? hfs : 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <span>Legend</span>
        <span style={{ fontSize: open ? Math.round(9 * scale) : 9 }}>{open ? '\u25BC' : '\u25B6'}</span>
      </div>
      {open && <>
        <div style={{ marginTop: mb * 2 }}>
          {REL_LEGEND.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap, marginBottom: mb, fontSize: fs }}>
              <svg width={sw} height={Math.round(8 * scale)}>
                <line x1={0} y1={Math.round(4 * scale)} x2={sw} y2={Math.round(4 * scale)}
                  stroke={item.color} strokeWidth={item.label === 'Can Override' ? 3 * scale : 2 * scale}
                  strokeDasharray={item.dash || undefined} />
              </svg>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        {layers.length > 0 && <>
          <div style={{ fontWeight: 700, fontSize: hfs, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginTop: gap, marginBottom: mb * 2 }}>Layers</div>
          {[...layers].sort((a, b) => a.order - b.order).map(layer => (
            <div key={layer.id} style={{ display: 'flex', alignItems: 'center', gap, marginBottom: mb, fontSize: fs }}>
              <div style={{ width: dotSize, height: dotSize, borderRadius: 3, background: layer.colorTheme, flexShrink: 0 }} />
              <span>{layer.name}</span>
            </div>
          ))}
        </>}
      </>}
    </div>
  );
}

const CONNECT_HINT_KEY = 'agent-modus-connect-hint-dismissed';

function ConnectHint({ agentCount, relationshipCount }: { agentCount: number; relationshipCount: number }) {
  const [dismissed, setDismissed] = React.useState(() => localStorage.getItem(CONNECT_HINT_KEY) === 'true');

  if (dismissed || agentCount < 2 || relationshipCount > 0) return null;

  return (
    <div style={{
      position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 16px', borderRadius: 'var(--radius-md)',
      background: 'var(--bg-surface)', border: '1px solid var(--border-accent)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
      fontFamily: 'var(--font-primary)',
    }}>
      <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Tip:</span>
      <span>Drag from one agent's dot to another to connect them</span>
      <button
        onClick={() => { setDismissed(true); localStorage.setItem(CONNECT_HINT_KEY, 'true'); }}
        style={{
          background: 'none', border: 'none', color: 'var(--text-tertiary)',
          cursor: 'pointer', fontSize: 14, padding: '0 2px', fontFamily: 'var(--font-primary)',
        }}
      >X</button>
    </div>
  );
}

export function SwarmCanvas({
  swarm, selectedAgent, onSelectAgent, blastRadius, showBlastRadius,
  onNodeDragStop, onConnect, onDropAgent, onDeleteEdge, agentHealthMap, onOpenAgentDetail,
}: SwarmCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [pendingConnection, setPendingConnection] = React.useState<{ source: string; target: string } | null>(null);

  const blastNicknames = useMemo(() => {
    const map = new Map<string, number>();
    blastRadius.forEach(b => map.set(b.nickname, b.hops));
    return map;
  }, [blastRadius]);

  const nodes = useMemo(() => {
    return swarm.agents.map((agent) => {
      const isSelected = selectedAgent?.id === agent.id;
      const blastHops = blastNicknames.get(agent.nickname) ?? null;
      const isInBlastRadius = showBlastRadius && selectedAgent && blastHops !== null;

      const data: AgentNodeData = {
        nickname: agent.nickname,
        formalName: agent.formalName,
        descriptor: agent.descriptor,
        badges: agent.badges,
        layerColor: getLayerColor(agent.layerId, swarm.layers),
        isSelected,
        isInBlastRadius: !!isInBlastRadius,
        blastRadiusHops: isInBlastRadius ? blastHops : null,
        emoji: getAgentEmoji(agent.nickname, agent.formalName, (agent.config as any)?.emoji),
        healthStatus: agentHealthMap?.[agent.id] || undefined,
        onInfoClick: () => onOpenAgentDetail?.(agent),
      };

      return {
        id: agent.id,
        type: 'agent',
        position: { x: agent.position.x, y: agent.position.y },
        data: data as unknown as Record<string, unknown>,
        selected: isSelected,
      } satisfies Node;
    });
  }, [swarm, selectedAgent, blastNicknames, showBlastRadius]);

  const edges = useMemo(() => {
    const connectedRelIds = new Set<string>();
    if (selectedAgent) {
      swarm.relationships.forEach(r => {
        if (r.sourceAgentId === selectedAgent.id || r.targetAgentId === selectedAgent.id) {
          connectedRelIds.add(r.id);
        }
      });
    }

    return swarm.relationships.map((rel) => {
      const style = edgeStyles[rel.type] || edgeStyles.dependsOn;
      const isConnected = connectedRelIds.has(rel.id);
      const dimmed = selectedAgent && !isConnected;

      return {
        id: rel.id,
        source: rel.sourceAgentId,
        target: rel.targetAgentId,
        type: 'default',
        animated: rel.type === 'canOverride',
        style: {
          stroke: style.stroke,
          strokeWidth: isConnected ? style.strokeWidth + 1 : style.strokeWidth,
          strokeDasharray: style.strokeDasharray,
          opacity: dimmed ? 0.08 : isConnected ? 1 : 0.35,
          transition: 'opacity 0.3s, stroke-width 0.3s',
        },
        markerEnd: {
          type: 'arrowclosed' as const,
          color: style.stroke,
          width: 14,
          height: 14,
        },
      };
    });
  }, [swarm, selectedAgent]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const agent = swarm.agents.find(a => a.id === node.id);
    if (agent) {
      if (selectedAgent?.id === agent.id) {
        onSelectAgent(null);
      } else {
        onSelectAgent(agent);
      }
    }
  }, [swarm, selectedAgent, onSelectAgent]);

  const onPaneClick = useCallback(() => {
    onSelectAgent(null);
  }, [onSelectAgent]);

  const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    if (onNodeDragStop) {
      onNodeDragStop(node.id, node.position);
    }
  }, [onNodeDragStop]);

  const handleConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target && connection.source !== connection.target) {
      setPendingConnection({ source: connection.source, target: connection.target });
    }
  }, []);

  const handleConnectionTypeSelect = useCallback((type: RelationshipType) => {
    if (pendingConnection && onConnect) {
      onConnect(pendingConnection.source, pendingConnection.target, type);
    }
    setPendingConnection(null);
  }, [pendingConnection, onConnect]);

  const [edgeToDelete, setEdgeToDelete] = React.useState<string | null>(null);

  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    if (onDeleteEdge) setEdgeToDelete(edge.id);
  }, [onDeleteEdge]);

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((event: DragEvent) => {
    event.preventDefault();
    const templateData = event.dataTransfer.getData('application/agent-template');
    if (!templateData || !onDropAgent) return;

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    onDropAgent(position, templateData);
  }, [onDropAgent, screenToFlowPosition]);

  return (
    <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ConnectHint agentCount={swarm.agents.length} relationshipCount={swarm.relationships.length} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        onEdgeClick={handleEdgeClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        snapToGrid
        snapGrid={[20, 20]}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
        connectionLineStyle={{ stroke: 'var(--accent-primary)', strokeWidth: 2 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border-subtle)" />
        <Controls
          position="bottom-left"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 10 }}
        />
      </ReactFlow>

      {/* Legend */}
      <LegendPanel layers={swarm.layers} />

      {pendingConnection && (
        <ConnectionTypeModal
          onSelect={handleConnectionTypeSelect}
          onCancel={() => setPendingConnection(null)}
        />
      )}

      {edgeToDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>Remove this connection?</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-5)', lineHeight: 1.5 }}>This will disconnect these two agents. You can reconnect them later.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button onClick={() => setEdgeToDelete(null)} style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-primary)', fontSize: 'var(--text-sm)' }}>Cancel</button>
              <button onClick={() => { onDeleteEdge?.(edgeToDelete); setEdgeToDelete(null); }} style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--status-error-strong, #dc2626)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-primary)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
