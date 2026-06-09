// LLM integration via provider-router-service (ADR-012 multi-provider)
import {
  getCheapestModel,
  callGenerateText,
  listProviders,
  NoProviderAvailableError,
} from './provider-router-service.js';

/** Check whether ANY LLM provider key is configured. */
export function isLLMAvailable(): boolean {
  return listProviders().some(p => p.available);
}

export async function generateAnswer(
  question: string,
  context: { graphData: string; docSnippets: string; swarmSummary: string }
): Promise<string> {
  const systemPrompt = `You are an expert agent architecture assistant embedded in the Agent Modus Map platform. You help users design, understand, and optimize multi-agent swarms.

You have access to the following context about the user's current swarm:

SWARM SUMMARY:
${context.swarmSummary}

GRAPH ANALYSIS DATA:
${context.graphData}

RELEVANT DOCUMENTATION:
${context.docSnippets}

Answer the user's question clearly and concisely. Reference specific agents by name when relevant. If the graph data shows bottlenecks or risks, mention them. Keep responses practical and actionable.`;

  try {
    const { model, route } = getCheapestModel(0.6); // Medium complexity — RAG Q&A

    const result = await callGenerateText(
      { caller: 'llm-service:generateAnswer', route, model },
      {
        system: systemPrompt,
        messages: [{ role: 'user', content: question }],
        maxTokens: 1024,
      },
    );

    return result.text || '';
  } catch (err) {
    if (err instanceof NoProviderAvailableError) {
      return ''; // Fall back to keyword-based answers
    }
    console.error('LLM call failed:', err);
    return '';
  }
}

export async function generateAgentSuggestions(
  agentConfig: Record<string, unknown>,
  swarmContext: string
): Promise<string[]> {
  try {
    const { model, route } = getCheapestModel(0.5); // Medium complexity — suggestions

    const result = await callGenerateText(
      { caller: 'llm-service:generateAgentSuggestions', route, model },
      {
        system: 'You are an expert agent architect. Given an agent configuration and swarm context, suggest improvements. Return a JSON array of suggestion strings. Only return the JSON array, nothing else.',
        messages: [{
          role: 'user',
          content: `Agent config: ${JSON.stringify(agentConfig)}\n\nSwarm context: ${swarmContext}`,
        }],
        maxTokens: 512,
      },
    );

    if (!result.text) return [];
    try {
      const parsed = JSON.parse(result.text);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [result.text];
    }
  } catch (err) {
    if (err instanceof NoProviderAvailableError) return [];
    console.error('Agent suggestions LLM call failed:', err);
    return [];
  }
}
