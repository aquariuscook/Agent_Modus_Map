// Stage 3: Cost Estimation Calculator
// Calculates estimated costs based on model configs, expected throughput, and API pricing
import type { Swarm, Agent } from '../../shared/types/index.js';

export interface AgentCostEstimate {
  agentId: string;
  nickname: string;
  provider: string;
  model: string;
  inputTokensPerCall: number;
  outputTokensPerCall: number;
  costPerCall: number;
  callsPerDay: number;
  dailyCost: number;
  monthlyCost: number;
  budgetDailyUsd: number;
  budgetMonthlyUsd: number;
  overBudget: boolean;
}

export interface SwarmCostEstimate {
  swarmId: string;
  swarmName: string;
  totalDailyCost: number;
  totalMonthlyCost: number;
  totalDailyBudget: number;
  totalMonthlyBudget: number;
  agents: AgentCostEstimate[];
  cheapestProvider: string;
  mostExpensiveAgent: string;
  estimatedAt: string;
}

// Pricing per 1M tokens (input / output) as of early 2026
const PRICING: Record<string, Record<string, { input: number; output: number }>> = {
  anthropic: {
    'claude-opus-4-6': { input: 15.0, output: 75.0 },
    'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
    'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
    'claude-sonnet-4-5-20250514': { input: 3.0, output: 15.0 },
    default: { input: 3.0, output: 15.0 },
  },
  openai: {
    'gpt-4o': { input: 2.5, output: 10.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4-turbo': { input: 10.0, output: 30.0 },
    'o1': { input: 15.0, output: 60.0 },
    'o3-mini': { input: 1.1, output: 4.4 },
    default: { input: 2.5, output: 10.0 },
  },
  google: {
    'gemini-2.0-flash': { input: 0.1, output: 0.4 },
    'gemini-2.0-pro': { input: 1.25, output: 10.0 },
    'gemini-1.5-pro': { input: 1.25, output: 5.0 },
    default: { input: 0.5, output: 2.0 },
  },
  mistral: {
    'mistral-large': { input: 2.0, output: 6.0 },
    'mistral-medium': { input: 2.7, output: 8.1 },
    'mistral-small': { input: 0.2, output: 0.6 },
    default: { input: 0.5, output: 1.5 },
  },
  meta: {
    default: { input: 0.0, output: 0.0 }, // Open source, self-hosted
  },
  local: {
    default: { input: 0.0, output: 0.0 },
  },
  custom: {
    default: { input: 1.0, output: 3.0 },
  },
};

export function estimateSwarmCost(swarm: Swarm, callsPerDayOverride?: number): SwarmCostEstimate {
  const agents: AgentCostEstimate[] = [];

  for (const agent of swarm.agents) {
    agents.push(estimateAgentCost(agent, swarm, callsPerDayOverride));
  }

  const totalDailyCost = agents.reduce((sum, a) => sum + a.dailyCost, 0);
  const totalMonthlyCost = agents.reduce((sum, a) => sum + a.monthlyCost, 0);
  const totalDailyBudget = agents.reduce((sum, a) => sum + a.budgetDailyUsd, 0);
  const totalMonthlyBudget = agents.reduce((sum, a) => sum + a.budgetMonthlyUsd, 0);

  const mostExpensive = agents.length > 0
    ? agents.reduce((max, a) => a.monthlyCost > max.monthlyCost ? a : max).nickname
    : 'N/A';

  // Find cheapest provider that could handle this workload
  const providerCosts = calculateProviderAlternatives(swarm, callsPerDayOverride);
  const cheapest = Object.entries(providerCosts).sort((a, b) => a[1] - b[1])[0];

  return {
    swarmId: swarm.id,
    swarmName: swarm.name,
    totalDailyCost: round(totalDailyCost),
    totalMonthlyCost: round(totalMonthlyCost),
    totalDailyBudget: round(totalDailyBudget),
    totalMonthlyBudget: round(totalMonthlyBudget),
    agents,
    cheapestProvider: cheapest ? `${cheapest[0]} ($${round(cheapest[1])}/mo)` : 'N/A',
    mostExpensiveAgent: mostExpensive,
    estimatedAt: new Date().toISOString(),
  };
}

function estimateAgentCost(agent: Agent, swarm: Swarm, callsPerDayOverride?: number): AgentCostEstimate {
  const config = agent.config as Record<string, any>;
  const modelConfig = config.modelConfig || {};
  const costLimits = config.costLimits || {};

  const provider = (modelConfig.provider as string) || 'anthropic';
  const model = (modelConfig.model as string) || 'claude-sonnet-4-6';
  const maxTokens = (modelConfig.maxTokens as number) || 4096;

  // Estimate tokens per call
  const inputTokensPerCall = Math.ceil(maxTokens * 0.6); // Assume 60% of context is input
  const outputTokensPerCall = Math.ceil(maxTokens * 0.4); // 40% is output

  // Estimate calls per day based on agent role
  const callsPerDay = callsPerDayOverride || estimateCallsPerDay(agent, swarm);

  // Get pricing
  const pricing = getModelPricing(provider, model);
  const costPerCall = (inputTokensPerCall * pricing.input + outputTokensPerCall * pricing.output) / 1_000_000;

  const dailyCost = costPerCall * callsPerDay;
  const monthlyCost = dailyCost * 30;

  const budgetDailyUsd = (costLimits.dailyBudgetUsd as number) || 50;
  const budgetMonthlyUsd = (costLimits.monthlyBudgetUsd as number) || 1000;

  return {
    agentId: agent.id,
    nickname: agent.nickname,
    provider,
    model,
    inputTokensPerCall,
    outputTokensPerCall,
    costPerCall: round(costPerCall, 4),
    callsPerDay,
    dailyCost: round(dailyCost),
    monthlyCost: round(monthlyCost),
    budgetDailyUsd,
    budgetMonthlyUsd,
    overBudget: monthlyCost > budgetMonthlyUsd,
  };
}

function estimateCallsPerDay(agent: Agent, swarm: Swarm): number {
  // Heuristic: entry points get more calls, downstream agents get fewer
  const isEntry = agent.badges.includes('ENTRY');
  const isAlwaysOn = agent.badges.includes('ALWAYS_ON');
  const isCritical = agent.badges.includes('CRITICAL');

  // Count inbound relationships (more connections = more calls)
  const inbound = swarm.relationships.filter(
    r => r.targetAgentId === agent.id && (r.type === 'feedsInto' || r.type === 'dependsOn')
  ).length;

  let base = 100; // Default: 100 calls/day
  if (isEntry) base = 500;
  if (isAlwaysOn) base = 300;
  if (isCritical) base = 200;

  // More inbound connections = more calls
  base += inbound * 50;

  return base;
}

function getModelPricing(provider: string, model: string): { input: number; output: number } {
  const providerPricing = PRICING[provider] || PRICING.custom;
  return providerPricing[model] || providerPricing.default;
}

function calculateProviderAlternatives(swarm: Swarm, callsPerDay?: number): Record<string, number> {
  const providers = ['anthropic', 'openai', 'google', 'mistral'];
  const result: Record<string, number> = {};

  for (const provider of providers) {
    let totalMonthly = 0;
    for (const agent of swarm.agents) {
      const config = agent.config as Record<string, any>;
      const modelConfig = config.modelConfig || {};
      const maxTokens = (modelConfig.maxTokens as number) || 4096;
      const inputTokens = Math.ceil(maxTokens * 0.6);
      const outputTokens = Math.ceil(maxTokens * 0.4);
      const calls = callsPerDay || estimateCallsPerDay(agent, swarm);

      // Use the cheapest model from each provider
      const pricing = PRICING[provider]?.default || { input: 1, output: 3 };
      const costPerCall = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
      totalMonthly += costPerCall * calls * 30;
    }
    result[provider] = round(totalMonthly);
  }

  return result;
}

function round(n: number, decimals = 2): number {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
