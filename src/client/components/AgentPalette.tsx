import React, { useState } from 'react';
import type { Badge, LayerDefinition } from '../../shared/types/index.js';

interface AgentTemplate {
  category: string;
  nickname: string;
  formalName: string;
  descriptor: string;
  badges: Badge[];
  layerId: string;
}

const agentTemplates: AgentTemplate[] = [
  // Customer Journey
  { category: 'Customer Journey', nickname: 'Greeter', formalName: 'Interface-Greeting', descriptor: 'New Greeter', badges: ['ENTRY', 'AUTO'], layerId: 'layer-customer' },
  { category: 'Customer Journey', nickname: 'Support', formalName: 'Interface-Support', descriptor: 'Support Agent', badges: ['HUMAN', 'HIGH_PRIORITY'], layerId: 'layer-customer' },
  { category: 'Customer Journey', nickname: 'Notifier', formalName: 'Communication-Alert', descriptor: 'Notification Agent', badges: ['AUTO'], layerId: 'layer-customer' },
  // Product & Content
  { category: 'Product & Content', nickname: 'Writer', formalName: 'Content-Generator', descriptor: 'Content Writer', badges: ['APPROVAL', 'MEDIUM'], layerId: 'layer-product' },
  { category: 'Product & Content', nickname: 'Analyzer', formalName: 'Data-Analyzer', descriptor: 'Data Analyst', badges: ['AUTO', 'HIGH_PRIORITY'], layerId: 'layer-product' },
  // Order Processing
  { category: 'Order Processing', nickname: 'Trigger', formalName: 'Workflow-Trigger', descriptor: 'Workflow Starter', badges: ['ENTRY', 'CRITICAL', 'AUTO'], layerId: 'layer-order' },
  { category: 'Order Processing', nickname: 'Approver', formalName: 'Workflow-Approver', descriptor: 'Decision Maker', badges: ['CRITICAL', 'HUMAN'], layerId: 'layer-order' },
  // Operations
  { category: 'Operations', nickname: 'Monitor', formalName: 'Monitor-Health', descriptor: 'Health Monitor', badges: ['CRITICAL', 'ALWAYS_ON'], layerId: 'layer-operations' },
  { category: 'Operations', nickname: 'Guard', formalName: 'Monitor-Security', descriptor: 'Security Guard', badges: ['CRITICAL', 'CAN_OVERRIDE'], layerId: 'layer-operations' },
  // Intelligence
  { category: 'Intelligence', nickname: 'Detective', formalName: 'Intelligence-Pattern', descriptor: 'Pattern Finder', badges: ['AUTO', 'ADVISORY'], layerId: 'layer-intelligence' },
  { category: 'Intelligence', nickname: 'Reporter', formalName: 'Intelligence-Report', descriptor: 'Report Builder', badges: ['AUTO', 'HIGH_PRIORITY'], layerId: 'layer-intelligence' },
];

const categoryColors: Record<string, string> = {
  'Customer Journey': '#00d9ff',
  'Product & Content': '#a855f7',
  'Order Processing': '#22c55e',
  'Operations': '#fb923c',
  'Intelligence': '#fbbf24',
};

interface AgentPaletteProps {
  layers: LayerDefinition[];
  onDragStart: (template: { nickname: string; formalName: string; descriptor: string; badges: Badge[]; layerId: string }) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function AgentPalette({ layers, onDragStart, isOpen, onToggle }: AgentPaletteProps) {
  const [filter, setFilter] = useState('');

  const categories = [...new Set(agentTemplates.map(t => t.category))];

  const filtered = filter
    ? agentTemplates.filter(t =>
        t.nickname.toLowerCase().includes(filter.toLowerCase()) ||
        t.category.toLowerCase().includes(filter.toLowerCase()) ||
        t.descriptor.toLowerCase().includes(filter.toLowerCase())
      )
    : agentTemplates;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: isOpen ? 260 : 0,
      height: '100%',
      background: 'rgba(15, 23, 42, 0.97)',
      borderRight: isOpen ? '1px solid rgba(0, 217, 255, 0.2)' : 'none',
      overflow: 'hidden',
      transition: 'width 0.25s ease',
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Toggle button - always visible */}
      <button
        onClick={onToggle}
        style={{
          position: 'absolute',
          top: 12,
          right: isOpen ? -36 : -36,
          left: isOpen ? undefined : 8,
          width: 32,
          height: 32,
          borderRadius: 8,
          background: '#1e293b',
          border: '1px solid rgba(0, 217, 255, 0.3)',
          color: '#00d9ff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          zIndex: 25,
        }}
      >
        {isOpen ? '\u2190' : '+'}
      </button>

      {isOpen && (
        <>
          <div style={{ padding: '16px 14px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 13, color: '#00d9ff', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              Agent Palette
            </div>
            <input
              type="text"
              placeholder="Filter agents..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid rgba(0, 217, 255, 0.2)',
                background: 'rgba(0, 0, 0, 0.3)',
                color: '#fff',
                fontSize: 12,
                outline: 'none',
              }}
            />
            <div style={{ fontSize: 11, color: '#8b9dc3', marginTop: 6 }}>
              Drag an agent onto the canvas
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
            {categories.map(category => {
              const items = filtered.filter(t => t.category === category);
              if (items.length === 0) return null;
              const color = categoryColors[category] || '#8b9dc3';

              return (
                <div key={category} style={{ marginBottom: 14 }}>
                  <div style={{
                    fontSize: 11,
                    color,
                    fontWeight: 600,
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>
                    {category}
                  </div>

                  {items.map(template => (
                    <div
                      key={template.nickname}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/agent-template', JSON.stringify(template));
                        e.dataTransfer.effectAllowed = 'copy';
                        onDragStart(template);
                      }}
                      style={{
                        padding: '8px 10px',
                        marginBottom: 4,
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${color}33`,
                        cursor: 'grab',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLDivElement).style.background = `${color}15`;
                        (e.currentTarget as HTMLDivElement).style.borderColor = `${color}66`;
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLDivElement).style.background = 'rgba(255, 255, 255, 0.04)';
                        (e.currentTarget as HTMLDivElement).style.borderColor = `${color}33`;
                      }}
                    >
                      <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{template.nickname}</div>
                      <div style={{ fontSize: 10, color: '#a0aec0', fontStyle: 'italic' }}>"{template.descriptor}"</div>
                      <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                        {template.badges.slice(0, 3).map(b => (
                          <span key={b} style={{
                            fontSize: 8,
                            padding: '1px 5px',
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.08)',
                            color: '#8b9dc3',
                          }}>
                            {b.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
