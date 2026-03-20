// RAG service implementing ADR-003 (Dual RAG Architecture)
// Graph RAG: translates natural language to graph service queries
// Documentation RAG: full-text search over curated knowledge base

import type Database from 'better-sqlite3';
import { GraphService } from './graph-service.js';
import { searchKnowledgeBase, type KBSearchResult } from '../db/knowledge-base.js';

export interface RAGResponse {
  answer: string;
  sources: Array<{ title: string; category: string; snippet: string }>;
  graphHighlights: string[];
  queryType: 'graph' | 'documentation' | 'both';
}

// Pattern matchers for graph queries
const graphPatterns: Array<{
  pattern: RegExp;
  handler: (match: RegExpMatchArray, gs: GraphService, swarmId: string) => RAGResponse;
}> = [
  {
    // "What happens if X goes down?" / "blast radius of X" / "what if X fails"
    pattern: /(?:what happens if|blast radius (?:of|for)|what if|impact of)\s+(\w+)\s+(?:goes down|fails|crashes|stops|is down)/i,
    handler: (match, gs, swarmId) => {
      const agentName = match[1];
      const results = gs.blastRadius(swarmId, agentName, 3);
      if (results.length === 0) {
        return {
          answer: `No agents directly depend on ${agentName}, so its failure would have limited immediate impact. However, check for indirect effects through collaboratesWith relationships.`,
          sources: [],
          graphHighlights: [agentName],
          queryType: 'graph',
        };
      }

      const hop1 = results.filter(r => r.hops === 1);
      const hop2 = results.filter(r => r.hops === 2);
      const hop3 = results.filter(r => r.hops === 3);

      let answer = `If ${agentName} goes down, ${results.length} agents would be affected.\n\n`;
      if (hop1.length > 0) {
        answer += `**Immediately affected (1 hop):** ${hop1.map(r => r.nickname).join(', ')}. These agents directly depend on ${agentName} and would lose functionality.\n\n`;
      }
      if (hop2.length > 0) {
        answer += `**Secondary impact (2 hops):** ${hop2.map(r => r.nickname).join(', ')}. These agents depend on the directly affected agents.\n\n`;
      }
      if (hop3.length > 0) {
        answer += `**Tertiary impact (3 hops):** ${hop3.map(r => r.nickname).join(', ')}.\n\n`;
      }

      const criticalAffected = results.filter(r => r.badges.includes('CRITICAL'));
      if (criticalAffected.length > 0) {
        answer += `**Warning:** ${criticalAffected.length} CRITICAL agents are in the blast radius: ${criticalAffected.map(r => r.nickname).join(', ')}. Consider adding a backup for ${agentName}.`;
      }

      return {
        answer,
        sources: [],
        graphHighlights: [agentName, ...results.map(r => r.nickname)],
        queryType: 'graph',
      };
    },
  },
  {
    // "critical path from X to Y" / "path from X to Y" / "how does X reach Y"
    pattern: /(?:critical path|path|route|flow)\s+(?:from|between)\s+(\w+)\s+(?:to|and)\s+(\w+)/i,
    handler: (match, gs, swarmId) => {
      const from = match[1];
      const to = match[2];
      const result = gs.criticalPath(swarmId, from, to);

      if (!result) {
        return {
          answer: `No path found from ${from} to ${to} via feedsInto relationships. These agents may communicate through other relationship types (dependsOn, collaboratesWith) or they may not be connected.`,
          sources: [],
          graphHighlights: [from, to],
          queryType: 'graph',
        };
      }

      return {
        answer: `The path from ${from} to ${to} goes through ${result.length} agents:\n\n**${result.path.join(' → ')}**\n\nThis is the shortest route via feedsInto relationships.`,
        sources: [],
        graphHighlights: result.path,
        queryType: 'graph',
      };
    },
  },
  {
    // "what are the bottlenecks" / "single points of failure" / "what is most critical"
    pattern: /(?:bottleneck|single point|most critical|most important|most connected|hub)/i,
    handler: (_match, gs, swarmId) => {
      const spofs = gs.singlePointsOfFailure(swarmId, 2);
      const hubs = gs.hubAgents(swarmId);

      let answer = '**Top bottlenecks by dependent count:**\n\n';
      for (const s of spofs.slice(0, 5)) {
        answer += `- **${s.nickname}**: ${s.dependents} agents depend on it\n`;
      }

      answer += '\n**Most connected agents (total edges):**\n\n';
      for (const h of hubs.slice(0, 5)) {
        answer += `- **${h.nickname}**: ${h.totalEdges} total connections\n`;
      }

      if (spofs.length > 0) {
        answer += `\nThe highest-risk agent is **${spofs[0].nickname}** with ${spofs[0].dependents} dependents. If it fails, all those agents lose functionality.`;
      }

      return {
        answer,
        sources: [],
        graphHighlights: [...spofs.slice(0, 3).map(s => s.nickname), ...hubs.slice(0, 3).map(h => h.nickname)],
        queryType: 'graph',
      };
    },
  },
  {
    // "what does X do" / "tell me about X" / "who is X"
    pattern: /(?:what does|tell me about|who is|describe|explain)\s+(\w+)/i,
    handler: (match, gs, swarmId) => {
      const agentName = match[1];
      const blast = gs.blastRadius(swarmId, agentName, 1);
      const hubs = gs.hubAgents(swarmId);
      const agentHub = hubs.find(h => h.nickname === agentName);

      let answer = `**${agentName}** `;
      if (agentHub) {
        answer += `is one of the most connected agents in the swarm with ${agentHub.totalEdges} total relationships. `;
      }
      if (blast.length > 0) {
        answer += `${blast.length} agent${blast.length > 1 ? 's' : ''} directly depend on it: ${blast.map(b => b.nickname).join(', ')}. `;
      } else {
        answer += `has no agents directly depending on it. `;
      }

      return {
        answer: answer.trim(),
        sources: [],
        graphHighlights: [agentName, ...blast.map(b => b.nickname)],
        queryType: 'graph',
      };
    },
  },
];

export class RAGService {
  private graphService: GraphService;
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.graphService = new GraphService(db);
  }

  query(swarmId: string, question: string): RAGResponse {
    // Step 1: Try graph patterns first (swarm-specific queries)
    for (const { pattern, handler } of graphPatterns) {
      const match = question.match(pattern);
      if (match) {
        const graphResult = handler(match, this.graphService, swarmId);

        // Also search docs for supplementary context
        const docResults = this.searchDocs(question);
        if (docResults.length > 0) {
          graphResult.sources = docResults.map(d => ({
            title: d.title,
            category: d.category,
            snippet: d.snippet,
          }));
          graphResult.queryType = 'both';
        }

        return graphResult;
      }
    }

    // Step 2: Fall back to documentation search
    const docResults = this.searchDocs(question);
    if (docResults.length > 0) {
      const topResult = docResults[0];
      let answer = topResult.content;
      if (docResults.length > 1) {
        answer += '\n\n---\n\n**Related:** ' + docResults.slice(1).map(d => d.title).join(', ');
      }

      return {
        answer,
        sources: docResults.map(d => ({
          title: d.title,
          category: d.category,
          snippet: d.snippet,
        })),
        graphHighlights: [],
        queryType: 'documentation',
      };
    }

    // Step 3: No results
    return {
      answer: "I don't have specific information about that topic. Try asking about agent relationships (\"What happens if Catalog goes down?\"), design patterns (\"How should I handle failover?\"), or swarm structure (\"What are the bottlenecks?\").",
      sources: [],
      graphHighlights: [],
      queryType: 'documentation',
    };
  }

  private searchDocs(query: string): KBSearchResult[] {
    // Extract key terms for FTS
    const terms = query
      .toLowerCase()
      .replace(/[?.,!]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !['what', 'how', 'should', 'does', 'tell', 'about', 'the', 'with', 'that', 'this', 'from', 'have', 'when'].includes(w));

    if (terms.length === 0) return [];

    const ftsQuery = terms.join(' OR ');
    return searchKnowledgeBase(this.db, ftsQuery, 3);
  }
}
