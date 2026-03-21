import React, { useMemo, useCallback, useRef, type DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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

const edgeStyles: Record<string, { stroke: string; strokeDasharray?: string; strokeWidth: number }> = {
  dependsOn: { stroke: '#00d9ff', strokeWidth: 2 },
  feedsInto: { stroke: '#7c3aed', strokeDasharray: '8,4', strokeWidth: 2 },
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
}

function getLayerColor(layerId: string, layers: Swarm['layers']): string {
  const layer = layers.find(l => l.id === layerId);
  return layer?.colorTheme || '#8b9dc3';
}

export function SwarmCanvas({
  swarm, selectedAgent, onSelectAgent, blastRadius, showBlastRadius,
  onNodeDragStop, onConnect, onDropAgent, onDeleteEdge, agentHealthMap,
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
        emoji: (agent.config as any)?.emoji || undefined,
        healthStatus: agentHealthMap?.[agent.id] || undefined,
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

  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    if (onDeleteEdge && window.confirm('Delete this relationship?')) {
      onDeleteEdge(edge.id);
    }
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
    <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
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
        connectionLineStyle={{ stroke: '#00d9ff', strokeWidth: 2 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(0, 217, 255, 0.06)" />
        <Controls
          position="bottom-left"
          style={{ background: '#1e293b', border: '1px solid rgba(0, 217, 255, 0.3)', borderRadius: 10 }}
        />
        <MiniMap
          position="bottom-right"
          style={{
            background: '#0f172a',
            border: '1px solid rgba(0, 217, 255, 0.2)',
            borderRadius: 10,
          }}
          nodeColor={(node) => {
            const data = node.data as unknown as AgentNodeData;
            return data?.layerColor || '#8b9dc3';
          }}
          maskColor="rgba(10, 14, 39, 0.8)"
        />
      </ReactFlow>

      {pendingConnection && (
        <ConnectionTypeModal
          onSelect={handleConnectionTypeSelect}
          onCancel={() => setPendingConnection(null)}
        />
      )}
    </div>
  );
}
