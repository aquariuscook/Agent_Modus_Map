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
  advisory: { color: 'var(--accent-primary)', bg: 'rgba(0, 217, 255, 0.08)', icon: '\u2139' },
};

export function validateSwarm(swarm: Swarm): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const agentById = new Map(swarm.agents.map(a => [a.id, a]));

  // Rule 1: Disconnected agents
  for (const agent of swarm.agents) {
    const hasRel = swarm.relationships.some(
      r => r.sourceAgentId === agent.id || r.targetAgentId === agent.id
    );
    if (!hasRel) {
      messages.push({
        severity: 'warning',
        message: `"${agent.nickname}" isn't connected to anything. It won't receive work from other agents or pass results along. Connect it to at least one other agent to make it part of the workflow.`,
        affectedAgents: [agent.nickname],
        rule: 'no_orphan_agents',
      });
    }
  }

  // Rule 2: Important agents with no safety net
  const watcherAgents = new Set(
    swarm.agents
      .filter(a => a.badges.includes('ALWAYS_ON') || a.formalName.toLowerCase().includes('monitor'))
      .map(a => a.id)
  );
  for (const agent of swarm.agents) {
    if (!agent.badges.includes('CRITICAL')) continue;
    const connectedToWatcher = swarm.relationships.some(r =>
      (r.sourceAgentId === agent.id && watcherAgents.has(r.targetAgentId)) ||
      (r.targetAgentId === agent.id && watcherAgents.has(r.sourceAgentId))
    );
    if (!connectedToWatcher) {
      messages.push({
        severity: 'advisory',
        message: `"${agent.nickname}" is important to your workflow, but nothing is watching it for problems. If it stops working, you won't know until something downstream breaks. Consider adding a check-in point.`,
        affectedAgents: [agent.nickname],
        rule: 'critical_needs_monitoring',
      });
    }
  }

  // Rule 3: Too many agents relying on one
  for (const agent of swarm.agents) {
    if (!agent.badges.includes('HUB')) continue;
    const dependents = swarm.relationships.filter(
      r => r.targetAgentId === agent.id && r.type === 'dependsOn'
    );
    if (dependents.length >= 5) {
      messages.push({
        severity: 'warning',
        message: `${dependents.length} agents rely on "${agent.nickname}" to do their work. If "${agent.nickname}" has a problem, all of them stop too. You might want a backup plan or a way to split the load.`,
        affectedAgents: [agent.nickname],
        rule: 'hub_needs_backup',
      });
    }
  }

  // Rule 4: Override permission without the right label
  for (const rel of swarm.relationships) {
    if (rel.type !== 'canOverride') continue;
    const source = agentById.get(rel.sourceAgentId);
    if (source && !source.badges.includes('CAN_OVERRIDE') && !source.badges.includes('HUMAN')) {
      messages.push({
        severity: 'warning',
        message: `"${source.nickname}" can override other agents' decisions, but it isn't labeled as having that authority. Add the CAN_OVERRIDE or HUMAN badge so it's clear who has override power.`,
        affectedAgents: [source.nickname],
        rule: 'override_needs_badge',
      });
    }
  }

  // Rule 5: Starting point that goes nowhere
  for (const agent of swarm.agents) {
    if (!agent.badges.includes('ENTRY')) continue;
    const feedsOrDeps = swarm.relationships.some(
      r => r.sourceAgentId === agent.id && (r.type === 'feedsInto' || r.type === 'collaboratesWith')
    );
    if (!feedsOrDeps) {
      messages.push({
        severity: 'error',
        message: `"${agent.nickname}" is where work enters the system, but it doesn't pass anything to other agents. Work comes in and goes nowhere. Connect it to the next step in your workflow.`,
        affectedAgents: [agent.nickname],
        rule: 'entry_needs_downstream',
      });
    }
  }

  // Rule 6: Bottleneck risk
  for (const agent of swarm.agents) {
    const dependentCount = swarm.relationships.filter(
      r => r.targetAgentId === agent.id && r.type === 'dependsOn'
    ).length;
    if (dependentCount >= 8) {
      messages.push({
        severity: 'warning',
        message: `"${agent.nickname}" is a bottleneck. ${dependentCount} other agents can't work without it. If it slows down or breaks, your whole workflow backs up. Consider splitting its responsibilities across two agents.`,
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
          bottom: 16,
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
          bottom: 48,
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
