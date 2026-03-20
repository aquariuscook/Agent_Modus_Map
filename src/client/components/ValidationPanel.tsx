import React from 'react';
import type { Swarm } from '../../shared/types/index.js';

export interface ValidationMessage {
  severity: 'error' | 'warning' | 'advisory';
  message: string;
  affectedAgents: string[];
  rule: string;
}

const severityStyles: Record<string, { color: string; bg: string; icon: string }> = {
  error: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: '\u26D4' },
  warning: { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', icon: '\u26A0' },
  advisory: { color: '#00d9ff', bg: 'rgba(0, 217, 255, 0.08)', icon: '\u2139' },
};

export function validateSwarm(swarm: Swarm): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const agentById = new Map(swarm.agents.map(a => [a.id, a]));

  // Rule 1: Orphan agents (no relationships at all)
  for (const agent of swarm.agents) {
    const hasRel = swarm.relationships.some(
      r => r.sourceAgentId === agent.id || r.targetAgentId === agent.id
    );
    if (!hasRel) {
      messages.push({
        severity: 'warning',
        message: `${agent.nickname} has no relationships. It is disconnected from the swarm and will not interact with other agents.`,
        affectedAgents: [agent.nickname],
        rule: 'no_orphan_agents',
      });
    }
  }

  // Rule 2: CRITICAL agents without monitoring connection
  const monitoringAgents = new Set(
    swarm.agents
      .filter(a => a.badges.includes('ALWAYS_ON') || a.formalName.toLowerCase().includes('monitor'))
      .map(a => a.id)
  );
  for (const agent of swarm.agents) {
    if (!agent.badges.includes('CRITICAL')) continue;
    const connectedToMonitor = swarm.relationships.some(r =>
      (r.sourceAgentId === agent.id && monitoringAgents.has(r.targetAgentId)) ||
      (r.targetAgentId === agent.id && monitoringAgents.has(r.sourceAgentId))
    );
    if (!connectedToMonitor) {
      messages.push({
        severity: 'advisory',
        message: `${agent.nickname} is marked CRITICAL but has no connection to a monitoring agent. Consider adding monitoring for early failure detection.`,
        affectedAgents: [agent.nickname],
        rule: 'critical_needs_monitoring',
      });
    }
  }

  // Rule 3: HUB agents should have a backup or fallback
  for (const agent of swarm.agents) {
    if (!agent.badges.includes('HUB')) continue;
    const dependents = swarm.relationships.filter(
      r => r.targetAgentId === agent.id && r.type === 'dependsOn'
    );
    if (dependents.length >= 5) {
      messages.push({
        severity: 'warning',
        message: `${agent.nickname} is a HUB with ${dependents.length} agents depending on it. If it goes down, those agents are all affected. Consider adding a backup.`,
        affectedAgents: [agent.nickname],
        rule: 'hub_needs_backup',
      });
    }
  }

  // Rule 4: canOverride without HUMAN or CAN_OVERRIDE badge
  for (const rel of swarm.relationships) {
    if (rel.type !== 'canOverride') continue;
    const source = agentById.get(rel.sourceAgentId);
    if (source && !source.badges.includes('CAN_OVERRIDE') && !source.badges.includes('HUMAN')) {
      messages.push({
        severity: 'warning',
        message: `${source.nickname} has override authority but is not marked CAN_OVERRIDE or HUMAN. Override agents should have explicit override badges for clarity.`,
        affectedAgents: [source.nickname],
        rule: 'override_needs_badge',
      });
    }
  }

  // Rule 5: ENTRY agent without downstream connections
  for (const agent of swarm.agents) {
    if (!agent.badges.includes('ENTRY')) continue;
    const feedsOrDeps = swarm.relationships.some(
      r => r.sourceAgentId === agent.id && (r.type === 'feedsInto' || r.type === 'collaboratesWith')
    );
    if (!feedsOrDeps) {
      messages.push({
        severity: 'error',
        message: `${agent.nickname} is an ENTRY point but does not feed into or collaborate with any other agent. It is a dead end.`,
        affectedAgents: [agent.nickname],
        rule: 'entry_needs_downstream',
      });
    }
  }

  // Rule 6: Single points of failure (high in-degree on dependsOn)
  for (const agent of swarm.agents) {
    const dependentCount = swarm.relationships.filter(
      r => r.targetAgentId === agent.id && r.type === 'dependsOn'
    ).length;
    if (dependentCount >= 8) {
      messages.push({
        severity: 'warning',
        message: `${agent.nickname} has ${dependentCount} agents depending on it. This is a significant single point of failure. Consider distributing responsibilities or adding redundancy.`,
        affectedAgents: [agent.nickname],
        rule: 'single_point_of_failure',
      });
    }
  }

  return messages.sort((a, b) => {
    const order = { error: 0, warning: 1, advisory: 2 };
    return order[a.severity] - order[b.severity];
  });
}

interface ValidationPanelProps {
  messages: ValidationMessage[];
  isOpen: boolean;
  onToggle: () => void;
}

export function ValidationPanel({ messages, isOpen, onToggle }: ValidationPanelProps) {
  const errorCount = messages.filter(m => m.severity === 'error').length;
  const warningCount = messages.filter(m => m.severity === 'warning').length;
  const advisoryCount = messages.filter(m => m.severity === 'advisory').length;

  return (
    <>
      {/* Toggle button in header area */}
      <button
        onClick={onToggle}
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '6px 14px',
          borderRadius: 8,
          border: `1px solid ${errorCount > 0 ? '#ef4444' : warningCount > 0 ? '#fbbf24' : '#22c55e'}`,
          background: errorCount > 0 ? 'rgba(239,68,68,0.15)' : warningCount > 0 ? 'rgba(251,191,36,0.1)' : 'rgba(34,197,94,0.1)',
          color: errorCount > 0 ? '#ef4444' : warningCount > 0 ? '#fbbf24' : '#22c55e',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          zIndex: 15,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
        }}
      >
        {errorCount > 0 && <span>{errorCount} error{errorCount > 1 ? 's' : ''}</span>}
        {warningCount > 0 && <span>{warningCount} warning{warningCount > 1 ? 's' : ''}</span>}
        {advisoryCount > 0 && <span>{advisoryCount} tip{advisoryCount > 1 ? 's' : ''}</span>}
        {messages.length === 0 && <span>All checks pass</span>}
      </button>

      {isOpen && messages.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 48,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 500,
          maxHeight: 320,
          overflowY: 'auto',
          background: 'rgba(15, 23, 42, 0.97)',
          border: '1px solid rgba(0, 217, 255, 0.2)',
          borderRadius: 12,
          padding: 12,
          zIndex: 30,
          boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
        }}>
          {messages.map((msg, i) => {
            const s = severityStyles[msg.severity];
            return (
              <div key={i} style={{
                padding: '8px 10px',
                marginBottom: 6,
                borderRadius: 8,
                background: s.bg,
                borderLeft: `3px solid ${s.color}`,
              }}>
                <div style={{ fontSize: 12, color: s.color, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <span>{s.icon}</span>
                  <span>{msg.message}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
