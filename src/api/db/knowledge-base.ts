// Knowledge base for Documentation RAG (ADR-003)
// Uses SQLite FTS5 for full-text search over curated best practices

import type Database from 'better-sqlite3';

export function initKnowledgeBase(db: Database.Database): void {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS kb_documents USING fts5(
      title,
      category,
      content,
      tags,
      tokenize='porter'
    );
  `);
}

export interface KBDocument {
  rowid?: number;
  title: string;
  category: string;
  content: string;
  tags: string;
}

export interface KBSearchResult {
  title: string;
  category: string;
  content: string;
  snippet: string;
  rank: number;
}

export function searchKnowledgeBase(db: Database.Database, query: string, limit = 5): KBSearchResult[] {
  const stmt = db.prepare(`
    SELECT title, category, content,
           snippet(kb_documents, 2, '<mark>', '</mark>', '...', 40) as snippet,
           rank
    FROM kb_documents
    WHERE kb_documents MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

  try {
    return stmt.all(query, limit) as KBSearchResult[];
  } catch {
    // If FTS query syntax fails, try a simpler match
    const fallback = db.prepare(`
      SELECT title, category, content,
             snippet(kb_documents, 2, '<mark>', '</mark>', '...', 40) as snippet,
             rank
      FROM kb_documents
      WHERE kb_documents MATCH '"' || ? || '"'
      ORDER BY rank
      LIMIT ?
    `);
    try {
      return fallback.all(query, limit) as KBSearchResult[];
    } catch {
      return [];
    }
  }
}

export function seedKnowledgeBase(db: Database.Database): void {
  const existing = db.prepare("SELECT COUNT(*) as count FROM kb_documents").get() as { count: number };
  if (existing.count > 0) return;

  const insert = db.prepare(
    'INSERT INTO kb_documents (title, category, content, tags) VALUES (?, ?, ?, ?)'
  );

  const docs: KBDocument[] = [
    {
      title: 'Agent Design: The Motus Naming Convention',
      category: 'design-patterns',
      content: 'Every agent in a swarm should have three identity components: a nickname (human-memorable, like "Doorbell" or "Sentinel"), a formal name (functional descriptor like "Interface-FirstContact"), and a personality descriptor (like "The Greeter"). This naming convention, called the Motus system, makes agent roles immediately comprehensible to non-technical stakeholders. The nickname should be a concrete noun or metaphor that evokes the agent\'s function. The formal name follows a Category-Function-Specialization pattern. The descriptor is a two-word phrase starting with "The" that captures the agent\'s personality.',
      tags: 'naming motus design identity agent',
    },
    {
      title: 'Layer Architecture: Five-Layer Swarm Organization',
      category: 'architecture',
      content: 'Enterprise agent swarms should be organized into functional layers. The recommended five-layer architecture is: (1) Customer Journey Layer for user-facing agents, (2) Product and Content Layer for data and content management, (3) Order Processing Layer for transactional workflows, (4) Operations and Monitoring Layer for system health and security, (5) Intelligence Layer for analytics and optimization. Each layer has a distinct color theme for visual identification. Agents within a layer share functional concerns and communicate primarily with their layer peers and adjacent layers.',
      tags: 'architecture layers organization structure',
    },
    {
      title: 'Relationship Types: The Four Connection Types',
      category: 'design-patterns',
      content: 'Agent relationships fall into four types: (1) dependsOn means the source agent requires data or services from the target to function. If the target fails, the source is impacted. (2) feedsInto means the source sends its output to the target for further processing. This defines data flow direction. (3) collaboratesWith means the agents coordinate as peers without a strict dependency. Either can function without the other but they work better together. (4) canOverride means the source has authority to block, supersede, or override the target\'s decisions. This should only be used for governance and safety agents like Sentinel or Gavel.',
      tags: 'relationships connections dependencies types design',
    },
    {
      title: 'Human-in-the-Loop: When Agents Should Escalate',
      category: 'governance',
      content: 'Not every decision should be automated. Agents should escalate to humans when: (1) The confidence score of a decision falls below a configurable threshold. (2) The decision involves financial transactions above a set limit. (3) A security threat is detected that requires human judgment. (4) Customer sentiment analysis indicates extreme frustration. (5) Two agents disagree and cannot resolve the conflict through their own protocols. Human escalation points should always have a timeout configured so that the system does not hang indefinitely waiting for human input. The HUMAN badge indicates an agent that can escalate, and the APPROVAL badge indicates it requires human sign-off before acting.',
      tags: 'human-in-the-loop escalation approval governance',
    },
    {
      title: 'Hub Agents: Managing Central Coordination Points',
      category: 'architecture',
      content: 'Hub agents (marked with the HUB badge) are agents that many other agents depend on. Examples include Catalog (product data source of truth), Scribe (system-wide audit logger), and Howler (incident alert dispatcher). Hub agents are critical infrastructure. Best practices: (1) Every hub agent should have a backup or failover agent that can take over if the hub fails. (2) Hub agents should be monitored with stricter alerting thresholds than regular agents. (3) Avoid creating new hub agents unless absolutely necessary. Distribute responsibilities when possible. (4) Hub agents should log all their operations to enable debugging when downstream agents report issues.',
      tags: 'hub critical backup failover central coordination',
    },
    {
      title: 'Critical Path: Protecting Revenue Workflows',
      category: 'operations',
      content: 'The critical path is the sequence of agents that handle the primary revenue-generating workflow. In e-commerce, this is typically: Order Trigger -> Approval -> Reconciliation -> API Gateway -> Customer Notification (or in Motus terms: Domino -> Gavel -> Knot -> Relay -> Courier). Every agent on the critical path should: (1) Have the CRITICAL badge. (2) Be connected to a monitoring agent. (3) Have a defined fallback behavior if it fails. (4) Log all decisions for audit purposes. (5) Have alerting configured with escalation to the operations team.',
      tags: 'critical-path revenue workflow order processing',
    },
    {
      title: 'Monitoring: Agent Health Indicators',
      category: 'operations',
      content: 'Every production swarm should have health monitoring with three status levels: Green (healthy) means the agent is operating within normal parameters. Yellow (degraded) means the agent is functioning but showing signs of stress such as elevated latency, increased error rates, or resource constraints. Red (unhealthy) means the agent is failing or unresponsive and requires immediate attention. Health should be derived from four metrics: latency (p95 response time), throughput (requests per minute), error rate (percentage of failed operations), and resource usage (CPU and memory). Agents marked ALWAYS_ON should trigger alerts if they go to unknown status for more than 2 minutes.',
      tags: 'monitoring health green yellow red status alerts',
    },
    {
      title: 'Security: Override Authorities and Guard Agents',
      category: 'security',
      content: 'Override authority is the ability of one agent to block or supersede another agent\'s decisions. This is a powerful capability that should be used sparingly. Only agents with the CAN_OVERRIDE badge should have override relationships. The three common override patterns are: (1) Security guard pattern: Sentinel monitors all agents and can override any agent that appears to be compromised or behaving anomalously. (2) Approval gate pattern: Gavel reviews decisions from upstream agents and can reject them if they violate business rules. (3) Emergency broadcast pattern: Howler can override all agents during an incident to ensure coordinated response. Override actions should always be logged with a justification in the decision trace.',
      tags: 'security override authority sentinel guard canOverride',
    },
    {
      title: 'Blast Radius Analysis: Understanding Failure Impact',
      category: 'operations',
      content: 'Blast radius is the set of agents that would be affected if a given agent fails. It is calculated by traversing the dependsOn relationships outward from the failing agent. An agent with a large blast radius is a single point of failure and should be prioritized for redundancy and monitoring. To reduce blast radius: (1) Add backup agents for high-dependency nodes. (2) Implement circuit breakers so that downstream agents degrade gracefully rather than failing completely. (3) Design fallback behaviors for every critical agent. (4) Regularly review the blast radius of hub agents and any agent with more than 5 dependents.',
      tags: 'blast-radius failure impact single-point-of-failure redundancy',
    },
    {
      title: 'Templates: Starting from Proven Architectures',
      category: 'design-patterns',
      content: 'New swarm designs should start from templates rather than blank canvases. Templates encode proven architecture patterns for specific domains. The E-Commerce template includes 25 agents across 5 layers covering customer journey, product management, order processing, operations, and intelligence. Other common templates include Customer Service (3-tier escalation with sentiment analysis), Content Operations (creation, review, optimization, publishing pipeline), and DevOps/SRE (deployment, monitoring, incident response, post-mortem). Templates include customization points where users are expected to add domain-specific agents. Starting from a template and customizing is faster and safer than designing from scratch.',
      tags: 'templates patterns e-commerce customer-service devops starting-point',
    },
    {
      title: 'Decision Traces: The Four-Stage Audit Format',
      category: 'governance',
      content: 'Every significant agent decision should be logged in four stages: (1) Observation: What data the agent perceived at decision time, including inputs from other agents. (2) Analysis: How the agent interpreted the data, what rules or models were applied, and what flags were raised. (3) Decision: What action the agent chose, why it chose that action over alternatives, and its confidence level. (4) Action: What actually happened as a result, including downstream effects and timing. This format makes agent behavior transparent and auditable. The "reason" field in the Decision stage should always be plain language that a non-technical stakeholder can understand.',
      tags: 'decision-trace audit logging four-stage observation analysis decision action',
    },
    {
      title: 'Agent Failover: Designing for Resilience',
      category: 'architecture',
      content: 'Every critical agent should have a defined failover strategy. Common patterns include: (1) Hot standby: A backup agent runs in parallel and takes over immediately when the primary fails. Expensive but provides zero downtime. (2) Warm standby: A backup agent is ready but not actively processing. It needs a brief startup period before taking over. Good for agents with moderate latency tolerance. (3) Graceful degradation: The agent reduces its capabilities rather than failing completely. For example, a recommendation engine might return popular items instead of personalized recommendations. (4) Queue buffering: Incoming requests are queued and processed when the agent recovers. Suitable for non-real-time agents. The choice of strategy depends on the agent\'s position on the critical path and its latency requirements.',
      tags: 'failover resilience backup hot-standby degradation recovery',
    },
  ];

  const transaction = db.transaction(() => {
    for (const doc of docs) {
      insert.run(doc.title, doc.category, doc.content, doc.tags);
    }
  });

  transaction();
  console.log(`Seeded knowledge base: ${docs.length} documents`);
}
