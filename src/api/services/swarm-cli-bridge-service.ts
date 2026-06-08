// Stage 3: Visual→CLI Bridge Adapter
// Converts a Swarm typed object (from the canvas) into the equivalent
// Claude Flow CLI call sequence. This bridges the visual design layer
// (Agent Modus Map) to the execution layer (Claude Flow CLI).

import type { Swarm, Agent, Relationship, RelationshipType } from '../../shared/types/index.js';

// ── Relationship type → topology mapping ─────────────────────────────────────

const REL_TOPOLOGY: Record<RelationshipType, string> = {
  feedsInto: 'ring',         // Data pipeline → ring topology
  dependsOn: 'hierarchical', // Dependency chain → hierarchical
  collaboratesWith: 'mesh',  // Peer collaboration → mesh
  canOverride: 'hierarchical', // Supervisor pattern → hierarchical
};

// ── CLI command types ────────────────────────────────────────────────────────

export interface CLISwarmInit {
  command: 'swarm init';
  args: {
    topology: string;
    maxAgents: number;
    strategy: string;
  };
  cli: string;
}

export interface CLIAgentSpawn {
  command: 'agent spawn';
  args: {
    agentType: string;
    name: string;
    capabilities: string[];
  };
  cli: string;
}

export interface CLICommand {
  step: number;
  type: 'swarm-init' | 'agent-spawn';
  command: CLISwarmInit | CLIAgentSpawn;
  comment: string;
}

export interface BridgeResult {
  swarmName: string;
  topology: string;
  inferredStrategy: string;
  commands: CLICommand[];
  shellScript: string;
}

// ── Infer topology from relationship patterns ────────────────────────────────

function inferTopology(swarm: Swarm): { topology: string; strategy: string } {
  const relTypes = swarm.relationships.map(r => r.type);
  const counts: Record<string, number> = {};
  for (const rt of relTypes) {
    counts[rt] = (counts[rt] || 0) + 1;
  }

  // If no relationships, default to mesh
  if (relTypes.length === 0) return { topology: 'mesh', strategy: 'balanced' };

  // Find the dominant relationship type
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as RelationshipType;
  const topology = REL_TOPOLOGY[dominant] || 'mesh';

  // Infer strategy from agent badges
  const hasSpecialized = swarm.agents.some(a =>
    a.badges.includes('CRITICAL') || a.badges.includes('HUB')
  );
  const hasAuto = swarm.agents.some(a => a.badges.includes('AUTO'));
  const hasHuman = swarm.agents.some(a => a.badges.includes('HUMAN'));

  let strategy = 'balanced';
  if (hasSpecialized && hasAuto) strategy = 'specialized';
  if (hasHuman && hasAuto) strategy = 'adaptive';

  return { topology, strategy };
}

// ── Map agent badges/role to CLI agent type ──────────────────────────────────

const BADGE_TO_AGENT_TYPE: Record<string, string> = {
  HUB: 'coordinator',
  CRITICAL: 'analyst',
  ENTRY: 'researcher',
  AUTO: 'coder',
  HUMAN: 'reviewer',
  ALWAYS_ON: 'optimizer',
  ADVISORY: 'researcher',
  CAN_OVERRIDE: 'coordinator',
  APPROVAL: 'reviewer',
  HIGH_PRIORITY: 'analyst',
};

function inferAgentType(agent: Agent): string {
  // Check badges first
  for (const badge of agent.badges) {
    if (BADGE_TO_AGENT_TYPE[badge]) return BADGE_TO_AGENT_TYPE[badge];
  }

  // Fall back to layer-based inference
  const config = agent.config as Record<string, unknown>;
  const skills = (config.skills as string[]) || [];

  if (skills.some(s => s.includes('code') || s.includes('implement'))) return 'coder';
  if (skills.some(s => s.includes('test'))) return 'tester';
  if (skills.some(s => s.includes('review') || s.includes('audit'))) return 'reviewer';
  if (skills.some(s => s.includes('research') || s.includes('search'))) return 'researcher';
  if (skills.some(s => s.includes('design') || s.includes('architect'))) return 'architect';

  return 'coder'; // Default
}

// ── Main conversion ──────────────────────────────────────────────────────────

/**
 * Convert a Swarm typed object to a sequence of CLI commands.
 * Produces both structured data and a ready-to-run shell script.
 */
export function swarmToCLI(swarm: Swarm): BridgeResult {
  const { topology, strategy } = inferTopology(swarm);
  const commands: CLICommand[] = [];
  let step = 1;

  // Step 1: Initialize the swarm
  const swarmInit: CLISwarmInit = {
    command: 'swarm init',
    args: { topology, maxAgents: swarm.agents.length, strategy },
    cli: `npx @claude-flow/cli@latest swarm init --topology ${topology} --max-agents ${swarm.agents.length} --strategy ${strategy}`,
  };
  commands.push({
    step: step++,
    type: 'swarm-init',
    command: swarmInit,
    comment: `Initialize swarm "${swarm.name}" with ${topology} topology`,
  });

  // Step 2+: Spawn each agent
  for (const agent of swarm.agents) {
    const agentType = inferAgentType(agent);
    const config = agent.config as Record<string, unknown>;
    const skills = (config.skills as string[]) || [];

    const spawnCmd: CLIAgentSpawn = {
      command: 'agent spawn',
      args: {
        agentType,
        name: agent.nickname,
        capabilities: skills,
      },
      cli: [
        `npx @claude-flow/cli@latest agent spawn`,
        `  --type ${agentType}`,
        `  --name "${agent.nickname}"`,
        ...(skills.length > 0 ? [`  --capabilities "${skills.join(',')}"`] : []),
      ].join(' \\\n'),
    };

    commands.push({
      step: step++,
      type: 'agent-spawn',
      command: spawnCmd,
      comment: `Spawn ${agent.nickname} (${agent.formalName}) as ${agentType}`,
    });
  }

  // Generate shell script
  const shellScript = generateShellScript(swarm.name, commands);

  return {
    swarmName: swarm.name,
    topology,
    inferredStrategy: strategy,
    commands,
    shellScript,
  };
}

// ── Shell script generation ──────────────────────────────────────────────────

function generateShellScript(swarmName: string, commands: CLICommand[]): string {
  const lines: string[] = [
    '#!/bin/bash',
    '# Auto-generated CLI script for swarm: ' + swarmName,
    '# Generated by Agent Modus Map — Visual→CLI Bridge',
    'set -euo pipefail',
    '',
  ];

  for (const cmd of commands) {
    lines.push(`# Step ${cmd.step}: ${cmd.comment}`);
    if (cmd.type === 'swarm-init') {
      const init = cmd.command as CLISwarmInit;
      lines.push(init.cli);
      lines.push('echo "✅ Swarm initialized"');
    } else {
      const spawn = cmd.command as CLIAgentSpawn;
      lines.push(spawn.cli);
      lines.push(`echo "✅ Agent '${spawn.args.name}' spawned"`);
    }
    lines.push('');
  }

  lines.push('echo ""');
  lines.push('echo "🎉 Swarm ready: ' + swarmName + '"');

  return lines.join('\n');
}
